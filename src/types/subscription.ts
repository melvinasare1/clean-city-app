import type { Timestamp } from "firebase/firestore";

/** Paystack subscription interval (biweekly not supported by Paystack) */
export type SubscriptionInterval = "weekly" | "monthly";

/** Status from webhook / Firestore. Do not set "active" manually in app. */
export type SubscriptionStatus = "pending" | "active" | "past_due" | "paused" | "cancelled";

/** Current payment cycle status (cron sets initiated, webhook sets paid/failed). */
export type SubscriptionPaymentStatus = "none" | "initiated" | "paid" | "failed";

export type SubscriptionPayment = {
  status: SubscriptionPaymentStatus;
  reference?: string;
};

export type Subscription = {
  id: string;
  userId: string;
  email?: string;
  /** Paystack reference from create-subscription response */
  reference: string;
  /** Not used: simulated recurring uses transaction/initialize only */
  planCode?: string;
  status: SubscriptionStatus;
  /** Recurring amount in GHS */
  amount?: number;
  interval?: SubscriptionInterval;
  /** Day of week for collection (e.g. "Monday") */
  collectionDayOfWeek?: string;
  /** Next charge date (from webhook/cron) */
  nextChargeDate?: Timestamp | null;
  /** Last successful charge date */
  lastChargeDate?: Timestamp | null;
  /** Current payment cycle state */
  payment?: SubscriptionPayment;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
};
