"use strict";
/**
 * Live GHS → Stripe currency conversion via ExchangeRate.fun.
 * Clean City prices stay in GHS; this module only produces an audit snapshot of FX.
 * No API key. Fail closed if a usable GHS-base rate is not available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeFxError = exports.FX_CACHE_TTL_MS = exports.EXCHANGE_RATE_FUN_PROVIDER = exports.EXCHANGE_RATE_FUN_LATEST_URL = void 0;
exports.toMinorUnits = toMinorUnits;
exports.fromMinorUnits = fromMinorUnits;
exports.convertMinorByRate = convertMinorByRate;
exports.resetStripeFxCache = resetStripeFxCache;
exports.parseExchangeRateFunResponse = parseExchangeRateFunResponse;
exports.fetchGhsFxQuote = fetchGhsFxQuote;
exports.convertGhsToStripeCurrency = convertGhsToStripeCurrency;
const stripe_currency_1 = require("./stripe-currency");
const RATE_SCALE = 100000000;
exports.EXCHANGE_RATE_FUN_LATEST_URL = "https://api.exchangerate.fun/latest?base=GHS";
exports.EXCHANGE_RATE_FUN_PROVIDER = "exchangerate.fun";
exports.FX_CACHE_TTL_MS = 60 * 60 * 1000;
class StripeFxError extends Error {
    constructor(message) {
        super(message);
        this.name = "StripeFxError";
    }
}
exports.StripeFxError = StripeFxError;
function toMinorUnits(amountMajor) {
    if (!Number.isFinite(amountMajor)) {
        throw new StripeFxError("Amount is not a finite number");
    }
    return Math.round(amountMajor * 100);
}
function fromMinorUnits(amountMinor) {
    return Math.round(amountMinor) / 100;
}
/** Convert GHS minor units by a live rate using fixed-scale integer math. */
function convertMinorByRate(sourceMinor, rate) {
    if (!Number.isFinite(sourceMinor) || sourceMinor < 0) {
        throw new StripeFxError("Source amount is invalid");
    }
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new StripeFxError("Exchange rate is unavailable");
    }
    const scaled = Math.round(rate * RATE_SCALE);
    if (scaled <= 0) {
        throw new StripeFxError("Exchange rate is unavailable");
    }
    return Math.round((sourceMinor * scaled) / RATE_SCALE);
}
let cachedQuote = null;
let inFlightQuote = null;
function resetStripeFxCache() {
    cachedQuote = null;
    inFlightQuote = null;
}
function readFreshCache(nowMs) {
    if (!cachedQuote)
        return null;
    if (nowMs - cachedQuote.fetchedAtMs >= exports.FX_CACHE_TTL_MS)
        return null;
    return cachedQuote.quote;
}
function writeCache(quote, fetchedAtMs) {
    cachedQuote = { quote, fetchedAtMs };
}
function readRate(rates, currency) {
    const direct = rates[currency] ?? rates[currency.toLowerCase()];
    if (!Number.isFinite(direct) || direct <= 0) {
        throw new StripeFxError(`No live ${currency} rate from FX provider`);
    }
    return Number(direct);
}
function providerTimestamp(data) {
    if (typeof data.date === "string" && data.date.trim()) {
        const parsed = Date.parse(data.date);
        if (Number.isFinite(parsed))
            return new Date(parsed).toISOString();
        return data.date.trim();
    }
    if (typeof data.timestamp === "number" && Number.isFinite(data.timestamp)) {
        if (data.timestamp <= 0) {
            throw new StripeFxError("FX provider did not return a timestamp");
        }
        const ms = data.timestamp < 1e12 ? data.timestamp * 1000 : data.timestamp;
        const parsed = new Date(ms);
        if (!Number.isNaN(parsed.getTime()))
            return parsed.toISOString();
    }
    throw new StripeFxError("FX provider did not return a timestamp");
}
function parseExchangeRateFunResponse(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new StripeFxError("FX provider returned a malformed response");
    }
    const payload = data;
    const base = String(payload.base || "").trim().toUpperCase();
    if (base !== "GHS") {
        throw new StripeFxError("FX provider did not return GHS-base rates");
    }
    if (!payload.rates ||
        typeof payload.rates !== "object" ||
        Array.isArray(payload.rates)) {
        throw new StripeFxError("FX provider did not return usable GHS rates");
    }
    const rates = {};
    for (const [code, value] of Object.entries(payload.rates)) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
            rates[String(code).toUpperCase()] = n;
        }
    }
    return {
        rates,
        rateTimestamp: providerTimestamp(payload),
        provider: exports.EXCHANGE_RATE_FUN_PROVIDER,
    };
}
async function fetchJson(fetchImpl, url) {
    let response;
    try {
        response = await fetchImpl(url, { method: "GET" });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "network error";
        throw new StripeFxError(`FX provider request failed (${message})`);
    }
    if (!response.ok) {
        throw new StripeFxError(`FX provider request failed (${response.status})`);
    }
    try {
        return await response.json();
    }
    catch {
        throw new StripeFxError("FX provider returned malformed JSON");
    }
}
async function fetchExchangeRateFun(fetchImpl) {
    const data = await fetchJson(fetchImpl, exports.EXCHANGE_RATE_FUN_LATEST_URL);
    return parseExchangeRateFunResponse(data);
}
async function fetchGhsFxQuote(fetchImpl = fetch, nowMs = Date.now()) {
    const cached = readFreshCache(nowMs);
    if (cached)
        return cached;
    if (inFlightQuote)
        return inFlightQuote;
    inFlightQuote = fetchExchangeRateFun(fetchImpl)
        .then((quote) => {
        writeCache(quote, nowMs);
        return quote;
    })
        .finally(() => {
        inFlightQuote = null;
    });
    try {
        return await inFlightQuote;
    }
    catch (err) {
        throw err instanceof StripeFxError
            ? err
            : new StripeFxError("Live FX rate unavailable");
    }
}
async function convertGhsToStripeCurrency(amountGhs, targetCurrency, options) {
    if (!(0, stripe_currency_1.isStripeChargeCurrency)(targetCurrency)) {
        throw new StripeFxError("Unsupported Stripe currency");
    }
    if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
        throw new StripeFxError("GHS amount must be greater than zero");
    }
    const quote = options?.quote ||
        (await fetchGhsFxQuote(options?.fetchImpl, options?.nowMs));
    const exchangeRate = readRate(quote.rates, targetCurrency);
    const sourceMinor = toMinorUnits(amountGhs);
    const convertedAmountMinor = convertMinorByRate(sourceMinor, exchangeRate);
    if (convertedAmountMinor <= 0) {
        throw new StripeFxError("Converted Stripe amount rounded to zero");
    }
    return {
        sourceAmountGhs: fromMinorUnits(sourceMinor),
        sourceCurrency: "GHS",
        targetCurrency,
        exchangeRate,
        convertedAmount: fromMinorUnits(convertedAmountMinor),
        convertedAmountMinor,
        rateTimestamp: quote.rateTimestamp,
        provider: quote.provider,
    };
}
