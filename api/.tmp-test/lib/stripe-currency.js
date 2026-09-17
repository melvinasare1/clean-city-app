"use strict";
/**
 * Currencies Clean City presents for Stripe Checkout / subscriptions.
 * Card brand currency is not inferred; the customer chooses a presentation currency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STRIPE_CURRENCY = exports.STRIPE_CHARGE_CURRENCIES = void 0;
exports.isStripeChargeCurrency = isStripeChargeCurrency;
exports.normalizeStripeChargeCurrency = normalizeStripeChargeCurrency;
exports.defaultStripeCurrencyFromCountry = defaultStripeCurrencyFromCountry;
exports.resolveStripeChargeCurrency = resolveStripeChargeCurrency;
exports.stripeCurrencyMinorCode = stripeCurrencyMinorCode;
exports.STRIPE_CHARGE_CURRENCIES = ["USD", "GBP", "EUR", "CAD"];
exports.DEFAULT_STRIPE_CURRENCY = "USD";
const COUNTRY_TO_CURRENCY = {
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
function isStripeChargeCurrency(value) {
    const code = String(value || "").trim().toUpperCase();
    return exports.STRIPE_CHARGE_CURRENCIES.includes(code);
}
function normalizeStripeChargeCurrency(value) {
    if (!isStripeChargeCurrency(value))
        return null;
    return String(value).trim().toUpperCase();
}
function defaultStripeCurrencyFromCountry(country) {
    const code = String(country || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
    if (!code)
        return exports.DEFAULT_STRIPE_CURRENCY;
    return COUNTRY_TO_CURRENCY[code] || exports.DEFAULT_STRIPE_CURRENCY;
}
function resolveStripeChargeCurrency(input) {
    return (normalizeStripeChargeCurrency(input.requested) ||
        normalizeStripeChargeCurrency(input.preferred) ||
        defaultStripeCurrencyFromCountry(input.country));
}
function stripeCurrencyMinorCode(currency) {
    return currency.toLowerCase();
}
