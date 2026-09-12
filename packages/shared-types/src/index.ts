import type { Timestamp } from "firebase/firestore";

export type TimeWindowId = "MORNING" | "AFTERNOON" | "EVENING";

export type UserRole = "customer" | "driver";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  location?: string;
  displayName?: string;
  phoneNumber?: string;
  createdAt?: Date;
}

export type DriverStatus = "pending" | "approved" | "suspended";
export type DriverAccountStatus = DriverStatus;

export interface Driver {
  uid: string;
  status: DriverStatus;
  email?: string;
  expoPushToken?: string;
  name?: string;
  phone?: string;
}

export type BookingStatus = "pending" | "completed" | "cancelled";

export type BookingPaymentStatus = "unpaid" | "initiated" | "paid";

export type BookingPayment = {
  status: BookingPaymentStatus;
  reference?: string;
  authorizationUrl?: string;
  amount?: number;
  initiatedAt?: Timestamp;
  paidAt?: Timestamp;
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
  intervalWeeks: number;
};

export type Booking = {
  id: string;
  userId: string;
  userEmail?: string;
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  items: BookingBinItem[];
  totalPrice: number;
  status: BookingStatus;
  createdAt: Timestamp | null;
  type: BookingType;
  recurrence?: BookingRecurrence;
  payment: BookingPayment;
  subscriptionId?: string;
  driverId?: string | null;
  driverName?: string | null;
  declinedBy?: string[];
};

/** @deprecated Use BookingPaymentStatus. Kept so existing `PaymentStatus` imports keep compiling. */
export type PaymentStatus = BookingPaymentStatus;
