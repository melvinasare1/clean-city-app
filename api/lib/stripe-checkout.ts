/**
 * Stripe Checkout helpers for one-time bookings.
 * Amount charged is the converted Stripe presentation amount (not GHS).
 */

import {
  isStripeChargeCurrency,
  stripeCurrencyMinorCode,
  type StripeChargeCurrency,
} from "./stripe-currency";

function assertStripeChargeCurrency(currency: unknown): StripeChargeCurrency {
  const code = String(currency || "").trim().toUpperCase();
  if (code === "GHS" || !isStripeChargeCurrency(code)) {
    throw new Error(
      "Stripe cannot charge GHS. Convert the GHS amount into USD, GBP, EUR, or CAD first."
    );
  }
  return code;
}

export type StripeCheckoutSessionLike = {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  mode?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  customer?: string | { id?: string } | null;
  invoice?: string | { id?: string } | null;
  metadata?: Record<string, string | undefined> | null;
  client_reference_id?: string | null;
  line_items?: {
    data?: Array<{
      price?: { id?: string } | string | null;
    }>;
  } | null;
};

export type StripeApi = {
  createCheckoutSession: (
    params: Record<string, string>,
    idempotencyKey: string
  ) => Promise<StripeCheckoutSessionLike>;
  retrieveCheckoutSession: (id: string) => Promise<StripeCheckoutSessionLike>;
};

export function ignoreClientSpecifiedAmount(
  serverAmountMajor: number,
  _clientAmount: unknown
): number {
  return serverAmountMajor;
}

export function amountToMinorUnits(amountMajor: number): number {
  return Math.round(Number(amountMajor) * 100);
}

export function stripeMetadata(input: {
  bookingId: string;
  userId: string;
  type?: string;
}): Record<string, string> {
  return {
    type: input.type || "one_time",
    bookingId: input.bookingId,
    userId: input.userId,
  };
}

export function stripeCheckoutIdempotencyKey(input: {
  bookingId: string;
  amountMinor: number;
  currency: string;
  previousUnusableSessionId?: string | null;
}): string {
  const currency = String(input.currency || "").toLowerCase();
  if (input.previousUnusableSessionId) {
    return `booking_checkout_${input.bookingId}_${currency}_${input.amountMinor}_${input.previousUnusableSessionId}`;
  }
  return `booking_checkout_${input.bookingId}_${currency}_${input.amountMinor}`;
}

export function canReuseCheckoutSession(
  session: StripeCheckoutSessionLike | null | undefined,
  amountMinor: number,
  currency: string
): boolean {
  if (!session?.id || !session.url) return false;
  if (session.status !== "open") return false;
  if (String(session.payment_status || "").toLowerCase() !== "unpaid") {
    return false;
  }
  if (session.amount_total != null && session.amount_total !== amountMinor) {
    return false;
  }
  if (
    session.currency &&
    String(session.currency).toLowerCase() !== String(currency).toLowerCase()
  ) {
    return false;
  }
  return true;
}

export function paymentIntentIdFromSession(
  session: StripeCheckoutSessionLike
): string | undefined {
  const pi = session.payment_intent;
  if (typeof pi === "string" && pi.trim()) return pi.trim();
  if (pi && typeof pi === "object" && typeof pi.id === "string" && pi.id.trim()) {
    return pi.id.trim();
  }
  return undefined;
}

export function subscriptionIdFromSession(
  session: StripeCheckoutSessionLike
): string | undefined {
  const sub = session.subscription;
  if (typeof sub === "string" && sub.trim()) return sub.trim();
  if (sub && typeof sub === "object" && typeof sub.id === "string" && sub.id.trim()) {
    return sub.id.trim();
  }
  return undefined;
}

export function customerIdFromSession(
  session: StripeCheckoutSessionLike
): string | undefined {
  const customer = session.customer;
  if (typeof customer === "string" && customer.trim()) return customer.trim();
  if (
    customer &&
    typeof customer === "object" &&
    typeof customer.id === "string" &&
    customer.id.trim()
  ) {
    return customer.id.trim();
  }
  return undefined;
}

export function invoiceIdFromSession(
  session: StripeCheckoutSessionLike
): string | undefined {
  const invoice = session.invoice;
  if (typeof invoice === "string" && invoice.trim()) return invoice.trim();
  if (
    invoice &&
    typeof invoice === "object" &&
    typeof invoice.id === "string" &&
    invoice.id.trim()
  ) {
    return invoice.id.trim();
  }
  return undefined;
}

export function priceIdFromSession(
  session: StripeCheckoutSessionLike
): string | undefined {
  const price = session.line_items?.data?.[0]?.price;
  if (typeof price === "string" && price.trim()) return price.trim();
  if (price && typeof price === "object" && typeof price.id === "string") {
    return price.id.trim() || undefined;
  }
  return undefined;
}

