import { Alert, Linking, Platform } from 'react-native';

export type NavigationProvider = 'google' | 'waze';

export type NavigationDestination = {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
};

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

function destinationQuery(dest: NavigationDestination): string | null {
  if (hasCoords(dest.lat, dest.lng)) {
    return `${dest.lat},${dest.lng}`;
  }
  const address = dest.address?.trim();
  return address || null;
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
  const query = destinationQuery(dest);
  if (!query) {
    Alert.alert('Could not open maps', 'Pickup location is missing.');
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

    Alert.alert('Could not open maps', 'Please open Google Maps and navigate to the pickup.');
  } catch (err) {
    console.warn('Failed to open navigation', err);
    Alert.alert('Could not open maps', 'Please open Google Maps and navigate to the pickup.');
  }
}
