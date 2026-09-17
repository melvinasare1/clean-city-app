"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_CARD_THRESHOLD_MESSAGE = exports.STRIPE_CARD_MIN_AMOUNT_MAJOR = void 0;
exports.isStripeCardAvailable = isStripeCardAvailable;
/**
 * Card (Stripe) is only offered for one-time bookings above GHS 100.
 * Mobile Money (Paystack) stays available at every amount.
 */
exports.STRIPE_CARD_MIN_AMOUNT_MAJOR = 100;
exports.STRIPE_CARD_THRESHOLD_MESSAGE = "Stripe card payments are available for bookings above GHS 100.";
function isStripeCardAvailable(amountMajor) {
    const n = Number(amountMajor);
    return Number.isFinite(n) && n > exports.STRIPE_CARD_MIN_AMOUNT_MAJOR;
}
