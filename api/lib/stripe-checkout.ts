/**
 * Stripe Checkout helpers for one-time bookings.
 * Amount, currency, and booking identity always come from the server-side booking.
 */

export const STRIPE_CURRENCY = "ghs";

export type StripeCheckoutSessionLike = {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string | undefined> | null;
  client_reference_id?: string | null;
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
}): Record<string, string> {
  return {
    type: "one_time",
    bookingId: input.bookingId,
    userId: input.userId,
  };
}

export function stripeCheckoutIdempotencyKey(input: {
  bookingId: string;
  amountMinor: number;
  previousUnusableSessionId?: string | null;
}): string {
  if (input.previousUnusableSessionId) {
    return `booking_checkout_${input.bookingId}_${input.amountMinor}_${input.previousUnusableSessionId}`;
  }
  return `booking_checkout_${input.bookingId}_${input.amountMinor}`;
}

export function canReuseCheckoutSession(
  session: StripeCheckoutSessionLike | null | undefined,
  amountMinor: number,
  currency = STRIPE_CURRENCY
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
    String(session.currency).toLowerCase() !== currency.toLowerCase()
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
}): boolean {
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
  successUrl: string;
  cancelUrl: string;
}): Record<string, string> {
  const metadata = stripeMetadata({
    bookingId: input.bookingId,
    userId: input.userId,
  });
  return {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.email,
    client_reference_id: input.bookingId,
    currency: STRIPE_CURRENCY,
    origin_context: "mobile_app",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": STRIPE_CURRENCY,
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

export async function getOrCreateStripeCheckoutSession(input: {
  bookingId: string;
  userId: string;
  email: string;
  serverAmountMajor: number;
  clientAmount?: unknown;
  existingSessionId?: string | null;
  successUrl: string;
  cancelUrl: string;
  stripe: StripeApi;
}): Promise<{ session: StripeCheckoutSessionLike; reused: boolean }> {
  const amountMajor = ignoreClientSpecifiedAmount(
    input.serverAmountMajor,
    input.clientAmount
  );
  const amountMinor = amountToMinorUnits(amountMajor);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error("Booking has no valid amount");
  }

  if (input.existingSessionId) {
    try {
      const existing = await input.stripe.retrieveCheckoutSession(
        input.existingSessionId
      );
      if (canReuseCheckoutSession(existing, amountMinor)) {
        return { session: existing, reused: true };
      }
      const created = await input.stripe.createCheckoutSession(
        buildCheckoutSessionForm({
          bookingId: input.bookingId,
          userId: input.userId,
          email: input.email,
          amountMinor,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        }),
        stripeCheckoutIdempotencyKey({
          bookingId: input.bookingId,
          amountMinor,
          previousUnusableSessionId: existing.id,
        })
      );
      return { session: created, reused: false };
    } catch {
      // Fall through and create a fresh session if retrieve fails.
    }
  }

  const created = await input.stripe.createCheckoutSession(
    buildCheckoutSessionForm({
      bookingId: input.bookingId,
      userId: input.userId,
      email: input.email,
      amountMinor,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    }),
    stripeCheckoutIdempotencyKey({
      bookingId: input.bookingId,
      amountMinor,
    })
  );
  return { session: created, reused: false };
}
