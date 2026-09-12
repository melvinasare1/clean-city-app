export type PickupCoordinates = {
  lat: number;
  lng: number;
};

type GeocodeHit = PickupCoordinates & {
  name?: string;
  featureType?: string;
};

/** Accra Central / Makola — not East Legon. */
const ACCRA_PROXIMITY = "-0.2070,5.5480";

function mapboxToken(): string {
  for (const value of [
    process.env.MAPBOX_ACCESS_TOKEN,
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
  ]) {
    if (typeof value === "string" && value.length > 0 && !value.includes("${")) {
      return value;
    }
  }
  return "";
}

export function parsePickupCoordinates(value: unknown): PickupCoordinates | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { lat?: unknown; lng?: unknown };
  const lat = typeof record.lat === "number" ? record.lat : Number(record.lat);
  const lng = typeof record.lng === "number" ? record.lng : Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function addressQueryFromJob(params: {
  location?: string | null;
  addressSnapshot?: { addressLine1?: string; area?: string } | null;
}): string {
  const parts = [
    params.addressSnapshot?.addressLine1,
    params.addressSnapshot?.area,
    params.location,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function extraQueryBeyondCity(query: string, name?: string): boolean {
  const q = query.toLowerCase().replace(/,/g, " ");
  const city = (name || "").toLowerCase();
  const remainder = q
    .replace(city, " ")
    .replace(/\bghana\b/g, " ")
    .replace(/\bgreater accra\b/g, " ")
    .replace(/\baccra\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return remainder.length > 0;
}

const GENERIC_GEO_TOKENS = new Set([
  "accra",
  "ghana",
  "greater",
  "west",
  "western",
  "east",
  "eastern",
  "central",
  "north",
  "south",
  "region",
  "district",
  "area",
  "city",
  "market",
]);

function significantTokens(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !GENERIC_GEO_TOKENS.has(word));
}

function featureMatchesQuery(query: string, featureName?: string): boolean {
  const queryTokens = significantTokens(query);
  if (queryTokens.length === 0) return true;
  const nameTokens = significantTokens(featureName || "");
  if (nameTokens.length === 0) return false;
  return nameTokens.some((token) => queryTokens.includes(token));
}

function isTooCoarse(query: string, hit: GeocodeHit | null): boolean {
  if (!hit) return true;
  const type = hit.featureType || "";
  if (type === "country" || type === "region") return true;
  if (type === "place" && extraQueryBeyondCity(query, hit.name)) return true;
  if (!featureMatchesQuery(query, hit.name)) return true;
  return false;
}

/**
 * Forward-geocode an address once so the result can be stored on the job.
 * Mapbox Geocoding v6 first (permanent); if it only returns a city/region
 * for a more specific query (e.g. "Makola Market, Accra" → Accra centroid),
 * fall back to Nominatim which has Ghana POIs Mapbox Geocoding v6 dropped.
 */
export async function geocodeAddressToPickup(
  address: string,
  options?: { country?: string }
): Promise<PickupCoordinates | null> {
  const query = address.trim();
  if (!query) return null;

  const mapbox = await geocodeMapbox(query, options);
  if (mapbox && !isTooCoarse(query, mapbox)) {
    return { lat: mapbox.lat, lng: mapbox.lng };
  }

  const nominatim = await geocodeNominatim(query);
  return nominatim ? { lat: nominatim.lat, lng: nominatim.lng } : null;
}

async function geocodeMapbox(
  address: string,
  options?: { country?: string }
): Promise<GeocodeHit | null> {
  const token = mapboxToken();
  if (!token) return null;

  const params = new URLSearchParams({
    q: address,
    access_token: token,
    permanent: "true",
    limit: "5",
    autocomplete: "false",
  });
  const country = options?.country ?? "gh";
  if (country) params.set("country", country);
  if (country === "gh") params.set("proximity", ACCRA_PROXIMITY);

  const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[geocodeAddressToPickup] Mapbox error", res.status, await res.text().catch(() => ""));
    return null;
  }

  const body = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: unknown };
      properties?: { name?: string; feature_type?: string; full_address?: string };
    }>;
  };

  for (const feature of body.features ?? []) {
    const coordinates = feature.geometry?.coordinates;
    const parsed = Array.isArray(coordinates)
      ? parsePickupCoordinates({ lng: coordinates[0], lat: coordinates[1] })
      : null;
    if (!parsed) continue;
    const hit: GeocodeHit = {
      ...parsed,
      name: feature.properties?.name,
      featureType: feature.properties?.feature_type,
    };
    if (!isTooCoarse(address, hit)) return hit;
  }
  return null;
}

async function geocodeNominatim(address: string): Promise<PickupCoordinates | null> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "gh",
    viewbox: "-0.35,5.75,-0.05,5.45",
    bounded: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": "CleanCity/1.0 (job-pickup-geocode)" },
  });
  if (!res.ok) {
    console.error("[geocodeAddressToPickup] Nominatim error", res.status);
    return null;
  }
  const body = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const first = body[0];
  if (!first) return null;
  return parsePickupCoordinates({ lat: first.lat, lng: first.lon });
}
