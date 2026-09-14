import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  onDisconnect,
  ref,
  remove,
  serverTimestamp,
  set,
} from 'firebase/database';
import { rtdb } from '@platform/shared-firebase';

export const DRIVER_LOCATION_TASK = 'clean-city-driver-location';

const CONSENT_KEY = 'driver.backgroundLocationConsent.v1';
const TRACKING_DRIVER_KEY = 'driver.backgroundLocation.driverId';

const LOCATION_INTERVAL_MS = 8_000;

export const BACKGROUND_LOCATION_ALWAYS_MESSAGE =
  'Clean City Driver uses your location in the background only while you are online so dispatch can see nearby available drivers and assign jobs. Location sharing stops when you go offline.';

export const BACKGROUND_LOCATION_WHEN_IN_USE_MESSAGE =
  'Clean City uses your location while you use the app to show you on the map and match you with nearby jobs.';

export function driverLocationNode(driverId: string) {
  return ref(rtdb, '/driverLocations/' + driverId);
}

export async function hasAcknowledgedBackgroundLocation(): Promise<boolean> {
  const value = await AsyncStorage.getItem(CONSENT_KEY);
  return value === '1';
}

export async function acknowledgeBackgroundLocation(): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, '1');
}

let resumeOnlineAfterConsent = false;

export function markResumeOnlineAfterConsent(): void {
  resumeOnlineAfterConsent = true;
}

export function consumeResumeOnlineAfterConsent(): boolean {
  const next = resumeOnlineAfterConsent;
  resumeOnlineAfterConsent = false;
  return next;
}

export async function requestOnlineLocationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    Alert.alert(
      'Location required',
      'Turn on location access so we can show you on the map and match nearby jobs.'
    );
    return false;
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status === 'granted') return true;

  Alert.alert(
    'Background location required',
    'Dispatch needs your location while you are online, including when the app is in the background. Enable Always / Allow all the time in Settings, then go online again.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]
  );
  return false;
}

export async function getTrackedDriverId(): Promise<string | null> {
  return AsyncStorage.getItem(TRACKING_DRIVER_KEY);
}

export async function writeDriverLocation(
  driverId: string,
  lat: number,
  lng: number
): Promise<void> {
  await set(driverLocationNode(driverId), {
    lat,
    lng,
    updatedAt: serverTimestamp(),
  });
}

export async function registerLocationOnDisconnect(driverId: string): Promise<void> {
  await onDisconnect(driverLocationNode(driverId)).remove();
}

export async function clearDriverLocation(driverId: string): Promise<void> {
  const node = driverLocationNode(driverId);
  try {
    await onDisconnect(node).cancel();
  } catch {
    // Already disconnected — still remove the node.
  }
  try {
    await remove(node);
  } catch (error) {
    console.error('[driver-background-location] location clear failed', error);
  }
}

export async function startDriverBackgroundLocation(driverId: string): Promise<void> {
  if (Platform.OS === 'web' || !driverId) return;

  await AsyncStorage.setItem(TRACKING_DRIVER_KEY, driverId);
  await registerLocationOnDisconnect(driverId);

  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (!started) {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_INTERVAL_MS,
      distanceInterval: 0,
      deferredUpdatesInterval: LOCATION_INTERVAL_MS,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: "CleanCity — tracking your location while you're online",
        notificationBody:
          'Dispatch can see your location so you can receive nearby jobs. Go offline to stop.',
        notificationColor: '#1C5A3B',
        killServiceOnDestroy: true,
      },
    });
  }

  try {
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));
    if (position) {
      await writeDriverLocation(
        driverId,
        position.coords.latitude,
        position.coords.longitude
      );
    }
  } catch (error) {
    console.warn('[driver-background-location] initial location write skipped', error);
  }
}

export async function stopDriverBackgroundLocation(driverId: string): Promise<void> {
  const trackedId = driverId || (await getTrackedDriverId()) || '';

  if (Platform.OS !== 'web') {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
      if (started) {
        await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
      }
    } catch (error) {
      console.warn('[driver-background-location] stop task failed', error);
    }
  }

  await AsyncStorage.removeItem(TRACKING_DRIVER_KEY);
  if (trackedId) {
    await clearDriverLocation(trackedId);
  }
}

export async function isDriverBackgroundLocationActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } catch {
    return false;
  }
}
