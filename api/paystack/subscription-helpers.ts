/**
 * Subscription billing: MoMo only, internal recurring, calendar monthly.
 * All transaction/initialize calls use channels: ["mobile_money"].
 */

import type { FirebaseTimestamp, SubscriptionDocument } from "./subscription-types";
import type {
  JobAddressSnapshot,
  JobCollectionFrequency,
  JobItemSnapshot,
} from "./payment-and-job-types";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";
const JOBS_COLLECTION = "jobs";

/** Normalize Firestore Timestamp or { _seconds } to Date */
export function toDate(ts: FirebaseTimestamp | { toDate(): Date } | undefined | null): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate(): Date }).toDate === "function") {
    return (ts as { toDate(): Date }).toDate();
  }
  const s = (ts as FirebaseTimestamp)._seconds;
  if (typeof s === "number") return new Date(s * 1000);
  return null;
}

/** Add exactly one calendar month; clamp to last day if next month has fewer days */
export function addCalendarMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  // If we overflowed (e.g. Jan 31 -> Mar 3), clamp to last day of target month
  if (next.getDate() !== date.getDate()) {
    next.setDate(0); // last day of previous month
  }
  return next;
}

/** End of billing period: one day before the next billing date (for metadata.billingPeriodEnd). */
export function getBillingPeriodEnd(periodStart: Date): Date {
  const next = addCalendarMonth(new Date(periodStart));
  next.setDate(next.getDate() - 1);
  return next;
}

/** Check if two dates are the same calendar day (YYYY-MM-DD) */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whether today (or given date) is the subscription's next billing day */
export function isBillingDayToday(
  nextBillingDate: Date | null,
  today: Date = new Date()
): boolean {
  if (!nextBillingDate) return false;
  return isSameCalendarDay(nextBillingDate, today);
}

/** Days since a given date (floor); uses start of day for both */
export function daysSince(date: Date | null, from: Date = new Date()): number {
  if (!date) return -1;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.floor((f.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

/** Reminder schedule for payment_due: Day 0 = initial, Day 3 = reminder, Day 7 = overdue */
export const REMINDER_DAY_INITIAL = 0;
export const REMINDER_DAY_REMINDER = 3;
export const REMINDER_DAY_OVERDUE = 7;

export function getReminderPhase(daysSinceDue: number): "initial" | "reminder" | "overdue" | null {
  if (daysSinceDue < 0) return null;
  if (daysSinceDue >= REMINDER_DAY_OVERDUE) return "overdue";
  if (daysSinceDue >= REMINDER_DAY_REMINDER) return "reminder";
  return "initial";
}

/** Whether we should send the day-3 reminder today */
export function shouldSendReminderToday(paymentDueSince: Date | null, today: Date = new Date()): boolean {
  const days = daysSince(paymentDueSince, today);
  return days === REMINDER_DAY_REMINDER;
}

/** Whether we should mark as overdue today (day 7) */
export function shouldMarkOverdueToday(paymentDueSince: Date | null, today: Date = new Date()): boolean {
  const days = daysSince(paymentDueSince, today);
  return days >= REMINDER_DAY_OVERDUE;
}

/** Initialize Paystack transaction for subscription payment (MoMo only). Always channels: ["mobile_money"]. Metadata includes type: "subscription". */
export async function initializeManualPayment(params: {
  secretKey: string;
  email: string;
  amountGhs: number;
  subscriptionId: string;
  userId: string;
  callbackUrl: string;
  collectionFrequency: string;
  billingDay: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const {
    secretKey,
    email,
    amountGhs,
    subscriptionId,
    userId,
    callbackUrl,
    collectionFrequency,
    billingDay,
    billingPeriodStart,
    billingPeriodEnd,
  } = params;
  const amountInPesewas = Math.round(amountGhs * 100);
  const metadata: Record<string, string> = {
    type: "subscription",
    subscriptionId,
    userId,
    collectionFrequency,
    billingDay: String(billingDay),
    billingPeriodStart,
    billingPeriodEnd,
  };

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountInPesewas,
      metadata,
      callback_url: callbackUrl,
      channels: ["mobile_money"],
    }),
  });

  const text = await res.text();
  let data: { status?: boolean; data?: { authorization_url?: string; reference?: string }; message?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Paystack invalid response: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Failed to initialize transaction");
  }
  const url = data.data?.authorization_url;
  const reference = data.data?.reference;
  if (!url || !reference) throw new Error("Missing authorization_url or reference from Paystack");
  return { authorizationUrl: url, reference };
}

/** Firestore type from Firebase Admin (callers pass admin.firestore()) */
export type Firestore = import("firebase-admin").firestore.Firestore;

/** Get subscription by transaction reference (metadata.subscriptionId). Used in webhook. */
export async function getSubscriptionByReference(
  firestore: Firestore,
  reference: string
): Promise<SubscriptionDocument | null> {
  const txSnap = await firestore.collection("transactions").doc(reference).get();
  const tx = txSnap.data();
  const subscriptionId = tx?.metadata?.subscriptionId ?? tx?.userId;
  if (!subscriptionId) return null;
  const subSnap = await firestore.collection(SUBSCRIPTIONS_COLLECTION).doc(String(subscriptionId)).get();
  if (!subSnap.exists) return null;
  return { id: subSnap.id, ...subSnap.data() } as SubscriptionDocument;
}

