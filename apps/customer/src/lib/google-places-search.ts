import { resolveGooglePlacesApiKey } from '@/lib/google-places-access-token';
import type { PickupCoordinates } from '@/lib/profile-location';

export type AddressSuggestion = {
  id: string; // placeId
  label: string;
  secondary?: string;
};

export type PlaceDetails = {
  location: PickupCoordinates;
  formattedAddress: string;
};

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

export function newPlacesSessionToken(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Search-as-you-type via Places API (New) Autocomplete, restricted to Ghana.
 * Billed per session (not per keystroke) as long as the same sessionToken is
 * reused across every suggestion request and then passed once to
 * getPlaceDetails to close it out — see usePickupSearch's resetSession.
 */
export async function suggestPlaces(
  query: string,
  sessionToken: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error('Google Places API key is missing.');
  }

  const q = query.trim();
  if (q.length < 2) return [];

  const body = {
    input: q,
    sessionToken,
    regionCode: 'GH',
    includedRegionCodes: ['gh'],
  };

  console.log('[google-places] autocomplete request', body);

  const res = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(
      `Address search failed (${res.status})${errBody ? `: ${errBody.slice(0, 200)}` : ''}`
    );
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };

  console.log(
    '[google-places] autocomplete response',
    (data.suggestions ?? []).map((s) => s.placePrediction?.text?.text)
  );

  const results: AddressSuggestion[] = [];
  for (const item of data.suggestions ?? []) {
    const prediction = item.placePrediction;
    if (!prediction?.placeId) continue;
    const label =
      prediction.structuredFormat?.mainText?.text || prediction.text?.text || 'Unknown place';
    const secondary = prediction.structuredFormat?.secondaryText?.text;
    results.push({ id: prediction.placeId, label, secondary });
  }
  return results;
}

/**
 * Fetches only `location` + `formattedAddress` — both Essentials-tier fields
 * (the cheapest Place Details SKU). Do not add fields like displayName,
 * rating, reviews, or photos here: any of those upgrades the whole call to
 * the Pro/Enterprise SKU. Must be called with the SAME sessionToken used for
 * the autocomplete requests that preceded it — that's what closes the
 * session for billing. The caller must then generate a fresh session token
 * for the next search (see usePickupSearch's resetSession).
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails | null> {
  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error('Google Places API key is missing.');
  }

  const params = new URLSearchParams({ sessionToken });
  const url = `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}?${params.toString()}`;
  console.log('[google-places] details request', { url, placeId });

  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'location,formattedAddress',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Could not retrieve that address (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`
    );
  }

  const data = (await res.json()) as {
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
  };

  console.log('[google-places] details response', data);

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return { location: { lat, lng }, formattedAddress: data.formattedAddress || '' };
}
