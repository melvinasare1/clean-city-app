/**
 * Subscription billing: MoMo only, internal recurring, calendar monthly.
 * No Paystack plans or subscription_code.
 */

export type CollectionFrequency = "weekly" | "biweekly" | "monthly";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "payment_due"
  | "overdue"
  | "paused"
  | "cancelled";

export interface SubscriptionDocument {
  id: string;
  userId: string;

  paymentMethod: "momo";

  collectionFrequency: CollectionFrequency;
  /** Day of week for collection, e.g. "Tuesday" */
  collectionDay: string;

  /** Amount in GHS */
  amount: number;

  /** Calendar day of month for billing (1–28) */
  billingDay: number;
  /** Next billing date (calendar month) */
  nextBillingDate: FirebaseTimestamp;

  status: SubscriptionStatus;

  lastPaymentDate?: FirebaseTimestamp;
  lastPaymentReference?: string;
  currentPaymentReference?: string;
  paymentDueSince?: FirebaseTimestamp;

  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;

  email?: string;
  [key: string]: unknown;
}

/** Firestore Timestamp (object with seconds and nanoseconds) */
export interface FirebaseTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

/** For date math we use Date; Firestore uses Timestamp */
export function timestampToDate(ts: FirebaseTimestamp | undefined | null): Date | null {
  if (!ts || typeof (ts as any).toDate === "function") {
    try {
      return (ts as any)?.toDate?.() ?? null;
    } catch {
      return null;
    }
  }
  const s = (ts as FirebaseTimestamp)._seconds;
  if (typeof s !== "number") return null;
  return new Date(s * 1000);
}

export function dateToFirestoreTimestamp(date: Date): { _seconds: number; _nanoseconds: number } {
  const ms = date.getTime();
  return {
    _seconds: Math.floor(ms / 1000),
    _nanoseconds: (ms % 1000) * 1_000_000,
  };
}
