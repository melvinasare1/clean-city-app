import { COLORS } from "@/lib/constants";
import type { Booking } from "@/types/booking";
import type { Subscription } from "@/types/subscription";

export type UnifiedDetailStatus =
  | "active"
  | "awaiting_payment"
  | "payment_required"
  | "cancelled"
  | "completed";

export function getUnifiedStatusForSubscription(sub: Subscription): UnifiedDetailStatus {
  if (sub.status === "cancelled") return "cancelled";
  if (sub.status === "paused") return "cancelled";
  const pay = sub.payment?.status ?? "none";
  // Either webhook/backend set status = "active" or nested payment = "paid" means active UI.
  if (sub.status === "active" || pay === "paid") {
    return "active";
  }
  if (sub.status === "pending") {
    if (pay === "initiated") return "awaiting_payment";
    return "payment_required";
  }
  if (sub.status === "past_due") return "payment_required";
  return "payment_required";
}

export function getUnifiedStatusForBooking(booking: Booking): UnifiedDetailStatus {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "completed") return "completed";
  const pay = booking.payment.status;
  if (pay === "paid") return "active";
  if (pay === "initiated") return "awaiting_payment";
  return "payment_required";
}

export function getUnifiedStatusLabel(status: UnifiedDetailStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "awaiting_payment":
      return "Awaiting Payment";
    case "payment_required":
      return "Payment Required";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default: {
      const _e: never = status;
      return _e;
    }
  }
}

export function getUnifiedStatusBadgeColor(status: UnifiedDetailStatus): string {
  switch (status) {
    case "active":
      return COLORS.success;
    case "completed":
      return COLORS.textSecondary;
    case "awaiting_payment":
      return COLORS.accent;
    case "payment_required":
      return COLORS.error;
    case "cancelled":
      return COLORS.textSecondary;
    default: {
      const _e: never = status;
      return _e;
    }
  }
}

export function isInactiveDetailStatus(status: UnifiedDetailStatus): boolean {
  return status === "cancelled" || status === "completed";
}
