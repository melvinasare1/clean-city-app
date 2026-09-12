import { useEffect, useState } from 'react';
import { doc, onSnapshot, db } from '@platform/shared-firebase';
import {
  DEFAULT_DRIVER_PAYMENT_METHODS,
  type DriverPaymentMethods,
} from '@platform/shared-types';
import {
  type DriverAccountStatus,
  normalizeDriverStatus,
} from '@/lib/driver-account';

export type DriverProfileFields = {
  photoURL: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  serviceProviderName: string | null;
  paymentMethods: DriverPaymentMethods;
  rating: number | null;
  jobsCompletedCount: number;
  notificationsEnabled: boolean;
  status: DriverAccountStatus | null;
  name: string | null;
};

const EMPTY_PROFILE: DriverProfileFields = {
  photoURL: null,
  vehicleType: null,
  vehiclePlate: null,
  serviceProviderName: null,
  paymentMethods: { ...DEFAULT_DRIVER_PAYMENT_METHODS },
  rating: null,
  jobsCompletedCount: 0,
  notificationsEnabled: true,
  status: null,
  name: null,
};

function nullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseJobsCompleted(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function parseBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parsePaymentMethods(value: unknown): DriverPaymentMethods {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_DRIVER_PAYMENT_METHODS };
  }
  const raw = value as Record<string, unknown>;
  return {
    cash: parseBool(raw.cash, true),
    card: parseBool(raw.card, true),
    cashAndCard: parseBool(raw.cashAndCard, true),
  };
}

export function paymentMethodsSubtitle(methods: DriverPaymentMethods): string {
  const labels: string[] = [];
  if (methods.cash) labels.push('Cash');
  if (methods.card) labels.push('Card');
  if (methods.cashAndCard) labels.push('Cash & Card');
  return labels.length ? labels.join(', ') : '—';
}

function parseProfile(data: Record<string, unknown> | undefined): DriverProfileFields {
  if (!data) return EMPTY_PROFILE;
  return {
    photoURL: nullableString(data.photoURL),
    vehicleType: nullableString(data.vehicleType),
    vehiclePlate: nullableString(data.vehiclePlate),
    serviceProviderName: nullableString(data.serviceProviderName),
    paymentMethods: parsePaymentMethods(data.paymentMethods),
    rating: parseRating(data.rating),
    jobsCompletedCount: parseJobsCompleted(data.jobsCompletedCount),
    notificationsEnabled: data.notificationsEnabled !== false,
    status: normalizeDriverStatus(data),
    name: nullableString(data.name) ?? nullableString(data.displayName),
  };
}

/**
 * Live drivers/{uid} profile fields used by the Profile tab.
 */
export function useDriverProfile(driverId: string): DriverProfileFields {
  const [profile, setProfile] = useState<DriverProfileFields>(EMPTY_PROFILE);

  useEffect(() => {
    if (!driverId) {
      setProfile(EMPTY_PROFILE);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'drivers', driverId),
      (snap) => {
        setProfile(parseProfile(snap.data() as Record<string, unknown> | undefined));
      },
      (error) => {
        console.error('[useDriverProfile] listener failed', error);
      }
    );
    return unsub;
  }, [driverId]);

  return profile;
}
