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

export type JobStatus =
  | "scheduled"
  | "assigned"
  | "in_progress"
  | "completed"
  | "missed"
  | "cancelled";

export type JobCollectionFrequency = "weekly" | "biweekly" | "monthly";

export interface JobDocument {
  id: string;
  subscriptionId: string;
  userId: string;

  scheduledDate: FirebaseTimestamp;
  collectionFrequency: JobCollectionFrequency;

  status: JobStatus;

  assignedTo?: string;

  addressSnapshot: Record<string, unknown>;

  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}
