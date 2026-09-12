import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set,
} from 'firebase/database';
import {
  addDoc,
  collection,
  db,
  doc,
  getDocs,
  limit,
  query,
  rtdb,
  serverTimestamp,
  updateDoc,
  where,
} from '@platform/shared-firebase';

const SHIFT_SESSIONS_COLLECTION = 'driverShiftSessions';
const openSessionByDriver = new Map<string, string>();

function presencePayload(online: boolean) {
  return {
    online,
    lastSeen: rtdbServerTimestamp(),
  };
}

function presenceNode(driverId: string) {
  return ref(rtdb, '/presence/' + driverId);
}

async function startShiftSession(driverId: string) {
  const sessionRef = await addDoc(collection(db, SHIFT_SESSIONS_COLLECTION), {
    driverId,
    startedAt: serverTimestamp(),
    endedAt: null,
  });
  openSessionByDriver.set(driverId, sessionRef.id);
}

async function endShiftSession(driverId: string) {
  const knownId = openSessionByDriver.get(driverId);
  if (knownId) {
    await updateDoc(doc(db, SHIFT_SESSIONS_COLLECTION, knownId), {
      endedAt: serverTimestamp(),
    });
    openSessionByDriver.delete(driverId);
    return;
  }

  const openSessions = await getDocs(
    query(
      collection(db, SHIFT_SESSIONS_COLLECTION),
      where('driverId', '==', driverId),
      where('endedAt', '==', null),
      limit(5)
    )
  );
  await Promise.all(
    openSessions.docs.map((sessionDoc) =>
      updateDoc(sessionDoc.ref, { endedAt: serverTimestamp() })
    )
  );
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
    try {
      await startShiftSession(driverId);
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
      await endShiftSession(driverId);
    } catch (error) {
      console.error('[useDriverPresence] shift session end failed', error);
    }
  }, [driverId]);

  return { isOnline, goOnline, goOffline };
}
