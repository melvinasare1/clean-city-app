import type { Timestamp } from "firebase/firestore";

/** Pickup cadence stored on subscription docs from the API */
export type SubscriptionCollectionFrequency = "weekly" | "biweekly" | "monthly";

/** Paystack subscription interval (legacy client field; biweekly maps at API layer) */
export type SubscriptionInterval = "weekly" | "monthly";

/** Status from webhook / Firestore. Do not set "active" manually in app. */
export type SubscriptionStatus = "pending" | "active" | "past_due" | "paused" | "cancelled";

/** Current payment cycle status (cron sets initiated, webhook sets paid/failed). */
export type SubscriptionPaymentStatus = "none" | "initiated" | "paid" | "failed";

export type SubscriptionPayment = {
  status: SubscriptionPaymentStatus;
  reference?: string;
};

export type SubscriptionCancelledBy = "customer" | "admin" | "system";

export type Subscription = {
  id: string;
  userId: string;
  email?: string;
  /** Paystack reference from create-subscription response */
  reference: string;
  /** Latest Paystack reference for the current billing cycle (API / renewals) */
  currentPaymentReference?: string;
  /** Last successful charge reference (webhook sets on charge.success) */
  lastPaymentReference?: string;
  /** Not used: simulated recurring uses transaction/initialize only */
  planCode?: string;
  status: SubscriptionStatus;
  /** Recurring amount in GHS */
  amount?: number;
  /** Firestore/API: pickup cadence */
  collectionFrequency?: SubscriptionCollectionFrequency;
  /** Firestore/API: weekday key e.g. "monday" */
  collectionDay?: string;
  /** ISO YYYY-MM-DD first collection (API) */
  startDate?: string;
  /** Legacy app-written field */
  interval?: SubscriptionInterval;
  /** Day of week for collection (e.g. "Monday") — legacy or derived for display */
  collectionDayOfWeek?: string;
  bookingId?: string;
  /** Next charge date (from webhook/cron) */
  nextChargeDate?: Timestamp | null;
  /** Last successful charge date */
  lastChargeDate?: Timestamp | null;
  /** Current payment cycle state */
  payment?: SubscriptionPayment;
  /** Timestamp when the subscription was cancelled */
  cancelledAt?: Timestamp | null;
  /** Who cancelled the subscription */
  cancelledBy?: SubscriptionCancelledBy;
  /** Prior status before cancellation, for billing/support history */
  cancelledFromStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
};
