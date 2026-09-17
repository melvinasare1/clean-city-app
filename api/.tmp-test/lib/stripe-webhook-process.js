"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processStripeWebhookEvent = processStripeWebhookEvent;
const payment_fulfillment_core_1 = require("./payment-fulfillment-core");
const stripe_checkout_1 = require("./stripe-checkout");
const stripe_subscription_process_1 = require("./stripe-subscription-process");
const stripe_fx_1 = require("./stripe-fx");
function trimId(value) {
    return typeof value === "string" ? value.trim() : "";
}
function isSubscriptionEvent(eventName, object) {
    if (eventName.startsWith("invoice."))
        return true;
    if (eventName.startsWith("customer.subscription."))
        return true;
    if (eventName.startsWith("checkout.session.")) {
        return (String(object?.mode || "").toLowerCase() === "subscription" ||
            String(object?.metadata?.type || "") === "subscription");
    }
    return false;
}
async function processStripeWebhookEvent(event, deps) {
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
        return (0, stripe_subscription_process_1.processStripeSubscriptionEvent)(event, {
            stripe: deps.stripe,
            firestore: deps.firestore,
            serverTimestamp: deps.serverTimestamp,
            applyPaidPeriod: deps.applyPaidSubscriptionPeriod,
            markFailed: deps.markSubscriptionFailed,
            markCancelled: deps.markSubscriptionCancelled,
        });
    }
    if (eventName !== "checkout.session.completed" &&
        eventName !== "checkout.session.async_payment_succeeded" &&
        eventName !== "checkout.session.async_payment_failed" &&
        eventName !== "checkout.session.expired") {
        return { ok: true, duplicate: false };
    }
    const session = object;
    const sessionId = trimId(session.id);
    if (!sessionId) {
        return { ok: false, retry: true, error: "Webhook missing Checkout Session id" };
    }
    let latest = session;
    try {
        latest = await deps.stripe.retrieveCheckoutSession(sessionId);
    }
    catch (err) {
        return {
            ok: false,
            retry: true,
            error: err?.message || "Failed to retrieve Checkout Session from Stripe",
        };
    }
    const bookingId = (0, stripe_checkout_1.bookingIdFromStripeSession)(latest) || (0, stripe_checkout_1.bookingIdFromStripeSession)(session);
    const paymentIntentId = (0, stripe_checkout_1.paymentIntentIdFromSession)(latest);
    const paymentStatus = String(latest.payment_status || "unpaid").toLowerCase();
    const stripeChargeAmount = typeof latest.amount_total === "number"
        ? (0, stripe_fx_1.fromMinorUnits)(latest.amount_total)
        : undefined;
    const stripeChargeCurrency = latest.currency
        ? String(latest.currency).toUpperCase()
        : undefined;
    const paymentRef = deps.firestore.collection("payments").doc(sessionId);
    await paymentRef.set({
        status: paymentStatus === "paid"
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
    }, { merge: true });
    if (eventName === "checkout.session.async_payment_failed" ||
        eventName === "checkout.session.expired") {
        return { ok: true, duplicate: false };
    }
    if (!(0, stripe_checkout_1.shouldFulfillStripeCheckout)({
        eventName,
        paymentStatus: latest.payment_status,
        mode: latest.mode,
    })) {
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
            Timestamp: {},
        });
        return { ok: true, duplicate: result.alreadyFulfilled, jobId: result.jobId };
    }
    catch (err) {
        const retry = !(err instanceof payment_fulfillment_core_1.PaymentFulfillmentError) || err.retry;
        await paymentRef.set({
            fulfillmentStatus: "failed",
            fulfillmentError: err?.message || "Fulfillment failed",
            updatedAt: deps.serverTimestamp(),
        }, { merge: true });
        return {
            ok: false,
            retry,
            error: err?.message || `Failed to fulfill booking ${bookingId}`,
        };
    }
}
