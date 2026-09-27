import { Alert, Linking, Platform } from 'react-native';
import { getApiBaseUrl } from '@/lib/apiBase';

export type NavigationProvider = 'google' | 'waze';

export type NavigationDestination = {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
};

const ADDRESS_UNAVAILABLE =
  'Address unavailable, contact the customer';

function hasCoords(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function usableAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.replace(/[^a-zA-Z0-9]/g, '').length < 3) return null;
  return trimmed;
}

/**
 * Coordinates on success, 'not_found' when the backend says the address has no
 * usable match (404, including country/region-only results), null on any other
 * failure (network, 5xx) where handing the raw address to maps is still worth it.
 */
async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | 'not_found' | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      lat?: unknown;
      lng?: unknown;
      error?: unknown;
      details?: unknown;
    };
    if (!res.ok) {
      console.log(
        '[openNavigation] geocode failed',
        res.status,
        body.error ?? body.details ?? ''
      );
      return res.status === 404 ? 'not_found' : null;
    }
    if (hasCoords(body.lat, body.lng)) {
      return { lat: body.lat, lng: body.lng as number };
    }
    return null;
  } catch (e) {
    console.log('[openNavigation] geocode error', e);
    return null;
  }
}

async function resolveQuery(dest: NavigationDestination): Promise<string | null> {
  if (hasCoords(dest.lat, dest.lng)) {
    return `${dest.lat},${dest.lng}`;
  }

  const address = usableAddress(dest.address);
  if (!address) return null;

  const geocoded = await geocodeAddress(address);
  if (geocoded === 'not_found') return null;
  if (geocoded) {
    return `${geocoded.lat},${geocoded.lng}`;
  }
  // Geocoding failed but we still have an address string — open maps with it.
  return address;
}

function googleMapsUrls(query: string) {
  const encoded = encodeURIComponent(query);
  return {
    native: `comgooglemaps://?daddr=${encoded}&directionsmode=driving`,
    web: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
    apple: `maps://?daddr=${encoded}&dirflg=d`,
    geo: query.includes(',') ? `geo:${query}?q=${encoded}` : `geo:0,0?q=${encoded}`,
  };
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (e) {
    console.log('[openNavigation] openURL failed', url, e);
    return false;
  }
}

/**
 * Launch turn-by-turn navigation. Extra providers (e.g. Waze) should be
 * added as branches here rather than rewriting call sites.
 */
export async function openNavigation(
  lat: number,
  lng: number,
  provider: NavigationProvider = 'google',
): Promise<void> {
  return openNavigationTo({ lat, lng }, provider);
}

export async function openNavigationTo(
  dest: NavigationDestination,
  provider: NavigationProvider = 'google',
): Promise<void> {
  const query = await resolveQuery(dest);
  if (!query) {
    Alert.alert('Could not open maps', ADDRESS_UNAVAILABLE);
    return;
  }

  if (provider === 'waze') {
    Alert.alert('Could not open maps', 'Waze is not supported yet.');
    return;
  }

  const { native, web, apple, geo } = googleMapsUrls(query);

  try {
    let canOpenNative = false;
    try {
      canOpenNative = await Linking.canOpenURL(native);
    } catch (e) {
      console.log('[openNavigation] canOpenURL threw, falling back:', e);
    }

    if (canOpenNative && (await tryOpen(native))) return;
    if (await tryOpen(web)) return;
    if (Platform.OS === 'ios' && (await tryOpen(apple))) return;
    if (await tryOpen(geo)) return;

    Alert.alert('Could not open maps', ADDRESS_UNAVAILABLE);
  } catch (err) {
    console.warn('Failed to open navigation', err);
    Alert.alert('Could not open maps', ADDRESS_UNAVAILABLE);
  }
}
