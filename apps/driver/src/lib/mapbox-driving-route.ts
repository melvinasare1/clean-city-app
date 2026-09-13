export type LngLat = [number, number];

export type DrivingRouteGeometry = {
  type: 'LineString';
  coordinates: LngLat[];
};

export type DrivingRouteResult = {
  geometry: DrivingRouteGeometry;
  distanceMeters: number;
  durationSeconds: number;
  source: 'directions' | 'straight-line';
};

const FALLBACK_SPEED_MPS = 30_000 / 3_600;

export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatAwayLabel(distanceMeters: number, durationSeconds: number): string {
  const km = Math.max(0, distanceMeters) / 1000;
  const kmText = km < 10 ? km.toFixed(1) : String(Math.round(km));
  const mins = Math.max(1, Math.round(Math.max(0, durationSeconds) / 60));
  return `${kmText} km · ${mins} mins away`;
}

export function straightLineFallback(driver: LngLat, pickup: LngLat): DrivingRouteResult {
  const distanceMeters = haversineMeters(driver, pickup);
  return {
    geometry: {
      type: 'LineString',
      coordinates: [driver, pickup],
    },
    distanceMeters,
    durationSeconds: distanceMeters / FALLBACK_SPEED_MPS,
    source: 'straight-line',
  };
}

type DirectionsResponse = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
};

function parseLineString(raw: unknown): DrivingRouteGeometry | null {
  if (!raw || typeof raw !== 'object') return null;
  const geometry = raw as { type?: string; coordinates?: unknown };
  if (geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null;
  const coordinates: LngLat[] = [];
  for (const pair of geometry.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    coordinates.push([lng, lat]);
  }
  if (coordinates.length < 2) return null;
  return { type: 'LineString', coordinates };
}

export async function fetchMapboxDrivingRoute(
  driver: LngLat,
  pickup: LngLat,
  accessToken: string,
  signal?: AbortSignal
): Promise<DrivingRouteResult | null> {
  if (!accessToken) return null;
  const path = `${driver[0]},${driver[1]};${pickup[0]},${pickup[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${path}` +
    `?geometries=geojson&access_token=${encodeURIComponent(accessToken)}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const json = (await response.json()) as DirectionsResponse;
    if (json.code !== 'Ok') return null;
    const route = json.routes?.[0];
    const geometry = parseLineString(route?.geometry);
    const distanceMeters = Number(route?.distance);
    const durationSeconds = Number(route?.duration);
    if (!geometry || !Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
      return null;
    }
    return {
      geometry,
      distanceMeters,
      durationSeconds,
      source: 'directions',
    };
  } catch {
    return null;
  }
}
