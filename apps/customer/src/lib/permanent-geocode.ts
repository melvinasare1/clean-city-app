import { resolveMapboxToken } from '@/lib/mapbox-access-token';
import {
  parsePickupCoordinates,
  type PickupCoordinates,
} from '@/lib/profile-location';

type GeocodeHit = PickupCoordinates & {
  address: string;
  name?: string;
  featureType?: string;
};

const ACCRA_PROXIMITY = '-0.2070,5.5480';
const GEOCODE_TIMEOUT_MS = 8000;

const PRECISE_REVERSE_TYPES = new Set(['address', 'street', 'poi']);

function fetchWithTimeout(url: string, timeoutMs = GEOCODE_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function featureAddress(properties?: {
  name?: string;
  full_address?: string;
  place_formatted?: string;
}): string {
  return (
    properties?.full_address?.trim() ||
    [properties?.name, properties?.place_formatted].filter(Boolean).join(', ').trim() ||
    properties?.name?.trim() ||
    ''
  );
}

/**
 * Forward-geocode with Mapbox Geocoding v6 permanent=true, same contract as
 * job creation (`api/lib/geocode-address.ts`). Results are licensed for storage.
 */
export async function geocodeAddressPermanent(
  address: string
): Promise<GeocodeHit | null> {
  const token = resolveMapboxToken();
  const query = address.trim();
  if (!token || !query) return null;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    permanent: 'true',
    limit: '5',
    autocomplete: 'false',
    country: 'gh',
    proximity: ACCRA_PROXIMITY,
  });

  const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url);
  } catch (err) {
    console.error('[geocodeAddressPermanent] request failed', err);
    return null;
  }
  if (!res.ok) {
    console.error('[geocodeAddressPermanent] Mapbox error', res.status);
    return null;
  }

  const body = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: unknown };
      properties?: {
        name?: string;
        feature_type?: string;
        full_address?: string;
        place_formatted?: string;
      };
    }>;
  };

  for (const feature of body.features ?? []) {
    const coordinates = feature.geometry?.coordinates;
    const parsed = Array.isArray(coordinates)
      ? parsePickupCoordinates({ lng: coordinates[0], lat: coordinates[1] })
      : null;
    if (!parsed) continue;
    const addressText = featureAddress(feature.properties) || query;
    return {
      ...parsed,
      address: addressText,
      name: feature.properties?.name,
      featureType: feature.properties?.feature_type,
    };
  }
  return null;
}

/**
 * Reverse-geocode with Mapbox Geocoding v6 permanent=true for a display label.
 * Requests address/street only so city/place features like "Accra" are not
 * accepted. v6 has no POI type; street covers names such as Independence Ave.
 * Returned lat/lng are the queried point, never the feature centroid.
 */
export async function reverseGeocodePermanent(
  lat: number,
  lng: number
): Promise<GeocodeHit | null> {
  const token = resolveMapboxToken();
  const queried = parsePickupCoordinates({ lat, lng });
  if (!token || !queried) return null;

  const request = async (types: string) => {
    const params = new URLSearchParams({
      longitude: String(lng),
      latitude: String(lat),
      access_token: token,
      permanent: 'true',
      limit: '1',
      country: 'gh',
      types,
    });
    return fetchWithTimeout(
      `https://api.mapbox.com/search/geocode/v6/reverse?${params.toString()}`
    );
  };

  let res: Response;
  try {
    res = await request('address,street');
    if (!res.ok) res = await request('address');
  } catch (err) {
    console.error('[reverseGeocodePermanent] request failed', err);
    return null;
  }
  if (!res.ok) {
    console.error('[reverseGeocodePermanent] Mapbox error', res.status);
    return null;
  }

  const body = (await res.json()) as {
    features?: Array<{
      properties?: {
        name?: string;
        feature_type?: string;
        full_address?: string;
        place_formatted?: string;
      };
    }>;
  };

  const feature = body.features?.[0];
  const featureType = feature?.properties?.feature_type;
  if (!featureType || !PRECISE_REVERSE_TYPES.has(featureType)) return null;

  const address = featureAddress(feature?.properties);
  if (!address) return null;

  return {
    ...queried,
    address,
    name: feature?.properties?.name,
    featureType,
  };
}
