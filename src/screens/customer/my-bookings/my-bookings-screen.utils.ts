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
