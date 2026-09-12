import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '@platform/shared-firebase';

const LOCATION_INTERVAL_MS = 8_000;

type PresencePayload = {
  online: boolean;
  lastSeen: ReturnType<typeof serverTimestamp>;
};

function presenceRef(driverId: string) {
  return ref(rtdb, `presence/${driverId}`);
}

function locationRef(driverId: string) {
  return ref(rtdb, `locations/${driverId}`);
}

function presencePayload(online: boolean): PresencePayload {
  return {
    online,
    lastSeen: serverTimestamp(),
  };
}

/**
 * Marks the driver online and registers onDisconnect so a crash or dropped
 * connection writes { online: false, lastSeen: serverTimestamp }.
 */
export function startDriverPresence(driverId: string): Unsubscribe {
  const node = presenceRef(driverId);
  const connectedRef = ref(rtdb, '.info/connected');
  let active = true;

  const unsubscribe = onValue(connectedRef, (snap) => {
    if (!active || snap.val() !== true) return;

    onDisconnect(node)
      .set(presencePayload(false))
      .then(() => {
        if (!active) return;
        return set(node, presencePayload(true));
      })
      .catch((error) => {
        if (active) {
          console.error('[driver-realtime] presence start failed', error);
        }
      });
  });

  return () => {
    active = false;
    unsubscribe();
  };
}

export async function stopDriverPresence(driverId: string): Promise<void> {
  const node = presenceRef(driverId);
  try {
    await onDisconnect(node).cancel();
  } catch {
    // Already disconnected — still try to write the offline state.
  }
  try {
    await set(node, presencePayload(false));
  } catch (error) {
    console.error('[driver-realtime] presence stop failed', error);
  }
}

async function writeCurrentLocation(driverId: string): Promise<void> {
  if (Platform.OS !== 'web') {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  await set(locationRef(driverId), {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Writes lat/lng to RTDB on a fixed interval while the driver is online.
 * Location is not written to Firestore.
 */
export function startDriverLocationUpdates(driverId: string): () => void {
  let stopped = false;

  const tick = () => {
    writeCurrentLocation(driverId).catch((error) => {
      if (!stopped) {
        console.error('[driver-realtime] location write failed', error);
      }
    });
  };

  tick();
  const timer = setInterval(tick, LOCATION_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
