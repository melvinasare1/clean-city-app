/**
 * Client UI flag for Stripe/card. Backend STRIPE_PAYMENTS_ENABLED is authoritative.
 * Unset or any value other than "true" hides Stripe from the customer app.
 */
export const STRIPE_PAYMENTS_DISABLED_MESSAGE =
  "Stripe payments are temporarily unavailable";

export function parseStripePaymentsEnabledFlag(
  value: string | undefined | null
): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export const STRIPE_PAYMENTS_ENABLED = parseStripePaymentsEnabledFlag(
  process.env.EXPO_PUBLIC_STRIPE_PAYMENTS_ENABLED
);

export function assertStripePaymentsEnabled(): void {
  if (!STRIPE_PAYMENTS_ENABLED) {
    throw new Error(STRIPE_PAYMENTS_DISABLED_MESSAGE);
  }
}
