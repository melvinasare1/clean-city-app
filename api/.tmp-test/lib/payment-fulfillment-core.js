"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentFulfillmentError = void 0;
exports.executePaidOneTimeFulfillment = executePaidOneTimeFulfillment;
const payment_integrity_1 = require("./payment-integrity");
class PaymentFulfillmentError extends Error {
    constructor(message, retry = true) {
        super(message);
        this.name = "PaymentFulfillmentError";
        this.retry = retry;
    }
}
exports.PaymentFulfillmentError = PaymentFulfillmentError;
function jobItemsFromBooking(booking) {
    const items = booking.items;
    if (!Array.isArray(items))
        return [];
    return items
        .map((i, idx) => ({
        id: i?.id ??
            (i?.type ? String(i.type).replace(/\s+/g, "_").toUpperCase() : `ITEM_${idx}`),
        type: String(i?.type ?? ""),
        quantity: Number(i?.quantity) ?? 0,
        unitPrice: Number(i?.unitPrice) ?? 0,
        totalPrice: Number(i?.totalPrice) ?? 0,
    }))
        .filter((i) => i.type);
}
function addressFromBooking(booking) {
    const loc = booking.location != null ? String(booking.location) : "";
    const meta = booking.metadata && typeof booking.metadata === "object"
        ? booking.metadata
        : {};
    const addressSnapshot = {
        addressLine1: String(meta.addressLine1 ?? booking.addressLine1 ?? loc ?? ""),
        area: String(meta.area ?? booking.area ?? ""),
        phoneNumber: String(meta.phoneNumber ?? booking.phoneNumber ?? ""),
    };
    const bookingDate = booking.date;
    let scheduledDate = new Date();
    if (typeof bookingDate === "string")
        scheduledDate = new Date(bookingDate);
    else if (bookingDate instanceof Date)
        scheduledDate = bookingDate;
    return {
        location: loc,
        addressSnapshot,
        windowId: String(booking.windowId ?? "morning"),
        windowLabel: String(booking.windowLabel ?? ""),
        scheduledDate,
    };
}
async function executePaidOneTimeFulfillment(input) {
    const booking = await input.loadBooking(input.bookingId);
    if (!booking) {
        throw new PaymentFulfillmentError(`Booking ${input.bookingId} not found`, false);
    }
    if (!(0, payment_integrity_1.shouldCreateOneTimeJob)({
        verifiedPaid: true,
        bookingType: booking.type,
    })) {
        return { jobId: "", created: false, alreadyFulfilled: true };
    }
    const snapshot = addressFromBooking(booking);
    let created = false;
    let jobId;
    try {
        const result = await input.createJob({
            bookingId: input.bookingId,
            userId: booking.userId,
            scheduledDate: snapshot.scheduledDate,
            items: jobItemsFromBooking(booking),
            location: snapshot.location,
            addressSnapshot: snapshot.addressSnapshot,
            windowId: snapshot.windowId,
            windowLabel: snapshot.windowLabel,
            paymentReference: input.reference,
            paymentMethod: input.source === "stripe" ? "card" : "momo",
        });
        jobId = result.jobId;
        created = result.created;
    }
    catch (err) {
        throw new PaymentFulfillmentError(err?.message || `Failed to create job for booking ${input.bookingId}`, true);
    }
    if (!jobId) {
        throw new PaymentFulfillmentError(`Job id missing after fulfillment for booking ${input.bookingId}`, true);
    }
    try {
        await input.writeBookingPaid({
            bookingId: input.bookingId,
            jobId,
            source: input.source,
            reference: input.reference,
            stripeCheckoutSessionId: input.stripeCheckoutSessionId,
            stripePaymentIntentId: input.stripePaymentIntentId,
        });
    }
    catch (err) {
        throw new PaymentFulfillmentError(err?.message || `Failed to mark booking ${input.bookingId} paid after job ${jobId}`, true);
    }
    if (input.reference && input.writePaymentReconciled) {
        try {
            await input.writePaymentReconciled({
                reference: input.reference,
                bookingId: input.bookingId,
                jobId,
                source: input.source,
                webhookEvent: input.webhookEvent,
                stripeCheckoutSessionId: input.stripeCheckoutSessionId,
                stripePaymentIntentId: input.stripePaymentIntentId,
            });
        }
        catch (err) {
            throw new PaymentFulfillmentError(err?.message || `Failed to persist payment ${input.reference} reconciliation fields`, true);
        }
    }
    return { jobId, created, alreadyFulfilled: !created };
}
