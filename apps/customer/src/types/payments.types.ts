import type { SubscriptionInterval } from "@/types/subscription";

/** Paystack transaction status from verify or webhook */
export type PaymentStatus = "success" | "failed" | "abandoned" | "pending";

export interface VerifyBookingPaymentRequest {
  bookingId: string;
  reference: string;
}

export interface VerifyBookingPaymentResponse {
  ok: boolean;
  paid: boolean;
  status?: string;
  message?: string;
  /** Paystack transaction reference when verification succeeded */
  reference?: string;
  amount?: number;
  currency?: string;
}

export type PaymentType = "one_time" | "subscription_initial" | "subscription_renewal";

/** Request for POST /api/paystack/initialize. paymentType is required; other fields depend on type. */
export type InitializePaymentRequest =
  | { paymentType: "one_time"; bookingId: string }
  | { paymentType: "subscription_renewal"; subscriptionId: string }
  | (CreateSubscriptionRequest & { paymentType: "subscription_initial" });

export interface InitializePaymentResponse {
  ok: boolean;
  authorizationUrl: string;
  reference: string;
}

export interface VerifyPaymentResponse {
  status: PaymentStatus;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

// --- Subscription (MoMo) ---

export type CollectionFrequency = "weekly" | "biweekly" | "monthly";

/** Item snapshot for payment/subscription: type, quantity, unitPrice, totalPrice */
export interface PaymentItemSnapshot {
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreateSubscriptionRequest {
  userId: string;
  email: string;
  /** Amount in GHS. Backend converts to pesewas for Paystack. */
  amount: number;
  /** Collection frequency (pickup schedule). Billing is always calendar monthly. */
  collectionFrequency: CollectionFrequency;
  collectionDay: string;
  /** ISO date (YYYY-MM-DD) — first collection / anchor for 28-day billing windows. */
  startDate?: string;
  /** Required: booking id for the subscription (created before calling this). */
  bookingId: string;
  /** Items being purchased (stored on subscription + payment for records). */
  items?: PaymentItemSnapshot[];
  /** Location/address (stored on subscription + payment for records). */
  location?: string;
  /** @deprecated Do not send — use collectionFrequency + collectionDay so biweekly is preserved. */
  interval?: SubscriptionInterval;
  collectionDayOfWeek?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSubscriptionResponse {
  authorizationUrl: string;
  reference: string;
  /** When set, backend created the subscription doc; app should not call saveSubscriptionRecord */
  subscriptionId?: string;
}

export interface GetSubscriptionPaymentUrlRequest {
  subscriptionId: string;
  reference?: string;
}

export interface GetSubscriptionPaymentUrlResponse {
  authorizationUrl: string;
}

export interface CancelSubscriptionRequest {
  /** Firestore subscription document id */
  subscriptionId?: string;
  /** Paystack subscription reference */
  reference?: string;
}
