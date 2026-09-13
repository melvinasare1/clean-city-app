import { Alert, Linking } from 'react-native';

export type NavigationProvider = 'google' | 'waze';

function googleMapsUrls(lat: number, lng: number) {
  return {
    native: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    web: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  };
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    Alert.alert('Could not open maps', 'Pickup location is missing.');
    return;
  }

  try {
    switch (provider) {
      case 'google': {
        const { native, web } = googleMapsUrls(lat, lng);

        let canOpenNative = false;
        try {
          canOpenNative = await Linking.canOpenURL(native);
        } catch (e) {
          console.log('[openNavigation] canOpenURL threw, falling back to web:', e);
          canOpenNative = false;
        }

        const urlToOpen = canOpenNative ? native : web;
        try {
          console.log('[openNavigation] openURL', { canOpenNative, urlToOpen });
          await Linking.openURL(urlToOpen);
        } catch (e) {
          console.log('[openNavigation] openURL failed:', e);
          throw e;
        }
        return;
      }
      case 'waze':
        Alert.alert('Could not open maps', 'Waze is not supported yet.');
        return;
      default:
        Alert.alert('Could not open maps', 'That navigation app is not supported yet.');
    }
  } catch (err) {
    console.warn('Failed to open navigation', err);
    Alert.alert('Could not open maps', 'Please open Google Maps and navigate to the pickup.');
  }
}
