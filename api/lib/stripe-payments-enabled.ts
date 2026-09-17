/**
 * Authoritative Stripe availability flag.
 * Unset, empty, or any value other than "true" keeps Stripe checkout disabled.
 * Webhooks and verification stay available for existing Stripe payments.
 */
export const STRIPE_PAYMENTS_ENABLED_ENV = "STRIPE_PAYMENTS_ENABLED";

export const STRIPE_PAYMENTS_DISABLED_MESSAGE =
  "Stripe payments are temporarily unavailable";

export function parseStripePaymentsEnabledFlag(
  value: string | undefined | null
): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

export function isStripePaymentsEnabled(
  value: string | undefined | null = process.env.STRIPE_PAYMENTS_ENABLED
): boolean {
  return parseStripePaymentsEnabledFlag(value);
}

export function stripePaymentsDisabledBody(): { ok: false; error: string } {
  return { ok: false, error: STRIPE_PAYMENTS_DISABLED_MESSAGE };
}

export function rejectDisabledStripePayments(res: {
  status: (code: number) => { json: (body: unknown) => unknown };
}): boolean {
  if (isStripePaymentsEnabled()) return false;
  res.status(503).json(stripePaymentsDisabledBody());
  return true;
}
