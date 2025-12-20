// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - native-only module types
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import type { TimeWindowId } from "@/lib/time-windows";

export type BookingStatus = "pending" | "completed" | "cancelled";

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
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  items: BookingBinItem[];
  totalPrice: number;
  status: BookingStatus;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
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
};
