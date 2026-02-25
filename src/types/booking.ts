import type { Timestamp } from "firebase/firestore";
import type { TimeWindowId } from "@/lib/time-windows";

export type BookingStatus = "pending" | "completed" | "cancelled";

export type PaymentStatus = "unpaid" | "initiated" | "paid";

export type BookingPayment = {
  status: PaymentStatus;
  reference?: string;
  authorizationUrl?: string;
  amount?: number;
  initiatedAt?: Timestamp;
  paidAt?: Timestamp;
  /**
   * History of previous payment references for retry scenarios.
   * When a user retries payment, the old reference is pushed here.
   */
  referenceHistory?: string[];
};

export type BookingBinItem = {
  id?: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type BookingType = "one_off" | "subscription";

export type BookingRecurrence = {
  /**
   * Interval in weeks between pickups.
   * 1 = weekly, 2 = every 2 weeks, etc.
   */
  intervalWeeks: number;
};

export type Booking = {
  id: string;
  userId: string;
  userEmail?: string; // Optional: stored for payment processing fallback
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  items: BookingBinItem[];
  totalPrice: number;
  status: BookingStatus;
  createdAt: Timestamp | null;
  /**
   * Whether this is a one-off pickup or a recurring subscription.
   * Existing bookings without this field are treated as "one_off".
   */
  type: BookingType;
  /**
   * Recurrence information for subscription bookings.
   * Undefined for one-off bookings.
   */
  recurrence?: BookingRecurrence;
  /**
   * Payment information for the booking.
   * Tracks payment status and allows retry/continue payment flow.
   */
  payment: BookingPayment;
  /**
   * When type === "subscription", the Firestore subscription document id.
   * Used to retry subscription payment (MoMo) from the booking card.
   */
  subscriptionId?: string;
};
