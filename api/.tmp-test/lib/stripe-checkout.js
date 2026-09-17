"use strict";
/**
 * Stripe Checkout helpers for one-time bookings.
 * Amount charged is the converted Stripe presentation amount (not GHS).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ignoreClientSpecifiedAmount = ignoreClientSpecifiedAmount;
exports.amountToMinorUnits = amountToMinorUnits;
exports.stripeMetadata = stripeMetadata;
exports.stripeCheckoutIdempotencyKey = stripeCheckoutIdempotencyKey;
exports.canReuseCheckoutSession = canReuseCheckoutSession;
exports.paymentIntentIdFromSession = paymentIntentIdFromSession;
exports.subscriptionIdFromSession = subscriptionIdFromSession;
exports.customerIdFromSession = customerIdFromSession;
exports.invoiceIdFromSession = invoiceIdFromSession;
exports.priceIdFromSession = priceIdFromSession;
exports.bookingIdFromStripeSession = bookingIdFromStripeSession;
exports.shouldFulfillStripeCheckout = shouldFulfillStripeCheckout;
exports.buildCheckoutSessionForm = buildCheckoutSessionForm;
exports.buildSubscriptionCheckoutForm = buildSubscriptionCheckoutForm;
exports.getOrCreateStripeCheckoutSession = getOrCreateStripeCheckoutSession;
const stripe_currency_1 = require("./stripe-currency");
function assertStripeChargeCurrency(currency) {
    const code = String(currency || "").trim().toUpperCase();
    if (code === "GHS" || !(0, stripe_currency_1.isStripeChargeCurrency)(code)) {
        throw new Error("Stripe cannot charge GHS. Convert the GHS amount into USD, GBP, EUR, or CAD first.");
    }
    return code;
}
function ignoreClientSpecifiedAmount(serverAmountMajor, _clientAmount) {
    return serverAmountMajor;
}
function amountToMinorUnits(amountMajor) {
    return Math.round(Number(amountMajor) * 100);
}
function stripeMetadata(input) {
    return {
        type: input.type || "one_time",
        bookingId: input.bookingId,
        userId: input.userId,
    };
}
function stripeCheckoutIdempotencyKey(input) {
    const currency = String(input.currency || "").toLowerCase();
    if (input.previousUnusableSessionId) {
        return `booking_checkout_${input.bookingId}_${currency}_${input.amountMinor}_${input.previousUnusableSessionId}`;
    }
    return `booking_checkout_${input.bookingId}_${currency}_${input.amountMinor}`;
}
function canReuseCheckoutSession(session, amountMinor, currency) {
    if (!session?.id || !session.url)
        return false;
    if (session.status !== "open")
        return false;
    if (String(session.payment_status || "").toLowerCase() !== "unpaid") {
        return false;
    }
    if (session.amount_total != null && session.amount_total !== amountMinor) {
        return false;
    }
    if (session.currency &&
        String(session.currency).toLowerCase() !== String(currency).toLowerCase()) {
        return false;
    }
    return true;
}
function paymentIntentIdFromSession(session) {
    const pi = session.payment_intent;
    if (typeof pi === "string" && pi.trim())
        return pi.trim();
    if (pi && typeof pi === "object" && typeof pi.id === "string" && pi.id.trim()) {
        return pi.id.trim();
    }
    return undefined;
}
function subscriptionIdFromSession(session) {
    const sub = session.subscription;
    if (typeof sub === "string" && sub.trim())
        return sub.trim();
    if (sub && typeof sub === "object" && typeof sub.id === "string" && sub.id.trim()) {
        return sub.id.trim();
    }
    return undefined;
}
function customerIdFromSession(session) {
    const customer = session.customer;
    if (typeof customer === "string" && customer.trim())
        return customer.trim();
    if (customer &&
        typeof customer === "object" &&
        typeof customer.id === "string" &&
        customer.id.trim()) {
        return customer.id.trim();
    }
    return undefined;
}
function invoiceIdFromSession(session) {
    const invoice = session.invoice;
    if (typeof invoice === "string" && invoice.trim())
        return invoice.trim();
    if (invoice &&
        typeof invoice === "object" &&
        typeof invoice.id === "string" &&
        invoice.id.trim()) {
        return invoice.id.trim();
    }
    return undefined;
}
function priceIdFromSession(session) {
    const price = session.line_items?.data?.[0]?.price;
    if (typeof price === "string" && price.trim())
        return price.trim();
    if (price && typeof price === "object" && typeof price.id === "string") {
        return price.id.trim() || undefined;
    }
    return undefined;
}
function bookingIdFromStripeSession(session) {
    const fromMeta = typeof session.metadata?.bookingId === "string"
        ? session.metadata.bookingId.trim()
        : "";
    const fromClient = typeof session.client_reference_id === "string"
        ? session.client_reference_id.trim()
        : "";
    return fromMeta || fromClient;
}
function shouldFulfillStripeCheckout(input) {
    const mode = String(input.mode || "payment").toLowerCase();
    if (mode === "subscription")
        return false;
    const event = String(input.eventName || "");
    if (event !== "checkout.session.completed" &&
        event !== "checkout.session.async_payment_succeeded") {
        return false;
    }
    return String(input.paymentStatus || "").toLowerCase() === "paid";
}
function buildCheckoutSessionForm(input) {
    const metadata = stripeMetadata({
        bookingId: input.bookingId,
        userId: input.userId,
    });
    const currency = (0, stripe_currency_1.stripeCurrencyMinorCode)(assertStripeChargeCurrency(input.currency));
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
function buildSubscriptionCheckoutForm(input) {
    const currency = (0, stripe_currency_1.stripeCurrencyMinorCode)(assertStripeChargeCurrency(input.currency));
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
async function getOrCreateStripeCheckoutSession(input) {
    const amountMinor = input.amountMinor;
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new Error("Booking has no valid Stripe amount");
    }
    const currencyCode = (0, stripe_currency_1.stripeCurrencyMinorCode)(assertStripeChargeCurrency(input.currency));
    let previousUnusableSessionId = null;
    if (input.existingSessionId) {
        try {
            const existing = await input.stripe.retrieveCheckoutSession(input.existingSessionId);
            if (canReuseCheckoutSession(existing, amountMinor, currencyCode)) {
                return { session: existing, reused: true };
            }
            previousUnusableSessionId = existing.id;
        }
        catch (err) {
            console.error("[stripe] retrieve existing checkout session failed:", err instanceof Error ? err.message : err);
        }
    }
    const created = await input.stripe.createCheckoutSession(buildCheckoutSessionForm({
        bookingId: input.bookingId,
        userId: input.userId,
        email: input.email,
        amountMinor,
        currency: input.currency,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
    }), stripeCheckoutIdempotencyKey({
        bookingId: input.bookingId,
        amountMinor,
        currency: currencyCode,
        previousUnusableSessionId,
    }));
    return { session: created, reused: false };
}
