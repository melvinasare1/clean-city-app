import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
import {
  hasAcknowledgedBackgroundLocation,
  isDriverBackgroundLocationActive,
  registerLocationOnDisconnect,
  requestOnlineLocationPermissions,
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from '@/lib/driver-background-location';

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

/** Clears background GPS and RTDB presence. Safe to call from logout (no hook). */
export async function setDriverOffline(driverId: string): Promise<void> {
  if (!driverId) return;
  await stopDriverBackgroundLocation(driverId);
  const node = presenceNode(driverId);
  try {
    await onDisconnect(node).cancel();
  } catch {
    // Already disconnected — still write the offline state.
  }
  await set(node, presencePayload(false));
}

/**
 * Driver RTDB presence for `/presence/{driverId}`.
 * UI `isOnline` is always the live database value, not local-only state.
 */
export function useDriverPresence(driverId: string): {
  isOnline: boolean;
  isSharingLocation: boolean;
  goOnline: () => Promise<boolean>;
  goOffline: () => Promise<void>;
} {
  const [isOnline, setIsOnline] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const wantOnlineRef = useRef(false);

  const refreshSharing = useCallback(async () => {
    const active = await isDriverBackgroundLocationActive();
    setIsSharingLocation(active);
  }, []);

  useEffect(() => {
    wantOnlineRef.current = false;
    if (!driverId) {
      setIsOnline(false);
      setIsSharingLocation(false);
      void stopDriverBackgroundLocation('').finally(() => {
        setIsSharingLocation(false);
      });
      return;
    }

    const node = presenceNode(driverId);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubPresence = onValue(node, (snap) => {
      const val = snap.val() as { online?: boolean } | null;
      const online = val?.online === true;
      setIsOnline(online);
      if (!online && !wantOnlineRef.current) {
        void stopDriverBackgroundLocation(driverId).finally(() => {
          void refreshSharing();
        });
        return;
      }
      void refreshSharing();
    });

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return;
      if (!wantOnlineRef.current) return;

      onDisconnect(node)
        .set(presencePayload(false))
        .then(() => registerLocationOnDisconnect(driverId))
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
  }, [driverId, refreshSharing]);

  const goOnline = useCallback(async () => {
    if (!driverId) return false;

    if (Platform.OS !== 'web') {
      const consented = await hasAcknowledgedBackgroundLocation();
      if (!consented) return false;

      const permitted = await requestOnlineLocationPermissions();
      if (!permitted) return false;
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
    try {
      await startDriverBackgroundLocation(driverId);
      await refreshSharing();
      await onDisconnect(node).set(presencePayload(false));
      await set(node, presencePayload(true));
    } catch (error) {
      wantOnlineRef.current = false;
      await stopDriverBackgroundLocation(driverId);
      await refreshSharing();
      throw error;
    }
    try {
      await startDriverShiftSession(driverId);
    } catch (error) {
      console.error('[useDriverPresence] shift session start failed', error);
    }
    return true;
  }, [driverId, refreshSharing]);

  const goOffline = useCallback(async () => {
    if (!driverId) return;
    wantOnlineRef.current = false;
    await setDriverOffline(driverId);
    await refreshSharing();
    try {
      await endOpenDriverShiftSessions(driverId);
    } catch (error) {
      console.error('[useDriverPresence] shift session end failed', error);
    }
  }, [driverId, refreshSharing]);

  return { isOnline, isSharingLocation, goOnline, goOffline };
}
