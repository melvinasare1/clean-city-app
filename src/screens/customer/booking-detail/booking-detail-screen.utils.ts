import {
  getSubscriptionDiscount,
  intervalWeeksToDiscountFrequency,
  type SubscriptionDiscountFrequency,
} from "@/lib/subscription-discount";
import type { Booking } from "@/types/booking";
import type { Subscription } from "@/types/subscription";
import {
  formatDate,
  formatPrice,
  formatSubscriptionDate,
  getBinSummary,
  getSubscriptionCollectionDayLabel,
} from "../my-bookings/my-bookings-screen.utils";

export { formatDate, formatPrice, formatSubscriptionDate, getBinSummary, getSubscriptionCollectionDayLabel };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function subscriptionStepDays(sub: Subscription): number {
  const f = sub.collectionFrequency;
  if (f === "weekly") return 7;
  if (f === "biweekly") return 14;
  return 28;
}

function subscriptionIntervalWeeks(sub: Subscription): number {
  const f = sub.collectionFrequency;
  if (f === "weekly") return 1;
  if (f === "biweekly") return 2;
  if (f === "monthly") return 4;
  if (sub.interval === "weekly") return 1;
  return 4;
}

export function getDiscountFrequency(sub: Subscription): SubscriptionDiscountFrequency {
  return intervalWeeksToDiscountFrequency(subscriptionIntervalWeeks(sub));
}

/** Next pickup ISO (YYYY-MM-DD) for list/detail; null if cancelled or unknown. */
export function getNextPickupIsoForSubscription(
  sub: Subscription,
  bookings: Booking[]
): string | null {
  if (sub.status === "cancelled") return null;

  const relatedDates = bookings
    .filter(
      (b) =>
        (b.subscriptionId != null && String(b.subscriptionId) === sub.id) ||
        (sub.bookingId != null && b.id === sub.bookingId)
    )
    .filter((b) => b.status !== "cancelled")
    .map((b) => b.date)
    .sort();

  const todayStr = toIsoDate(startOfDay(new Date()));
  const fromBooking = relatedDates.find((d) => d >= todayStr);
  if (fromBooking) return fromBooking;

  if (!sub.startDate) return null;

  const today = startOfDay(new Date());
  let cursor = startOfDay(parseLocalDate(sub.startDate));
  const step = subscriptionStepDays(sub);
  let guard = 0;
  while (cursor < today && guard < 520) {
    cursor = startOfDay(new Date(cursor.getTime() + step * 24 * 60 * 60 * 1000));
    guard += 1;
  }
  return toIsoDate(cursor);
}

export function getNextPickupIsoForBooking(booking: Booking): string | null {
  if (booking.status === "cancelled" || booking.status === "completed") return null;
  return booking.date;
}

/** Card / detail title for subscription cadence */
export function getSubscriptionBookingTypeCardLabel(sub: Subscription): string {
  const f = sub.collectionFrequency;
  if (f === "weekly") return "Weekly Subscription";
  if (f === "biweekly") return "Every Other Week Subscription";
  if (f === "monthly") return "Monthly Subscription";
  if (sub.interval === "weekly") return "Weekly Subscription";
  if (sub.interval === "monthly") return "Monthly Subscription";
  return "Subscription";
}

/** Service summary plain English */
export function getServiceSummaryCollectionLabel(sub: Subscription): string {
  const f = sub.collectionFrequency;
  if (f === "weekly") return "Weekly Collection";
  if (f === "biweekly") return "Every Other Week";
  if (f === "monthly") return "Monthly Collection";
  if (sub.interval === "weekly") return "Weekly Collection";
  if (sub.interval === "monthly") return "Monthly Collection";
  return "Subscription Collection";
}

export function getCollectionDayEveryLabel(sub: Subscription): string {
  const day = getSubscriptionCollectionDayLabel(sub);
  if (!day || day === "—") return "—";
  return `Every ${day}`;
}

/** Service summary title for a booking row (includes subscription-typed bookings). */
export function getServiceSummaryLabelForBooking(booking: Booking): string {
  if (booking.type !== "subscription") return "One-time Pickup";
  const w = booking.recurrence?.intervalWeeks ?? 1;
  if (w === 1) return "Weekly Collection";
  if (w === 2) return "Every Other Week";
  return "Monthly Collection";
}

