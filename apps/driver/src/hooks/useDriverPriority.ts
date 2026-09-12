import { useEffect, useState } from 'react';
import { doc, onSnapshot, db } from '@platform/shared-firebase';

const DEFAULT_PRIORITY = 100;

function clampPriority(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_PRIORITY;
  return Math.min(100, Math.max(0, n));
}

/**
 * Live drivers/{uid}.priority (0–100). Missing values read as 100.
 */
export function useDriverPriority(driverId: string): number {
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);

  useEffect(() => {
    if (!driverId) {
      setPriority(DEFAULT_PRIORITY);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'drivers', driverId),
      (snap) => {
        setPriority(clampPriority(snap.data()?.priority));
      },
      (error) => {
        console.error('[useDriverPriority] listener failed', error);
      }
    );
    return unsub;
  }, [driverId]);

  return priority;
}
