import type { Timestamp } from "firebase/firestore";
import type { UnifiedDetailStatus } from "@/lib/booking-display-status";
import { COLORS } from "@/lib/constants";
import type { Booking } from "@/types/booking";
import type { Subscription, SubscriptionStatus } from "@/types/subscription";

export const SCREEN = "my_bookings";

export function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPrice(value: number): string {
  return `GHS ${value.toFixed(2)}`;
}

export function getStatusColor(status: Booking["status"]): string {
  switch (status) {
    case "pending":
      return COLORS.accent;
    case "completed":
      return COLORS.success;
    case "cancelled":
    default:
      return COLORS.error;
  }
}

export function getBinSummary(items: Booking["items"]): string {
  if (!items?.length) {
    return "No bins recorded";
  }
  return items.map((item) => `${item.quantity} x ${item.type}`).join(", ");
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "pending":
      return "Awaiting payment";
    case "active":
      return "Active";
    case "past_due":
      return "Payment failed";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function getSubscriptionStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case "pending":
      return COLORS.accent;
    case "active":
      return COLORS.success;
    case "past_due":
      return COLORS.error;
    case "paused":
    case "cancelled":
    default:
      return COLORS.textSecondary;
  }
}

/** True when next charge date has passed and current cycle is not paid. */
export function isPaymentOverdue(subscription: Subscription): boolean {
  const next = subscription.nextChargeDate;
  if (!next) return false;
  const nextDate =
    next instanceof Date
      ? next
      : (next as { toDate?: () => Date }).toDate?.() ?? new Date(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);
  if (nextDate >= today) return false;
  const paymentStatus = subscription.payment?.status ?? "none";
  return paymentStatus !== "paid";
}

export function formatSubscriptionDate(
  ts: Subscription["nextChargeDate"]
): string {
  if (!ts) return "—";
  const d =
    typeof (ts as { toDate?: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : new Date((ts as unknown) as number | string);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Label for subscription pickup cadence (Firestore uses collectionFrequency; legacy uses interval). */
export function getSubscriptionCollectionLabel(sub: Subscription): string {
  const f = sub.collectionFrequency;
  if (f === "weekly") return "Weekly Collection";
  if (f === "biweekly") return "Biweekly Collection";
  if (f === "monthly") return "Monthly Collection";
  if (sub.interval === "monthly") return "Monthly Collection";
  if (sub.interval === "weekly") return "Weekly Collection";
  return "Subscription Collection";
}

/** Resolve Paystack reference for verify / retry (root, current cycle, or nested payment). */
export function getSubscriptionPaystackReference(sub: Subscription): string {
  const p = sub.payment?.reference?.trim();
  const last = sub.lastPaymentReference?.trim();
  const c = sub.currentPaymentReference?.trim();
  const r = sub.reference?.trim();
  return p || last || c || r || "";
}

function capitalizeDayLabel(day: string): string {
  const t = day.trim();
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function getSubscriptionCollectionDayLabel(sub: Subscription): string {
  const raw = (sub.collectionDayOfWeek ?? sub.collectionDay ?? "").trim();
  return raw ? capitalizeDayLabel(raw) : "—";
}

/** Warm off-white page background for My Bookings (design). */
export const MY_BOOKINGS_PAGE_BG = COLORS.background;

/** Main dashboard heading (forest green). */
export const MY_BOOKINGS_DASHBOARD_TITLE_COLOR = "#1B5E20";

function formatTimestampListDate(ts: Timestamp | null | undefined): string | null {
  if (!ts) return null;
  const d =
    typeof (ts as { toDate?: () => Date }).toDate === "function"
      ? (ts as { toDate: () => Date }).toDate()
      : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Calendar row for subscription cards (Next / Ended / pending). */
export function getSubscriptionListMetaLine(
  sub: Subscription,
  unified: UnifiedDetailStatus,
  nextLabel: string | null
): { kind: "next" | "ended" | "pending"; text: string } | null {
  if (unified === "cancelled") {
    const ended = formatTimestampListDate(sub.updatedAt ?? sub.createdAt);
    if (ended) return { kind: "ended", text: `Ended: ${ended}` };
    return null;
  }
  if (nextLabel) return { kind: "next", text: `Next: ${nextLabel}` };
  if (unified === "awaiting_payment" || unified === "payment_required") {
    return { kind: "pending", text: "Next: Pending payment" };
  }
  return null;
}

/** Title on one-time service list cards (prefers time-window label). */
export function getOneTimeBookingListTitle(booking: Booking): string {
  if (booking.type === "subscription") {
    const w = booking.recurrence?.intervalWeeks ?? 1;
    if (w === 1) return "Weekly Subscription";
    if (w === 2) return "Every Other Week Subscription";
    return "Monthly Subscription";
  }
  const w = booking.windowLabel?.trim();
  if (w) return w;
  return "Pickup";
}

/** One-time rows: status as plain colored caps text (no pill). */
export function getOneTimeListStatusDisplay(unified: UnifiedDetailStatus): {
  text: string;
  color: string;
} {
  switch (unified) {
    case "active":
      return { text: "CONFIRMED", color: "#2E7D32" };
    case "awaiting_payment":
      return { text: "AWAITING PAYMENT", color: "#EF6C00" };
    case "payment_required":
      return { text: "PAYMENT REQUIRED", color: "#C62828" };
    case "cancelled":
      return { text: "CANCELLED", color: "#616161" };
    case "completed":
      return { text: "COMPLETED", color: "#2E7D32" };
    default: {
      const _e: never = unified;
      return { text: String(_e), color: COLORS.textSecondary };
    }
  }
}

/** Second line: date only for open bookings; "Ended: …" when cancelled. */
export function getOneTimeListDateLine(booking: Booking, unified: UnifiedDetailStatus): string {
  const dateStr = booking.date ? formatDate(booking.date) : "—";
  if (unified === "cancelled") {
    return `Ended: ${dateStr}`;
  }
  return dateStr;
}

/** 4px left accent on list cards — matches design spec. */
export function getMyBookingsListCardBorderColor(status: UnifiedDetailStatus): string {
  switch (status) {
    case "active":
      return "#2E7D32";
    case "awaiting_payment":
      return "#E65100";
    case "payment_required":
      return "#C62828";
    case "cancelled":
    case "completed":
    default: {
      return "#BDBDBD";
    }
  }
}

/** Soft pill background + text color for list cards (not the same as stack header badges). */
export function getMyBookingsListPillColors(status: UnifiedDetailStatus): {
  backgroundColor: string;
  color: string;
} {
  switch (status) {
    case "active":
      return { backgroundColor: "#E8F5E9", color: "#2E7D32" };
    case "awaiting_payment":
      return { backgroundColor: "#FFF3E0", color: "#E65100" };
    case "payment_required":
      return { backgroundColor: "#FFEBEE", color: "#C62828" };
    case "cancelled":
    case "completed":
    default:
      return { backgroundColor: "#EEEEEE", color: "#616161" };
  }
}

/** Second line under card title — calendar row copy (design). */
export function getMyBookingsPickupSubline(
  unified: UnifiedDetailStatus,
  nextLabel: string | null
): string | null {
  if (nextLabel) {
    return `Next pickup: ${nextLabel}`;
  }
  if (unified === "awaiting_payment" || unified === "payment_required") {
    return "Next pickup: Pending payment";
  }
  return null;
}
