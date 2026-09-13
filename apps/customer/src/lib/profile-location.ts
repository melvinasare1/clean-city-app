export type PickupCoordinates = {
  lat: number;
  lng: number;
};

/** City-level pin start when search/GPS has no precise coordinate. */
export const GHANA_FALLBACK_CENTER: PickupCoordinates = {
  lat: 5.548,
  lng: -0.207,
};

export function parsePickupCoordinates(value: unknown): PickupCoordinates | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { lat?: unknown; lng?: unknown };
  const lat = typeof record.lat === 'number' ? record.lat : Number(record.lat);
  const lng = typeof record.lng === 'number' ? record.lng : Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function pickupAddressText(user: {
  address?: string | null;
}): string {
  return typeof user.address === 'string' ? user.address.trim() : '';
}

export function resolveProfileAddress(data: {
  address?: unknown;
  location?: unknown;
}): string | undefined {
  if (typeof data.address === 'string' && data.address.trim()) {
    return data.address.trim();
  }
  if (typeof data.location === 'string' && data.location.trim()) {
    return data.location.trim();
  }
  return undefined;
}
