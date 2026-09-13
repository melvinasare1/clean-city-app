import { getApiBaseUrl } from '@/lib/apiBase';
import {
  parsePickupCoordinates,
  type PickupCoordinates,
} from '@/lib/profile-location';

type GeocodeHit = PickupCoordinates & {
  address: string;
  name?: string;
};

const GEOCODE_TIMEOUT_MS = 8000;

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = GEOCODE_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

type GeocodeApiResponse = {
  lat?: number;
  lng?: number;
  formattedAddress?: string;
};

/**
 * Forward-geocode via our backend's Google Geocoding proxy (restricted to
 * Ghana server-side). Used only as a cold-start fallback when a typed
 * address has no GPS fix and no saved location yet — the search bar itself
 * stays on Places Autocomplete.
 */
export async function geocodeAddress(address: string): Promise<GeocodeHit | null> {
  const query = address.trim();
  if (!query) return null;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${getApiBaseUrl()}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: query }),
    });
  } catch (err) {
    console.error('[geocodeAddress] request failed', err);
    return null;
  }
  if (!res.ok) {
    console.error('[geocodeAddress] backend error', res.status);
    return null;
  }

  const body = (await res.json()) as GeocodeApiResponse;
  const parsed = parsePickupCoordinates({ lat: body.lat, lng: body.lng });
  if (!parsed) return null;

  return {
    ...parsed,
    address: body.formattedAddress?.trim() || query,
  };
}

/**
 * Reverse-geocode via our backend's Google Geocoding proxy for the pickup
 * pin's live address label. Returned lat/lng are always the queried point,
 * never the feature's own centroid.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeHit | null> {
  const queried = parsePickupCoordinates({ lat, lng });
  if (!queried) return null;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${getApiBaseUrl()}/api/geocode/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
  } catch (err) {
    console.error('[reverseGeocode] request failed', err);
    return null;
  }
  if (!res.ok) {
    console.error('[reverseGeocode] backend error', res.status);
    return null;
  }

  const body = (await res.json()) as GeocodeApiResponse;
  const address = body.formattedAddress?.trim();
  if (!address) return null;

  return {
    ...queried,
    address,
  };
}
