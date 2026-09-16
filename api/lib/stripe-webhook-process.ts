import type { Firestore } from "firebase-admin/firestore";
import { PaymentFulfillmentError } from "./payment-fulfillment-core";
import type { WebhookProcessResult } from "./payment-integrity";
import {
  bookingIdFromStripeSession,
  paymentIntentIdFromSession,
  shouldFulfillStripeCheckout,
  type StripeApi,
  type StripeCheckoutSessionLike,
} from "./stripe-checkout";

type FulfillFn = (
  firestore: Firestore,
  params: {
    bookingId: string;
    source: "stripe";
    reference: string;
    webhookEvent: string;
    stripeCheckoutSessionId: string;
    stripePaymentIntentId?: string;
    Timestamp: unknown;
  }
) => Promise<{ jobId: string; created: boolean; alreadyFulfilled: boolean }>;

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function processStripeWebhookEvent(
  event: any,
  deps: {
    stripe: StripeApi;
    firestore: Firestore;
    fulfill: FulfillFn;
    serverTimestamp: () => unknown;
  }
): Promise<WebhookProcessResult> {
  const eventName = event?.type;
  const session = (event?.data?.object || {}) as StripeCheckoutSessionLike;
  if (
    eventName !== "checkout.session.completed" &&
    eventName !== "checkout.session.async_payment_succeeded" &&
    eventName !== "checkout.session.async_payment_failed" &&
    eventName !== "checkout.session.expired"
  ) {
    return { ok: true, duplicate: false };
  }

  const sessionId = trimId(session.id);
  if (!sessionId) {
    return { ok: false, retry: true, error: "Webhook missing Checkout Session id" };
  }

  let latest = session;
  try {
    latest = await deps.stripe.retrieveCheckoutSession(sessionId);
  } catch (err: any) {
    return {
      ok: false,
      retry: true,
      error: err?.message || "Failed to retrieve Checkout Session from Stripe",
    };
  }

  const bookingId =
    bookingIdFromStripeSession(latest) || bookingIdFromStripeSession(session);
  const paymentIntentId = paymentIntentIdFromSession(latest);
  const paymentStatus = String(latest.payment_status || "unpaid").toLowerCase();
  const amount =
    typeof latest.amount_total === "number" ? latest.amount_total / 100 : undefined;

  const paymentRef = deps.firestore.collection("payments").doc(sessionId);
  await paymentRef.set(
    {
      status:
        paymentStatus === "paid"
          ? "success"
          : eventName === "checkout.session.expired"
            ? "abandoned"
            : eventName === "checkout.session.async_payment_failed"
              ? "failed"
              : "initialized",
      stripeStatus: paymentStatus,
      reference: sessionId,
      source: "stripe",
      paymentMethod: "card",
      lastWebhookEvent: eventName,
      stripeCheckoutSessionId: sessionId,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(amount != null ? { amount } : {}),
      updatedAt: deps.serverTimestamp(),
    },
    { merge: true }
  );

  if (
    eventName === "checkout.session.async_payment_failed" ||
    eventName === "checkout.session.expired"
  ) {
    return { ok: true, duplicate: false };
  }

  if (
    !shouldFulfillStripeCheckout({
      eventName,
      paymentStatus: latest.payment_status,
    })
  ) {
    return { ok: true, duplicate: false };
  }

  if (!bookingId) {
    return {
      ok: false,
      retry: true,
      error: `Paid Stripe session ${sessionId} has no bookingId metadata`,
    };
  }

  try {
    const result = await deps.fulfill(deps.firestore, {
      bookingId,
      source: "stripe",
      reference: sessionId,
      webhookEvent: eventName,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      Timestamp: {} as any,
    });
    return { ok: true, duplicate: result.alreadyFulfilled, jobId: result.jobId };
  } catch (err: any) {
    const retry = !(err instanceof PaymentFulfillmentError) || err.retry;
    await paymentRef.set(
      {
        fulfillmentStatus: "failed",
        fulfillmentError: err?.message || "Fulfillment failed",
        updatedAt: deps.serverTimestamp(),
      },
      { merge: true }
    );
    return {
      ok: false,
      retry,
      error: err?.message || `Failed to fulfill booking ${bookingId}`,
    };
  }
}
