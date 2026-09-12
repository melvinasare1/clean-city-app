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
  assignmentStatus?: string;
  jobStatus?: string;
  pickup?: { lat: number; lng: number } | null;
};

export type ActiveTrip = JobOffer;

const acceptJobOfferFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'acceptJobOffer'
);
const declineJobOfferFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'declineJobOffer'
);
const completeJobFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'completeJob'
);
const cancelAcceptedJobFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'cancelAcceptedJob'
);

type JobDoc = {
  customerName?: string;
  location?: string;
  addressSnapshot?: { addressLine1?: string };
  scheduledDate?: Timestamp | string;
  items?: Array<{ totalPrice?: number }>;
  subscriptionId?: string | null;
  offerExpiresAt?: Timestamp | Date | string | number | null;
  assignmentStatus?: string;
  jobStatus?: string;
  pickup?: { lat?: number; lng?: number };
};

function fareFromItems(items: JobDoc['items']): number | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const sum = items.reduce((acc, item) => acc + Number(item?.totalPrice ?? 0), 0);
  return Number.isFinite(sum) ? sum : undefined;
}

function parsePickup(value: JobDoc['pickup']): JobOffer['pickup'] {
  const lat = typeof value?.lat === 'number' ? value.lat : Number(value?.lat);
  const lng = typeof value?.lng === 'number' ? value.lng : Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function mapJobDoc(id: string, data: JobDoc): JobOffer {
  const address = data.addressSnapshot?.addressLine1 || data.location;
  return {
    id,
    customerName: data.customerName,
    address,
    scheduledDate: data.scheduledDate,
    totalPrice: fareFromItems(data.items),
    subscriptionId: data.subscriptionId,
    offerExpiresAt: data.offerExpiresAt,
    assignmentStatus: data.assignmentStatus,
    jobStatus: data.jobStatus,
    pickup: parsePickup(data.pickup),
  };
}

/**
 * Listens for the current driver's job offer and accepted/in-progress trip.
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
        collection(db, 'jobs'),
        where('assignedTo', '==', uid),
        where('assignmentStatus', 'in', ['assigned', 'reassigned']),
      ),
      (snapshot) => {
        if (snapshot.empty) {
          setOffer(null);
        } else {
          const docSnap = snapshot.docs[0];
          setOffer(mapJobDoc(docSnap.id, docSnap.data() as JobDoc));
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
        collection(db, 'jobs'),
        where('assignedTo', '==', uid),
        where('assignmentStatus', '==', 'accepted'),
      ),
      (snapshot) => {
        const live = snapshot.docs.find((docSnap) => {
          const status = (docSnap.data() as JobDoc).jobStatus;
          return status !== 'completed' && status !== 'cancelled';
        });
        if (!live) {
          setActiveTrip(null);
        } else {
          setActiveTrip(mapJobDoc(live.id, live.data() as JobDoc));
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

  const accept = useCallback(async (jobId: string) => {
    await acceptJobOfferFn({ jobId });
  }, []);

  const decline = useCallback(async (jobId: string) => {
    await declineJobOfferFn({ jobId });
  }, []);

  const complete = useCallback(async (jobId: string) => {
    await completeJobFn({ jobId });
  }, []);

  const cancel = useCallback(async (jobId: string) => {
    await cancelAcceptedJobFn({ jobId });
  }, []);

  return { offer, activeTrip, loading, accept, decline, complete, cancel };
}
