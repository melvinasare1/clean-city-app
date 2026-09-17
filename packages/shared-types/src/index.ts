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

export type DriverPaymentMethods = {
  cash: boolean;
  card: boolean;
  cashAndCard: boolean;
};

export const DEFAULT_DRIVER_PRIORITY = 100;

export const DEFAULT_DRIVER_PAYMENT_METHODS: DriverPaymentMethods = {
  cash: true,
  card: true,
  cashAndCard: true,
};

export interface Driver {
  uid: string;
  status: DriverStatus;
  email?: string;
  expoPushToken?: string;
  name?: string;
  phone?: string;
  photoURL?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  serviceProviderName?: string | null;
  paymentMethods?: DriverPaymentMethods;
  /** 0–100. Higher is better. Defaults to 100. */
  priority?: number;
  /** Defaults to true. When false, the client clears expoPushToken. */
  notificationsEnabled?: boolean;
  /** Out of 5. Running average computed from customer ratings via submitDriverRating. */
  rating?: number | null;
  /** Number of ratings included in `rating`'s average. */
  ratingCount?: number;
  jobsCompletedCount?: number;
}

export type BookingStatus = "pending" | "completed" | "cancelled" | "missed";

export type BookingPaymentStatus = "unpaid" | "initiated" | "paid";

export type BookingPayment = {
  status: BookingPaymentStatus;
  reference?: string;
  authorizationUrl?: string;
  amount?: number;
  initiatedAt?: Timestamp;
  paidAt?: Timestamp;
  referenceHistory?: string[];
  jobId?: string;
  source?: "paystack" | "stripe" | "admin" | "free";
  fulfillmentStatus?: "pending" | "fulfilled" | "failed";
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  sourceAmountGhs?: number;
  sourceCurrency?: "GHS";
  stripeCurrency?: string;
  exchangeRate?: number;
  fxProvider?: string;
  fxTimestamp?: string;
  convertedAmount?: number;
  stripeSurchargePercent?: number;
  stripeSurchargeAmount?: number;
  finalStripeAmount?: number;
  stripeAmountMinor?: number;
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

export type BookingCustomerRating = {
  stars: number;
  comment: string | null;
  ratedAt: Timestamp;
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
  /** Set once by submitDriverRating; a booking can only be rated once. */
  customerRating?: BookingCustomerRating | null;
  /** Set when a driver records an unable-to-collect / missed pickup. */
  completionOutcome?: BookingCompletionOutcome | null;
};

/** @deprecated Use BookingPaymentStatus. Kept so existing `PaymentStatus` imports keep compiling. */
export type PaymentStatus = BookingPaymentStatus;

// Kept in sync by hand with CANCEL_REASON_CODES in functions/src/job-offers.ts —
// Cloud Functions can't depend on this workspace package.
export const CANCEL_REASON_CODES = [
  "NO_SPACE",
  "CUSTOMER_UNAVAILABLE",
  "CUSTOMER_REQUESTED",
  "SAFETY_ACCESS",
  "OTHER",
] as const;

export type CancelReasonCode = (typeof CANCEL_REASON_CODES)[number];

export const CANCEL_REASON_LABELS: Record<CancelReasonCode, string> = {
  NO_SPACE: "Not enough space for the load",
  CUSTOMER_UNAVAILABLE: "Customer not home/unavailable",
  CUSTOMER_REQUESTED: "Customer asked to cancel",
  SAFETY_ACCESS: "Safety or access issue",
  OTHER: "Other",
};

// Kept in sync by hand with MISSED_REASON_CODES in functions/src/job-outcome.ts
// and api/lib/job-outcome.ts — Cloud Functions / Vercel API can't depend on this package.
export const MISSED_REASON_CODES = [
  "BIN_NOT_AVAILABLE",
  "CUSTOMER_UNAVAILABLE",
  "INACCESSIBLE_ADDRESS",
  "EXCESS_WASTE",
  "ACCESS_SAFETY",
  "OTHER",
] as const;

export type MissedReasonCode = (typeof MISSED_REASON_CODES)[number];

export const MISSED_REASON_LABELS: Record<MissedReasonCode, string> = {
  BIN_NOT_AVAILABLE: "Bin not available",
  CUSTOMER_UNAVAILABLE: "Customer unavailable",
  INACCESSIBLE_ADDRESS: "Incorrect/inaccessible address",
  EXCESS_WASTE: "Excess waste",
  ACCESS_SAFETY: "Access/safety issue",
  OTHER: "Other",
};

export type BookingCompletionOutcome = {
  type: "missed";
  reason: MissedReasonCode;
  note: string | null;
  recordedAt: Timestamp;
  recordedBy: string;
  photoUrl?: string | null;
};
