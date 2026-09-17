"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapStripeSubscriptionStatus = mapStripeSubscriptionStatus;
exports.shouldCreateJobsForStripeInvoice = shouldCreateJobsForStripeInvoice;
exports.stripeSubscriptionMetaIds = stripeSubscriptionMetaIds;
exports.processStripeSubscriptionEvent = processStripeSubscriptionEvent;
const stripe_checkout_1 = require("./stripe-checkout");
function trimId(value) {
    return typeof value === "string" ? value.trim() : "";
}
function idFrom(value) {
    if (typeof value === "string")
        return value.trim();
    if (value && typeof value === "object" && typeof value.id === "string") {
        return String(value.id).trim();
    }
    return "";
}
function mapStripeSubscriptionStatus(stripeStatus) {
    switch (String(stripeStatus || "").toLowerCase()) {
        case "active":
        case "trialing":
            return "active";
        case "past_due":
        case "unpaid":
        case "incomplete":
        case "incomplete_expired":
            return "overdue";
        case "canceled":
        case "cancelled":
            return "cancelled";
        default:
            return "pending";
    }
}
function shouldCreateJobsForStripeInvoice(input) {
    if (!input.paid)
        return false;
    const reason = String(input.billingReason || "");
    return (reason === "subscription_create" ||
        reason === "subscription_cycle" ||
        reason === "" ||
        reason === "subscription_update");
}
function stripeSubscriptionMetaIds(input) {
    const meta = {
        ...(input.invoice?.metadata || {}),
        ...(input.subscription?.metadata || {}),
        ...(input.session?.metadata || {}),
    };
    return {
        subscriptionId: trimId(meta.subscriptionId),
        bookingId: trimId(meta.bookingId),
        userId: trimId(meta.userId),
    };
}
async function processStripeSubscriptionEvent(event, deps) {
    const eventName = String(event?.type || "");
    const object = event?.data?.object || {};
    if (eventName.startsWith("checkout.session.")) {
        const session = object;
        if (String(session.mode || "") !== "subscription") {
            return { ok: true, duplicate: false };
        }
        const sessionId = trimId(session.id);
        let latest = session;
        if (sessionId && deps.stripe.retrieveCheckoutSession) {
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
        }
        const ids = stripeSubscriptionMetaIds({ session: latest });
        if (!ids.subscriptionId) {
            return {
                ok: false,
                retry: true,
                error: "Stripe subscription checkout is missing subscriptionId metadata",
            };
        }
        if (eventName === "checkout.session.async_payment_failed" ||
            eventName === "checkout.session.expired") {
            if (deps.markFailed) {
                await deps.markFailed({
                    firestore: deps.firestore,
                    subscriptionId: ids.subscriptionId,
                    webhookEvent: eventName,
                });
            }
            return { ok: true, duplicate: false };
        }
        const paid = String(latest.payment_status || "").toLowerCase() === "paid";
        if (!paid)
            return { ok: true, duplicate: false };
        const processingId = (0, stripe_checkout_1.invoiceIdFromSession)(latest) || sessionId || `cs_${ids.subscriptionId}`;
        try {
            const result = await deps.applyPaidPeriod({
                firestore: deps.firestore,
                subscriptionId: ids.subscriptionId,
                bookingId: ids.bookingId,
                userId: ids.userId,
                processingId,
                stripeSubscriptionId: (0, stripe_checkout_1.subscriptionIdFromSession)(latest),
                stripeCustomerId: (0, stripe_checkout_1.customerIdFromSession)(latest),
                stripePriceId: (0, stripe_checkout_1.priceIdFromSession)(latest),
                stripeInvoiceId: (0, stripe_checkout_1.invoiceIdFromSession)(latest),
                stripeCheckoutSessionId: sessionId,
                webhookEvent: eventName,
                skipJobs: true,
            });
            return { ok: true, duplicate: result.duplicate };
        }
        catch (err) {
            return {
                ok: false,
                retry: true,
                error: err?.message || "Failed to apply Stripe subscription checkout",
            };
        }
    }
    if (eventName === "invoice.paid" || eventName === "invoice.payment_failed") {
        const invoice = object;
        const invoiceId = trimId(invoice.id);
        let latest = invoice;
        if (invoiceId && deps.stripe.retrieveInvoice) {
            try {
                latest = await deps.stripe.retrieveInvoice(invoiceId);
            }
            catch (err) {
                return {
                    ok: false,
                    retry: true,
                    error: err?.message || "Failed to retrieve invoice from Stripe",
                };
            }
        }
        const stripeSubId = idFrom(latest.subscription);
        let subscription = null;
        if (stripeSubId && deps.stripe.retrieveSubscription) {
            try {
                subscription = await deps.stripe.retrieveSubscription(stripeSubId);
            }
            catch (err) {
                return {
                    ok: false,
                    retry: true,
                    error: err?.message || "Failed to retrieve subscription from Stripe",
                };
            }
        }
        const ids = stripeSubscriptionMetaIds({ subscription, invoice: latest });
        if (!ids.subscriptionId) {
            return { ok: true, duplicate: false };
        }
        if (eventName === "invoice.payment_failed") {
            if (deps.markFailed) {
                await deps.markFailed({
                    firestore: deps.firestore,
                    subscriptionId: ids.subscriptionId,
                    webhookEvent: eventName,
                    processingId: invoiceId,
                });
            }
            return { ok: true, duplicate: false };
        }
        if (!shouldCreateJobsForStripeInvoice({
            paid: latest.paid === true || String(latest.status || "") === "paid",
            billingReason: latest.billing_reason,
        })) {
            return { ok: true, duplicate: false };
        }
        try {
            const result = await deps.applyPaidPeriod({
                firestore: deps.firestore,
                subscriptionId: ids.subscriptionId,
                bookingId: ids.bookingId,
                userId: ids.userId,
                processingId: invoiceId || `in_${ids.subscriptionId}`,
                stripeSubscriptionId: stripeSubId || undefined,
                stripeInvoiceId: invoiceId || undefined,
                webhookEvent: eventName,
            });
            return { ok: true, duplicate: result.duplicate };
        }
        catch (err) {
            return {
                ok: false,
                retry: true,
                error: err?.message || "Failed to apply Stripe invoice.paid",
            };
        }
    }
    if (eventName === "customer.subscription.updated" ||
        eventName === "customer.subscription.deleted" ||
        eventName === "customer.subscription.created") {
        const sub = object;
        const stripeSubId = trimId(sub.id);
        let latest = sub;
        if (stripeSubId && deps.stripe.retrieveSubscription) {
            try {
                latest = await deps.stripe.retrieveSubscription(stripeSubId);
            }
            catch (err) {
                return {
                    ok: false,
                    retry: true,
                    error: err?.message || "Failed to retrieve subscription from Stripe",
                };
            }
        }
        const ids = stripeSubscriptionMetaIds({ subscription: latest });
        if (!ids.subscriptionId)
            return { ok: true, duplicate: false };
        const mapped = mapStripeSubscriptionStatus(latest.status);
        if (mapped === "cancelled" && deps.markCancelled) {
            await deps.markCancelled({
                firestore: deps.firestore,
                subscriptionId: ids.subscriptionId,
                webhookEvent: eventName,
            });
        }
        else if (mapped === "overdue" && deps.markFailed) {
            await deps.markFailed({
                firestore: deps.firestore,
                subscriptionId: ids.subscriptionId,
                webhookEvent: eventName,
            });
        }
        else {
            await deps.firestore.collection("subscriptions").doc(ids.subscriptionId).set({
                status: mapped,
                stripeSubscriptionId: stripeSubId || latest.id,
                updatedAt: deps.serverTimestamp(),
                lastWebhookEvent: eventName,
            }, { merge: true });
        }
        return { ok: true, duplicate: false };
    }
    return { ok: true, duplicate: false };
}
