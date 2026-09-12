import { useEffect, useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  onSnapshot,
  db,
  auth,
  functions,
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
  offerExpiresAt?: Timestamp | Date | string | number | null;
};

export type ActiveTrip = JobOffer;

const acceptJobOfferFn = httpsCallable<{ bookingId: string }, { ok: boolean }>(
  functions,
  'acceptJobOffer'
);
const declineJobOfferFn = httpsCallable<{ bookingId: string }, { ok: boolean }>(
  functions,
  'declineJobOffer'
);
const completeBookingFn = httpsCallable<{ bookingId: string }, { ok: boolean }>(
  functions,
  'completeBooking'
);
const cancelAcceptedJobFn = httpsCallable<{ bookingId: string }, { ok: boolean }>(
  functions,
  'cancelAcceptedJob'
);

function mapBookingDoc(id: string, data: Omit<JobOffer, 'id'>): JobOffer {
  return { id, ...data };
}

/**
 * Listens for the current driver's assigned offer and in-progress trip.
 * Status transitions are server-enforced via callables.
 */
export function useAssignedJobOffer() {
  const [offer, setOffer] = useState<JobOffer | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const { isApproved } = useDriverApproved();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isApproved) {
      setOffer(null);
      setActiveTrip(null);
      setLoading(false);
      return;
    }

    let offerReady = false;
    let tripReady = false;
    const markReady = () => {
      if (offerReady && tripReady) setLoading(false);
    };

    const unsubOffer = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('driverId', '==', uid),
        where('status', '==', 'assigned'),
      ),
      (snapshot) => {
        if (snapshot.empty) {
          setOffer(null);
        } else {
          const docSnap = snapshot.docs[0];
          setOffer(mapBookingDoc(docSnap.id, docSnap.data() as Omit<JobOffer, 'id'>));
        }
        offerReady = true;
        markReady();
      },
      (err) => {
        console.error('useAssignedJobOffer listener error', err);
        offerReady = true;
        markReady();
      },
    );

    const unsubTrip = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('driverId', '==', uid),
        where('status', '==', 'in_progress'),
      ),
      (snapshot) => {
        if (snapshot.empty) {
          setActiveTrip(null);
        } else {
          const docSnap = snapshot.docs[0];
          setActiveTrip(mapBookingDoc(docSnap.id, docSnap.data() as Omit<JobOffer, 'id'>));
        }
        tripReady = true;
        markReady();
      },
      (err) => {
        console.error('useAssignedJobOffer in-progress listener error', err);
        tripReady = true;
        markReady();
      },
    );

    return () => {
      unsubOffer();
      unsubTrip();
    };
  }, [isApproved]);

  const accept = useCallback(async (bookingId: string) => {
    await acceptJobOfferFn({ bookingId });
  }, []);

  const decline = useCallback(async (bookingId: string) => {
    await declineJobOfferFn({ bookingId });
  }, []);

  const complete = useCallback(async (bookingId: string) => {
    await completeBookingFn({ bookingId });
  }, []);

  const cancel = useCallback(async (bookingId: string) => {
    await cancelAcceptedJobFn({ bookingId });
  }, []);

  return { offer, activeTrip, loading, accept, decline, complete, cancel };
}
