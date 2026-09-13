import { Platform } from 'react-native';

export type DeviceCoordinates = {
  lat: number;
  lng: number;
};

function isMissingNativeModule(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Cannot find native module 'ExpoLocation'") ||
    message.includes('Cannot find native module "ExpoLocation"') ||
    message.includes('ExpoLocation')
  );
}

function getBrowserCoordinates(): Promise<DeviceCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(error.message || 'Could not read current location.'));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
    );
  });
}

/** GPS only when the user has already granted permission — no prompt. */
export async function getGrantedDeviceCoordinates(): Promise<DeviceCoordinates | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const Location = await import('expo-location');
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch {
      const last = await Location.getLastKnownPositionAsync();
      if (!last) return null;
      return {
        lat: last.coords.latitude,
        lng: last.coords.longitude,
      };
    }
  } catch (error) {
    if (isMissingNativeModule(error)) return null;
    return null;
  }
}

/**
 * GPS for pickup-address capture. expo-location is loaded only when used so
 * an old customer native binary (without ExpoLocation linked) does not crash
 * the rest of Complete Profile.
 */
export async function getDeviceCoordinates(): Promise<DeviceCoordinates> {
  if (Platform.OS === 'web') {
    return getBrowserCoordinates();
  }

  try {
    const Location = await import('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('LOCATION_PERMISSION_DENIED');
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    if (isMissingNativeModule(error)) {
      throw new Error('NATIVE_MODULE_MISSING');
    }
    throw error;
  }
}
