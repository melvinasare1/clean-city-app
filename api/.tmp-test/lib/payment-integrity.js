"use strict";
/**
 * Pure payment → job integrity rules.
 * Job creation must follow verified Paystack evidence or an explicit admin/free path.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.oneTimeJobDocId = oneTimeJobDocId;
exports.isSuccessfulPaystackStatus = isSuccessfulPaystackStatus;
exports.isChargeSuccessEvent = isChargeSuccessEvent;
exports.isSuccessfulStripePaymentStatus = isSuccessfulStripePaymentStatus;
exports.isStripeFulfillmentEvent = isStripeFulfillmentEvent;
exports.resolveEvidenceBookingId = resolveEvidenceBookingId;
exports.shouldCreateOneTimeJob = shouldCreateOneTimeJob;
exports.isFulfillmentComplete = isFulfillmentComplete;
exports.webhookHttpStatus = webhookHttpStatus;
function oneTimeJobDocId(bookingId) {
    return `one_time_${bookingId}`;
}
function isSuccessfulPaystackStatus(status) {
    return String(status || "").toLowerCase() === "success";
}
function isChargeSuccessEvent(eventName) {
    return eventName === "charge.success";
}
function isSuccessfulStripePaymentStatus(status) {
    return String(status || "").toLowerCase() === "paid";
}
function isStripeFulfillmentEvent(eventName) {
    return (eventName === "checkout.session.completed" ||
        eventName === "checkout.session.async_payment_succeeded");
}
/**
 * Bind a Paystack transaction to a booking using server-side evidence only.
 * Client-supplied bookingId is accepted only when it matches metadata or the payments doc.
 */
function resolveEvidenceBookingId(input) {
    const client = trimId(input.clientBookingId);
    const fromMeta = trimId(input.metadataBookingId);
    const fromPayment = trimId(input.paymentDocBookingId);
    const fromStoredRef = trimId(input.referenceLoadedFromBookingId);
    const evidence = fromMeta || fromPayment || fromStoredRef;
    if (!evidence) {
        return {
            error: "No server-side bookingId on this transaction. Client bookingId is not sufficient.",
        };
    }
    if (client && client !== evidence) {
        return {
            error: "Payment reference does not belong to the requested booking.",
        };
    }
    return { bookingId: evidence };
}
function shouldCreateOneTimeJob(input) {
    if (!input.verifiedPaid)
        return false;
    const type = String(input.bookingType || "one_time");
    return type !== "subscription";
}
function isFulfillmentComplete(input) {
    if (input.bookingPaymentStatus !== "paid")
        return false;
    if (!input.jobId || !input.bookingJobId)
        return false;
    if (input.jobId !== input.bookingJobId)
        return false;
    if (input.jobBookingId !== input.expectedBookingId)
        return false;
    return true;
}
function webhookHttpStatus(result) {
    if ("retry" in result && result.ok === false) {
        return result.retry ? 500 : 400;
    }
    return 200;
}
function trimId(value) {
    return typeof value === "string" ? value.trim() : "";
}
