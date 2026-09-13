import { parsePickupCoordinates, type PickupCoordinates } from "./geocode-address";

export type GoogleGeocodeHit = PickupCoordinates & {
  formattedAddress: string;
};

const GEOCODE_TIMEOUT_MS = 8000;
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

// Google orders reverse-geocode results most-specific first. Only accept a
// result precise enough to be a pickup point — reject a bare locality/region/
// country hit (e.g. panning the map into open country resolving to "Accra").
const PREFERRED_REVERSE_TYPES = new Set([
  "street_address",
  "premise",
  "subpremise",
  "route",
  "plus_code",
  "neighborhood",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "establishment",
  "point_of_interest",
]);

function googleGeocodingApiKey(): string {
  const value = process.env.GOOGLE_GEOCODING_API_KEY;
  return typeof value === "string" && value.length > 0 ? value : "";
}

function fetchWithTimeout(url: string, timeoutMs = GEOCODE_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

type GoogleGeocodeResult = {
  formatted_address?: string;
  types?: string[];
  geometry?: { location?: { lat?: number; lng?: number } };
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
};

/**
 * Forward-geocode via the Google Geocoding API, restricted to Ghana.
 * Server-side only — GOOGLE_GEOCODING_API_KEY must never reach the client.
 */
export async function geocodeAddressGoogle(address: string): Promise<GoogleGeocodeHit | null> {
  const apiKey = googleGeocodingApiKey();
  const query = address.trim();
  if (!apiKey || !query) return null;

  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    region: "gh",
    components: "country:GH",
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(`${GEOCODE_BASE}?${params.toString()}`);
  } catch (err) {
    console.error("[geocodeAddressGoogle] request failed", err);
    return null;
  }
  if (!res.ok) {
    console.error("[geocodeAddressGoogle] Google error", res.status);
    return null;
  }

  const body = (await res.json()) as GoogleGeocodeResponse;
  if (body.status !== "OK") {
    if (body.status !== "ZERO_RESULTS") {
      console.error("[geocodeAddressGoogle] Google status", body.status);
    }
    return null;
  }

  const result = body.results?.[0];
  const parsed = parsePickupCoordinates({
    lat: result?.geometry?.location?.lat,
    lng: result?.geometry?.location?.lng,
  });
  if (!parsed) return null;

  return {
    ...parsed,
    formattedAddress: result?.formatted_address?.trim() || query,
  };
}

/**
 * Reverse-geocode via the Google Geocoding API for a pickup pin's address
 * label. Returned lat/lng are always the queried point, never the feature's
 * own centroid. Prefer a street-level result, but accept a neighborhood or
 * locality label in Ghana where Google often has no street_address.
 */
export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<GoogleGeocodeHit | null> {
  const apiKey = googleGeocodingApiKey();
  const queried = parsePickupCoordinates({ lat, lng });
  if (!apiKey || !queried) return null;

  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: apiKey,
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(`${GEOCODE_BASE}?${params.toString()}`);
  } catch (err) {
    console.error("[reverseGeocodeGoogle] request failed", err);
    return null;
  }
  if (!res.ok) {
    console.error("[reverseGeocodeGoogle] Google error", res.status);
    return null;
  }

  const body = (await res.json()) as GoogleGeocodeResponse;
  if (body.status !== "OK") {
    if (body.status !== "ZERO_RESULTS") {
      console.error("[reverseGeocodeGoogle] Google status", body.status);
    }
    return null;
  }

  const result =
    body.results?.find((candidate) =>
      (candidate.types ?? []).some((type) => PREFERRED_REVERSE_TYPES.has(type))
    ) ?? body.results?.find((candidate) => candidate.formatted_address?.trim());
  const formattedAddress = result?.formatted_address?.trim();
  if (!formattedAddress) return null;

  return {
    ...queried,
    formattedAddress,
  };
}
