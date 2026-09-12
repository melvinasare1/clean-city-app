import { useEffect } from 'react';
import {
  startDriverLocationUpdates,
  startDriverPresence,
  stopDriverPresence,
} from '@/lib/driver-realtime';

/**
 * While the driver is on shift, keep RTDB presence + live location in sync.
 * Firestore booking / profile / accept-decline paths are untouched.
 */
export function useDriverRealtime(driverId: string, isOnline: boolean) {
  useEffect(() => {
    if (!driverId || !isOnline) return;

    const stopPresenceListener = startDriverPresence(driverId);
    const stopLocation = startDriverLocationUpdates(driverId);

    return () => {
      stopPresenceListener();
      stopLocation();
      void stopDriverPresence(driverId);
    };
  }, [driverId, isOnline]);
}