export function bookingIdFromStripeSession(
  session: StripeCheckoutSessionLike
): string {
  const fromMeta =
    typeof session.metadata?.bookingId === "string"
      ? session.metadata.bookingId.trim()
      : "";
  const fromClient =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id.trim()
      : "";
  return fromMeta || fromClient;
}

export function shouldFulfillStripeCheckout(input: {
  eventName: unknown;
  paymentStatus: unknown;
  mode?: unknown;
}): boolean {
  const mode = String(input.mode || "payment").toLowerCase();
  if (mode === "subscription") return false;
  const event = String(input.eventName || "");
  if (
    event !== "checkout.session.completed" &&
    event !== "checkout.session.async_payment_succeeded"
  ) {
    return false;
  }
  return String(input.paymentStatus || "").toLowerCase() === "paid";
}

export function buildCheckoutSessionForm(input: {
  bookingId: string;
  userId: string;
  email: string;
  amountMinor: number;
  currency: StripeChargeCurrency;
  successUrl: string;
  cancelUrl: string;
}): Record<string, string> {
  const metadata = stripeMetadata({
    bookingId: input.bookingId,
    userId: input.userId,
  });
  const currency = stripeCurrencyMinorCode(assertStripeChargeCurrency(input.currency));
  return {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.email,
    client_reference_id: input.bookingId,
    origin_context: "mobile_app",
    "payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(input.amountMinor),
    "line_items[0][price_data][product_data][name]": "Clean City pickup",
    "metadata[type]": metadata.type,
    "metadata[bookingId]": metadata.bookingId,
    "metadata[userId]": metadata.userId,
    "payment_intent_data[metadata][type]": metadata.type,
    "payment_intent_data[metadata][bookingId]": metadata.bookingId,
    "payment_intent_data[metadata][userId]": metadata.userId,
  };
}

export function buildSubscriptionCheckoutForm(input: {
  bookingId: string;
  userId: string;
  subscriptionId: string;
  email: string;
  amountMinor: number;
  currency: StripeChargeCurrency;
  successUrl: string;
  cancelUrl: string;
  stripePriceId?: string | null;
}): Record<string, string> {
  const currency = stripeCurrencyMinorCode(assertStripeChargeCurrency(input.currency));
  const lineItem = input.stripePriceId
    ? {
        "line_items[0][price]": input.stripePriceId,
        "line_items[0][quantity]": "1",
      }
    : {
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": currency,
        "line_items[0][price_data][unit_amount]": String(input.amountMinor),
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][price_data][product_data][name]": "Clean City subscription",
      };
  return {
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.email,
    client_reference_id: input.subscriptionId,
    origin_context: "mobile_app",
    "payment_method_types[0]": "card",
    ...lineItem,
    "metadata[type]": "subscription",
    "metadata[bookingId]": input.bookingId,
    "metadata[userId]": input.userId,
    "metadata[subscriptionId]": input.subscriptionId,
    "subscription_data[metadata][type]": "subscription",
    "subscription_data[metadata][bookingId]": input.bookingId,
    "subscription_data[metadata][userId]": input.userId,
    "subscription_data[metadata][subscriptionId]": input.subscriptionId,
  };
}

export async function getOrCreateStripeCheckoutSession(input: {
  bookingId: string;
  userId: string;
  email: string;
  amountMinor: number;
  currency: StripeChargeCurrency;
  existingSessionId?: string | null;
  successUrl: string;
  cancelUrl: string;
  stripe: StripeApi;
}): Promise<{ session: StripeCheckoutSessionLike; reused: boolean }> {
  const amountMinor = input.amountMinor;
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error("Booking has no valid Stripe amount");
  }
  const currencyCode = stripeCurrencyMinorCode(
    assertStripeChargeCurrency(input.currency)
  );

  let previousUnusableSessionId: string | null = null;
  if (input.existingSessionId) {
    try {
      const existing = await input.stripe.retrieveCheckoutSession(
        input.existingSessionId
      );
      if (canReuseCheckoutSession(existing, amountMinor, currencyCode)) {
        return { session: existing, reused: true };
      }
      previousUnusableSessionId = existing.id;
    } catch (err) {
      console.error(
        "[stripe] retrieve existing checkout session failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const created = await input.stripe.createCheckoutSession(
    buildCheckoutSessionForm({
      bookingId: input.bookingId,
      userId: input.userId,
      email: input.email,
      amountMinor,
      currency: input.currency,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    }),
    stripeCheckoutIdempotencyKey({
      bookingId: input.bookingId,
      amountMinor,
      currency: currencyCode,
      previousUnusableSessionId,
    })
  );
  return { session: created, reused: false };
}
