import type { Timestamp } from "firebase/firestore";

/** Paystack subscription interval (biweekly not supported by Paystack) */
export type SubscriptionInterval = "weekly" | "monthly";

/** Status from webhook / Firestore. Do not set "active" manually in app. */
export type SubscriptionStatus = "pending" | "active" | "past_due" | "cancelled";

export type Subscription = {
  id: string;
  userId: string;
  /** Paystack reference from create-subscription response */
  reference: string;
  /** Plan code from backend (Paystack plan) */
  planCode: string;
  status: SubscriptionStatus;
  /** Recurring amount in GHS */
  amount?: number;
  interval?: SubscriptionInterval;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
};