export function getCardBookingTypeLabel(booking: Booking): string {
  if (booking.type !== "subscription") return "One-time Pickup";
  const w = booking.recurrence?.intervalWeeks;
  if (w === 1) return "Weekly Subscription";
  if (w === 2) return "Every Other Week Subscription";
  return "Monthly Subscription";
}

export function getSubscriptionCollectionDayLabelForBooking(booking: Booking): string {
  if (booking.type !== "subscription") return "—";
  const d = new Date(`${booking.date}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

export function getCollectionDayEveryLabelForBooking(booking: Booking): string {
  if (booking.type !== "subscription") return "—";
  const day = getSubscriptionCollectionDayLabelForBooking(booking);
  return `Every ${day}`;
}

export function subscriptionPaymentOriginalLine(sub: Subscription): string | null {
  const lines = subscriptionPaymentDiscountLines(sub);
  if (!lines) return null;
  return `${lines.originalFormatted} — ${lines.discountDescription}`;
}

/** Two-line display: original price and discount copy (same rules as single-line helper). */
export function subscriptionPaymentDiscountLines(sub: Subscription): {
  originalFormatted: string;
  discountDescription: string;
  /** Numeric totals for payment-summary UI (same math as originalFormatted). */
  discountAmount: number;
  discountPercent: number;
} | null {
  const amount = sub.amount;
  if (amount == null || amount <= 0) return null;
  const freq = getDiscountFrequency(sub);
  const rate = getSubscriptionDiscount(freq);
  if (rate <= 0) return null;
  const undiscounted = amount / (1 - rate);
  const pct = Math.round(rate * 100);
  return {
    originalFormatted: formatPrice(undiscounted),
    discountDescription: `${pct}% subscription discount applied`,
    discountAmount: Math.max(0, undiscounted - amount),
    discountPercent: pct,
  };
}

/** e.g. "Sunday, 24 Oct" for next-collection banner */
export function formatCollectionBannerDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** "Arriving in 3 days", "Arriving tomorrow", or null if past / invalid */
export function getArrivingInLabelForPickup(iso: string): string | null {
  const target = startOfDayLocal(new Date(`${iso}T12:00:00`));
  const today = startOfDayLocal(new Date());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return "Arriving today";
  if (diff === 1) return "Arriving tomorrow";
  return `Arriving in ${diff} days`;
}

/** Short "Oct 22" for due-by line */
export function formatShortMonthDay(
  ts: { toDate?: () => Date } | Date | string | number | null | undefined
): string | null {
  if (!ts) return null;
  const d =
    typeof (ts as { toDate?: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : ts instanceof Date
        ? ts
        : new Date(ts as string | number);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function getLinkedBookingForSubscription(
  sub: Subscription,
  bookings: Booking[]
): Booking | undefined {
  return bookings.find(
    (b) =>
      (b.subscriptionId != null && String(b.subscriptionId) === sub.id) ||
      (sub.bookingId != null && b.id === sub.bookingId)
  );
}

export function formatFirestoreTimestamp(
  ts: { toDate?: () => Date } | Date | null | undefined
): string | null {
  if (!ts) return null;
  const d =
    typeof (ts as { toDate?: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : (ts as Date);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getSubscriptionPaymentStatusLabel(sub: Subscription): string {
  const s = sub.payment?.status ?? "none";
  if (s === "paid") return "Paid";
  if (s === "initiated") return "Pending";
  if (s === "failed") return "Failed";
  return "Unpaid";
}

export function getBookingPaymentStatusLabel(booking: Booking): string {
  const s = booking.payment.status;
  if (s === "paid") return "Paid";
  if (s === "initiated") return "Pending";
  return "Unpaid";
}

export function getHonourUntilDescription(
  sub: Subscription,
  bookings: Booking[]
): string {
  const nextPickup = getNextPickupIsoForSubscription(sub, bookings);
  if (nextPickup) return formatDate(nextPickup);
  const nd = sub.nextChargeDate;
  if (nd) return formatSubscriptionDate(nd);
  return "the end of your current billing period";
}
