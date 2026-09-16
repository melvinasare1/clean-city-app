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
import type { CancelReasonCode } from '@platform/shared-types';
import { useDriverApproved } from '@/hooks/useDriverApproved';
import { markJobArrived } from '@/services/driver-api';

export type JobItem = {
  id?: string;
  type: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
};

export type JobOffer = {
  id: string;
  customerName?: string;
  address?: string;
  addressLine1?: string;
  area?: string;
  location?: string;
  phoneNumber?: string;
  scheduledDate?: Timestamp | string;
  amountPaid?: number;
  totalPrice?: number;
  subscriptionId?: string | null;
  offerExpiresAt?: Timestamp | Date | string | number | null;
  assignmentStatus?: string;
  jobStatus?: string;
  pickup?: { lat: number; lng: number } | null;
  windowId?: string;
  windowLabel?: string;
  items?: JobItem[];
  paymentMethod?: string;
  photoUrl?: string | null;
  arrivedAt?: Timestamp | Date | string | null;
  pickupConfirmedAt?: Timestamp | Date | string | null;
  acceptedAt?: Timestamp | Date | string | null;
  jobSheetViewedAt?: Timestamp | Date | string | null;
  pickupPhotoUrl?: string | null;
  currentAssignmentId?: string | null;
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
const cancelAcceptedJobFn = httpsCallable<
  { jobId: string; cancelReasonCode: CancelReasonCode; cancelReasonNote?: string },
  { ok: boolean }
>(functions, 'cancelAcceptedJob');
const confirmPickupFn = httpsCallable<{ jobId: string; photoUrl: string }, { ok: boolean }>(
  functions,
  'confirmPickup'
);

type JobDoc = {
  customerName?: string;
  location?: string;
  addressSnapshot?: {
    addressLine1?: string;
    area?: string;
    phoneNumber?: string;
  };
  scheduledDate?: Timestamp | string;
  items?: Array<{
    id?: string;
    type?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  subscriptionId?: string | null;
  offerExpiresAt?: Timestamp | Date | string | number | null;
  assignmentStatus?: string;
  jobStatus?: string;
  pickup?: { lat?: number; lng?: number };
  windowId?: string;
  windowLabel?: string;
  paymentMethod?: string;
  photoUrl?: string | null;
  arrivedAt?: Timestamp | Date | string | null;
  pickupConfirmedAt?: Timestamp | Date | string | null;
  acceptedAt?: Timestamp | Date | string | null;
  jobSheetViewedAt?: Timestamp | Date | string | null;
  pickupPhotoUrl?: string | null;
  currentAssignmentId?: string | null;
};

function fareFromItems(items: JobDoc['items']): number | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const sum = items.reduce((acc, item) => acc + Number(item?.totalPrice ?? 0), 0);
  return Number.isFinite(sum) ? sum : undefined;
}

function parsePickup(value: JobDoc['pickup'] | Record<string, unknown> | undefined): JobOffer['pickup'] {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const latRaw = record.lat ?? record.latitude;
  const lngRaw = record.lng ?? record.longitude;
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseItems(items: JobDoc['items']): JobItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: item?.id,
      type: String(item?.type ?? '').trim(),
      quantity: Number(item?.quantity ?? 0),
      unitPrice: item?.unitPrice,
      totalPrice: item?.totalPrice,
    }))
    .filter((item) => item.type && Number.isFinite(item.quantity));
}

export function mapJobDoc(id: string, data: JobDoc): JobOffer {
  const addressLine1 = data.addressSnapshot?.addressLine1;
  const address = addressLine1 || data.location;
  return {
    id,
    customerName: data.customerName,
    address,
    addressLine1,
    area: data.addressSnapshot?.area,
    location: data.location,
    phoneNumber: data.addressSnapshot?.phoneNumber,
    scheduledDate: data.scheduledDate,
    totalPrice: fareFromItems(data.items),
    subscriptionId: data.subscriptionId,
    offerExpiresAt: data.offerExpiresAt,
    assignmentStatus: data.assignmentStatus,
    jobStatus: data.jobStatus,
    pickup: parsePickup(data.pickup),
    windowId: data.windowId,
    windowLabel: data.windowLabel,
    items: parseItems(data.items),
    paymentMethod: data.paymentMethod,
    photoUrl: data.photoUrl,
    arrivedAt: data.arrivedAt,
    pickupConfirmedAt: data.pickupConfirmedAt,
    acceptedAt: data.acceptedAt,
    jobSheetViewedAt: data.jobSheetViewedAt,
    pickupPhotoUrl: data.pickupPhotoUrl,
    currentAssignmentId: data.currentAssignmentId,
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

  const cancel = useCallback(
    async (jobId: string, cancelReasonCode: CancelReasonCode, cancelReasonNote?: string) => {
      await cancelAcceptedJobFn({ jobId, cancelReasonCode, cancelReasonNote });
    },
    []
  );

  const markArrived = useCallback(async (jobId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in required');
    await markJobArrived(jobId, uid);
  }, []);

  const confirmPickup = useCallback(async (jobId: string, photoUrl: string) => {
    await confirmPickupFn({ jobId, photoUrl });
  }, []);

  return {
    offer,
    activeTrip,
    loading,
    accept,
    decline,
    complete,
    cancel,
    markArrived,
    confirmPickup,
  };
}
