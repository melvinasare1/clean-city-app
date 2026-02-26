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

export interface JobDocument {
  id: string;

  type: JobType;
  bookingId?: string;
  subscriptionId?: string;

  userId: string;

  scheduledDate: FirebaseTimestamp;

  paymentStatus: JobPaymentStatus;
  jobStatus: JobStatus;

  items: JobItemSnapshot[];

  location: string;
  addressSnapshot: JobAddressSnapshot;

  windowId: string;
  windowLabel: string;

  collectionFrequency?: JobCollectionFrequency;
  collectionDay?: string;

  assignedTo?: string;
  assignmentStatus: AssignmentStatus;
  assignedAt?: FirebaseTimestamp;
  assignedBy?: string;

  /** Set when driver starts the job */
  startedAt?: FirebaseTimestamp;
  startedBy?: string;
  /** Set when driver completes the job */
  completedAt?: FirebaseTimestamp;
  completedBy?: string;

  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}
