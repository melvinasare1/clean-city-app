import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  db,
  auth,
} from '@platform/shared-firebase';
import type { Timestamp } from '@platform/shared-firebase';
import { useDriverApproved } from '@/hooks/useDriverApproved';

export type JobOffer = {
  id: string;
  customerName?: string;
  address?: string;
  scheduledDate?: Timestamp | string;
  amountPaid?: number;
  totalPrice?: number;
  subscriptionId?: string | null;
};

/**
 * Listens for the current driver's next booking sitting in `assigned`
 * (i.e. picked by admin, awaiting the driver's accept/decline).
 * Only runs after the driver is approved; Firestore rules allow that query.
 */
export function useAssignedJobOffer() {
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const { isApproved } = useDriverApproved();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isApproved) {
      setOffer(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bookings'),
      where('driverId', '==', uid),
      where('status', '==', 'assigned'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setOffer(null);
        } else {
          // Take the first pending offer. If a driver could somehow have more
          // than one, surface them one at a time rather than stacking sheets.
          const docSnap = snapshot.docs[0];
          setOffer({ id: docSnap.id, ...(docSnap.data() as Omit<JobOffer, 'id'>) });
        }
        setLoading(false);
      },
      (err) => {
        console.error('useAssignedJobOffer listener error', err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [isApproved]);

  const accept = useCallback(async (bookingId: string) => {
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    });
  }, []);

  const decline = useCallback(async (bookingId: string) => {
    const uid = auth.currentUser?.uid;
    await updateDoc(doc(db, 'bookings', bookingId), {
      driverId: null,
      driverName: null,
      status: 'pending',
      updatedAt: serverTimestamp(),
      ...(uid ? { declinedBy: arrayUnion(uid) } : {}),
    });
  }, []);

  return { offer, loading, accept, decline };
}
