/**
 * Firestore types for payments and jobs collections.
 */

import type { FirebaseTimestamp } from "./subscription-types";

export type PaymentStatus =
  | "initialized"
  | "success"
  | "failed"
  | "abandoned";

export type PaymentType = "subscription" | "one_time";

export interface PaymentDocument {
  id: string;
  userId: string;
  subscriptionId?: string;
  bookingId?: string;

  type: PaymentType;

  amount: number;
  currency: "GHS";

  reference: string;

  status: PaymentStatus;

  paymentMethod: "momo";

  paystackStatus?: string;

  billingPeriodStart?: FirebaseTimestamp;
  billingPeriodEnd?: FirebaseTimestamp;

  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

// --- Job types (top-level "jobs" collection) ---

export type JobType = "one_time" | "subscription";

export type JobPaymentStatus = "paid" | "pending" | "overdue";

export type JobStatus =
  | "scheduled"
  | "assigned"
  | "in_progress"
  | "completed"
  | "missed"
  | "cancelled";

export type AssignmentStatus =
  | "unassigned"
  | "assigned"
  | "accepted"
  | "reassigned";

export type JobCollectionFrequency = "weekly" | "biweekly" | "monthly";

/** Single item in job.items (snapshot at job creation) */
export interface JobItemSnapshot {
  id: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** addressSnapshot at job creation */
export interface JobAddressSnapshot {
  addressLine1: string;
  area: string;
  phoneNumber: string;
}

/** Stored once at job creation from Mapbox geocoding; reused for map pin, line, and nav. */
export interface JobPickupCoordinates {
  lat: number;
  lng: number;
}

export interface JobDocument {
  id: string;

  type: JobType;
  bookingId?: string;
  subscriptionId?: string;

  userId: string;
  /** Snapshot from profiles/{userId}.name at job creation. */
  customerName?: string;

  scheduledDate: FirebaseTimestamp;

  paymentStatus: JobPaymentStatus;
  jobStatus: JobStatus;

  items: JobItemSnapshot[];

  location: string;
  addressSnapshot: JobAddressSnapshot;
  pickup?: JobPickupCoordinates;

  windowId: string;
  windowLabel: string;

  collectionFrequency?: JobCollectionFrequency;
  collectionDay?: string;

  assignedTo?: string | null;
  assignmentStatus: AssignmentStatus;
  assignedAt?: FirebaseTimestamp;
  assignedBy?: string;
  declinedBy?: string[];
  offerExpiresAt?: FirebaseTimestamp;
  offerTaskName?: string;

  /** Set when driver starts the job */
  startedAt?: FirebaseTimestamp;
  startedBy?: string;
  /** Checkpoint within in_progress: driver arrived at pickup */
  arrivedAt?: FirebaseTimestamp | null;
  /** Checkpoint within in_progress: driver confirmed pickup on the job sheet */
  pickupConfirmedAt?: FirebaseTimestamp | null;
  /** Set when driver completes the job */
  completedAt?: FirebaseTimestamp;
  completedBy?: string;

  /** Snapshot from Paystack/booking payment. Currently always "momo". */
  paymentMethod?: "momo" | string;
  /** Customer-attached pickup photo. Not captured anywhere today. */
  photoUrl?: string | null;

  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}
