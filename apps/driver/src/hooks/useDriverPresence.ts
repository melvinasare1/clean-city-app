import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  get,
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set,
} from 'firebase/database';
import { rtdb } from '@platform/shared-firebase';
import {
  endOpenDriverShiftSessions,
  startDriverShiftSession,
} from '@/lib/driver-shift-session';

function presencePayload(online: boolean) {
  return {
    online,
    lastSeen: rtdbServerTimestamp(),
  };
}

function presenceNode(driverId: string) {
  return ref(rtdb, '/presence/' + driverId);
}

function lastSeenFromPresence(val: { lastSeen?: unknown } | null): Date {
  return typeof val?.lastSeen === 'number' ? new Date(val.lastSeen) : new Date();
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
      const val = snap.val() as { online?: boolean } | null;
      setIsOnline(val?.online === true);
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

    const node = presenceNode(driverId);
    try {
      const snap = await get(node);
      const val = snap.val() as { lastSeen?: unknown } | null;
      await endOpenDriverShiftSessions(driverId, lastSeenFromPresence(val));
    } catch (error) {
      console.warn('[useDriverPresence] leftover session close failed', error);
    }

    wantOnlineRef.current = true;
    await onDisconnect(node).set(presencePayload(false));
    await set(node, presencePayload(true));
    try {
      await startDriverShiftSession(driverId);
    } catch (error) {
      console.error('[useDriverPresence] shift session start failed', error);
    }
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
    try {
      await endOpenDriverShiftSessions(driverId);
    } catch (error) {
      console.error('[useDriverPresence] shift session end failed', error);
    }
  }, [driverId]);

  return { isOnline, goOnline, goOffline };
}
