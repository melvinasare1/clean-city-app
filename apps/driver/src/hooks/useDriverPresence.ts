import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from 'firebase/database';
import { rtdb } from '@platform/shared-firebase';

function presencePayload(online: boolean) {
  return {
    online,
    lastSeen: serverTimestamp(),
  };
}

function presenceNode(driverId: string) {
  return ref(rtdb, '/presence/' + driverId);
}

/**
 * Driver RTDB presence for `/presence/{driverId}`.
 * UI `isOnline` is always the live database value, not local-only state.
 */
export function useDriverPresence(driverId: string): {
  isOnline: boolean;
  goOnline: () => Promise<boolean>;
  goOffline: () => Promise<void>;
} {
  const [isOnline, setIsOnline] = useState(false);
  const wantOnlineRef = useRef(false);

  useEffect(() => {
    wantOnlineRef.current = false;
    if (!driverId) {
      setIsOnline(false);
      return;
    }

    const node = presenceNode(driverId);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubPresence = onValue(node, (snap) => {
      setIsOnline(snap.val()?.online === true);
    });

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return;
      if (!wantOnlineRef.current) return;

      onDisconnect(node)
        .set(presencePayload(false))
        .then(() => {
          if (!wantOnlineRef.current) return;
          return set(node, presencePayload(true));
        })
        .catch((error) => {
          console.error('[useDriverPresence] presence reconnect failed', error);
        });
    });

    return () => {
      unsubPresence();
      unsubConnected();
    };
  }, [driverId]);

  const goOnline = useCallback(async () => {
    if (!driverId) return false;

    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location required',
          'Turn on location access so we can show you on the map and match nearby jobs.'
        );
        return false;
      }
    }

    wantOnlineRef.current = true;
    const node = presenceNode(driverId);
    await onDisconnect(node).set(presencePayload(false));
    await set(node, presencePayload(true));
    return true;
  }, [driverId]);

  const goOffline = useCallback(async () => {
    if (!driverId) return;
    wantOnlineRef.current = false;
    const node = presenceNode(driverId);
    try {
      await onDisconnect(node).cancel();
    } catch {
      // Already disconnected — still write the offline state.
    }
    await set(node, presencePayload(false));
  }, [driverId]);

  return { isOnline, goOnline, goOffline };
}
