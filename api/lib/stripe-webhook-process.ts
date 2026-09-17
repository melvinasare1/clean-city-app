import type { Firestore } from "firebase-admin/firestore";
import { PaymentFulfillmentError } from "./payment-fulfillment-core";
import type { WebhookProcessResult } from "./payment-integrity";
import {
  bookingIdFromStripeSession,
  paymentIntentIdFromSession,
  shouldFulfillStripeCheckout,
  type StripeCheckoutSessionLike,
} from "./stripe-checkout";
import {
  processStripeSubscriptionEvent,
  type StripeBillingApi,
} from "./stripe-subscription-process";
import { fromMinorUnits } from "./stripe-fx";

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

function isSubscriptionEvent(eventName: string, object: any): boolean {
  if (eventName.startsWith("invoice.")) return true;
  if (eventName.startsWith("customer.subscription.")) return true;
  if (eventName.startsWith("checkout.session.")) {
    return (
      String(object?.mode || "").toLowerCase() === "subscription" ||
      String(object?.metadata?.type || "") === "subscription"
    );
  }
  return false;
}

export async function processStripeWebhookEvent(
  event: any,
  deps: {
    stripe: StripeBillingApi;
    firestore: Firestore;
    fulfill: FulfillFn;
    serverTimestamp: () => unknown;
    applyPaidSubscriptionPeriod?: Parameters<
      typeof processStripeSubscriptionEvent
    >[1]["applyPaidPeriod"];
    markSubscriptionFailed?: Parameters<
      typeof processStripeSubscriptionEvent
    >[1]["markFailed"];
    markSubscriptionCancelled?: Parameters<
      typeof processStripeSubscriptionEvent
    >[1]["markCancelled"];
  }
): Promise<WebhookProcessResult> {
  const eventName = String(event?.type || "");
  const object = event?.data?.object || {};

  if (isSubscriptionEvent(eventName, object)) {
    if (!deps.applyPaidSubscriptionPeriod) {
      return {
        ok: false,
        retry: true,
        error: "Stripe subscription webhook handler is not configured",
      };
    }
    return processStripeSubscriptionEvent(event, {
      stripe: deps.stripe,
      firestore: deps.firestore,
      serverTimestamp: deps.serverTimestamp,
      applyPaidPeriod: deps.applyPaidSubscriptionPeriod,
      markFailed: deps.markSubscriptionFailed,
      markCancelled: deps.markSubscriptionCancelled,
    });
  }

  if (
    eventName !== "checkout.session.completed" &&
    eventName !== "checkout.session.async_payment_succeeded" &&
    eventName !== "checkout.session.async_payment_failed" &&
    eventName !== "checkout.session.expired"
  ) {
    return { ok: true, duplicate: false };
  }

  const session = object as StripeCheckoutSessionLike;
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
  const stripeChargeAmount =
    typeof latest.amount_total === "number"
      ? fromMinorUnits(latest.amount_total)
      : undefined;
  const stripeChargeCurrency = latest.currency
    ? String(latest.currency).toUpperCase()
    : undefined;

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
      ...(stripeChargeAmount != null ? { stripeChargeAmount } : {}),
      ...(stripeChargeCurrency ? { stripeChargeCurrency } : {}),
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
      mode: latest.mode,
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
