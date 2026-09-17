export const STRIPE_CHARGE_CURRENCIES = ["USD", "GBP", "EUR", "CAD"] as const;

export type StripeChargeCurrency = (typeof STRIPE_CHARGE_CURRENCIES)[number];

export const DEFAULT_STRIPE_CURRENCY: StripeChargeCurrency = "USD";

export function isStripeChargeCurrency(value: unknown): value is StripeChargeCurrency {
  const code = String(value || "").trim().toUpperCase();
  return (STRIPE_CHARGE_CURRENCIES as readonly string[]).includes(code);
}

export function normalizeStripeChargeCurrency(
  value: unknown
): StripeChargeCurrency {
  return isStripeChargeCurrency(value)
    ? (String(value).trim().toUpperCase() as StripeChargeCurrency)
    : DEFAULT_STRIPE_CURRENCY;
}

export function formatStripeMoney(
  amount: number,
  currency: StripeChargeCurrency
): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
