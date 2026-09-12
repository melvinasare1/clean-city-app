export type PickupCoordinates = {
  lat: number;
  lng: number;
};

const ACCRA_PROXIMITY = "-0.1870,5.6037";

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

/**
 * Forward-geocode an address once via Mapbox Geocoding v6 (permanent)
 * so the result can be stored on the job document.
 */
export async function geocodeAddressToPickup(
  address: string,
  options?: { country?: string }
): Promise<PickupCoordinates | null> {
  const first = await geocodeOnce(address, options);
  if (first) return first;
  if (options?.country === "") return null;
  return geocodeOnce(address, { country: "" });
}

async function geocodeOnce(
  address: string,
  options?: { country?: string }
): Promise<PickupCoordinates | null> {
  const query = address.trim();
  const token = mapboxToken();
  if (!query || !token) return null;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    permanent: "true",
    limit: "1",
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
    features?: Array<{ geometry?: { coordinates?: unknown } }>;
  };
  const coordinates = body.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  return parsePickupCoordinates({ lng: coordinates[0], lat: coordinates[1] });
}
