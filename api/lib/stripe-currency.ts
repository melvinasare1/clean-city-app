/**
 * Currencies Clean City presents for Stripe Checkout / subscriptions.
 * Card brand currency is not inferred; the customer chooses a presentation currency.
 */

export const STRIPE_CHARGE_CURRENCIES = ["USD", "GBP", "EUR", "CAD"] as const;

export type StripeChargeCurrency = (typeof STRIPE_CHARGE_CURRENCIES)[number];

export const DEFAULT_STRIPE_CURRENCY: StripeChargeCurrency = "USD";

const COUNTRY_TO_CURRENCY: Record<string, StripeChargeCurrency> = {
  US: "USD",
  USA: "USD",
  GB: "GBP",
  UK: "GBP",
  CA: "CAD",
  CAN: "CAD",
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
};

export function isStripeChargeCurrency(value: unknown): value is StripeChargeCurrency {
  const code = String(value || "").trim().toUpperCase();
  return (STRIPE_CHARGE_CURRENCIES as readonly string[]).includes(code);
}

export function normalizeStripeChargeCurrency(
  value: unknown
): StripeChargeCurrency | null {
  if (!isStripeChargeCurrency(value)) return null;
  return String(value).trim().toUpperCase() as StripeChargeCurrency;
}

export function defaultStripeCurrencyFromCountry(
  country: unknown
): StripeChargeCurrency {
  const code = String(country || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!code) return DEFAULT_STRIPE_CURRENCY;
  return COUNTRY_TO_CURRENCY[code] || DEFAULT_STRIPE_CURRENCY;
}

export function resolveStripeChargeCurrency(input: {
  requested?: unknown;
  preferred?: unknown;
  country?: unknown;
}): StripeChargeCurrency {
  return (
    normalizeStripeChargeCurrency(input.requested) ||
    normalizeStripeChargeCurrency(input.preferred) ||
    defaultStripeCurrencyFromCountry(input.country)
  );
}

export function stripeCurrencyMinorCode(currency: StripeChargeCurrency): string {
  return currency.toLowerCase();
}