/**
 * Get scheduled job dates for a billing period based on collection frequency.
 * - weekly: 4 jobs, 7 days apart (day 0, 7, 14, 21)
 * - biweekly: 2 jobs, 14 days apart (day 0, 14)
 * - monthly: 1 job (day 0)
 */
export function getJobScheduledDates(
  billingPeriodStart: Date,
  collectionFrequency: JobCollectionFrequency
): Date[] {
  const start = new Date(billingPeriodStart.getFullYear(), billingPeriodStart.getMonth(), billingPeriodStart.getDate());
  const dates: Date[] = [];
  if (collectionFrequency === "weekly") {
    for (let i = 0; i < 4; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * 7);
      dates.push(d);
    }
  } else if (collectionFrequency === "biweekly") {
    for (let i = 0; i < 2; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * 14);
      dates.push(d);
    }
  } else {
    dates.push(new Date(start));
  }
  return dates;
}

/**
 * Create one job in the top-level "jobs" collection for a one-time booking after successful payment.
 * Snapshots items, location, and address at creation; job is self-contained.
 */
export async function createJobForOneTimeBooking(
  firestore: Firestore,
  params: {
    bookingId: string;
    userId: string;
    scheduledDate: Date;
    items: JobItemSnapshot[];
    location: string;
    addressSnapshot: JobAddressSnapshot;
    windowId: string;
    windowLabel: string;
    Timestamp: typeof import("firebase-admin").firestore.Timestamp;
  }
): Promise<void> {
  const {
    bookingId,
    userId,
    scheduledDate,
    items,
    location,
    addressSnapshot,
    windowId,
    windowLabel,
    Timestamp,
  } = params;
  const jobsRef = firestore.collection(JOBS_COLLECTION);
  const docRef = jobsRef.doc();
  const now = new Date();
  const nowTs = Timestamp.fromDate(now);
  await docRef.set({
    id: docRef.id,
    type: "one_time",
    bookingId,
    userId,
    scheduledDate: Timestamp.fromDate(scheduledDate),
    paymentStatus: "paid",
    jobStatus: "scheduled",
    items: items ?? [],
    location: location ?? "",
    addressSnapshot: {
      addressLine1: addressSnapshot.addressLine1 ?? "",
      area: addressSnapshot.area ?? "",
      phoneNumber: addressSnapshot.phoneNumber ?? "",
    },
    windowId: windowId ?? "",
    windowLabel: windowLabel ?? "",
    createdAt: nowTs,
    updatedAt: nowTs,
  });
}

/**
 * Create job documents in the top-level "jobs" collection for a subscription after successful payment.
 * Snapshots items, location, and address at creation; jobs are self-contained.
 * - weekly: 4 jobs, 7 days apart
 * - biweekly: 2 jobs, 14 days apart
 * - monthly: 1 job
 */
export async function createJobsForSubscription(
  firestore: Firestore,
  params: {
    subscriptionId: string;
    userId: string;
    billingPeriodStart: Date;
    collectionFrequency: JobCollectionFrequency;
    collectionDay?: string;
    items: JobItemSnapshot[];
    location: string;
    addressSnapshot: JobAddressSnapshot;
    windowId: string;
    windowLabel: string;
    Timestamp: typeof import("firebase-admin").firestore.Timestamp;
  }
): Promise<void> {
  const {
    subscriptionId,
    userId,
    billingPeriodStart,
    collectionFrequency,
    collectionDay,
    items,
    location,
    addressSnapshot,
    windowId,
    windowLabel,
    Timestamp,
  } = params;
  const scheduledDates = getJobScheduledDates(billingPeriodStart, collectionFrequency);
  const jobsRef = firestore.collection(JOBS_COLLECTION);
  const now = new Date();
  const nowTs = Timestamp.fromDate(now);
  const normalizedAddress: JobAddressSnapshot = {
    addressLine1: addressSnapshot?.addressLine1 ?? "",
    area: addressSnapshot?.area ?? "",
    phoneNumber: addressSnapshot?.phoneNumber ?? "",
  };
  for (const scheduledDate of scheduledDates) {
    const docRef = jobsRef.doc();
    await docRef.set({
      id: docRef.id,
      type: "subscription",
      subscriptionId,
      userId,
      scheduledDate: Timestamp.fromDate(scheduledDate),
      paymentStatus: "paid",
      jobStatus: "scheduled",
      items: items ?? [],
      location: location ?? "",
      addressSnapshot: normalizedAddress,
      windowId: windowId ?? "",
      windowLabel: windowLabel ?? "",
      ...(collectionFrequency ? { collectionFrequency } : {}),
      ...(collectionDay != null && collectionDay !== "" ? { collectionDay } : {}),
      createdAt: nowTs,
      updatedAt: nowTs,
    });
  }
}
