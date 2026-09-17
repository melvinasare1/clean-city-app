/**
 * Card (Stripe) is only offered for one-time bookings above GHS 100.
 * Mobile Money (Paystack) stays available at every amount.
 */
export const STRIPE_CARD_MIN_AMOUNT_MAJOR = 100;

export const STRIPE_CARD_THRESHOLD_MESSAGE =
  "Stripe card payments are available for bookings above GHS 100.";

export function isStripeCardAvailable(amountMajor: unknown): boolean {
  const n = Number(amountMajor);
  return Number.isFinite(n) && n > STRIPE_CARD_MIN_AMOUNT_MAJOR;
}
