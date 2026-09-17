"use strict";
/**
 * GHS → Stripe currency conversion using manually maintained Firestore rates.
 *
 * Source of truth: config/stripe_fx (Admin SDK / server only).
 * No external FX APIs. No hardcoded production rates. Fail closed if the
 * document is missing or invalid. A future POST /api/admin/stripe-fx can
 * reuse parseStripeFxConfig + stripeFxDocument without changing pricing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeFxError = exports.STRIPE_FX_UNAVAILABLE_MESSAGE = exports.STRIPE_FX_CONFIG_PROVIDER = exports.MANUAL_FIREBASE_FX_PROVIDER = exports.STRIPE_FX_DOC_ID = exports.STRIPE_FX_COLLECTION = void 0;
exports.toMinorUnits = toMinorUnits;
exports.fromMinorUnits = fromMinorUnits;
exports.convertMinorByRate = convertMinorByRate;
exports.stripeFxDocument = stripeFxDocument;
exports.parseStripeFxConfig = parseStripeFxConfig;
exports.loadStripeFxConfig = loadStripeFxConfig;
exports.convertGhsToStripeCurrency = convertGhsToStripeCurrency;
const firebase_admin_1 = require("./firebase-admin");
const stripe_currency_1 = require("./stripe-currency");
const RATE_SCALE = 100000000;
exports.STRIPE_FX_COLLECTION = "config";
exports.STRIPE_FX_DOC_ID = "stripe_fx";
exports.MANUAL_FIREBASE_FX_PROVIDER = "manual_firebase";
exports.STRIPE_FX_CONFIG_PROVIDER = "manual";
exports.STRIPE_FX_UNAVAILABLE_MESSAGE = "Stripe FX configuration unavailable";
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
/** Convert GHS minor units by a rate using fixed-scale integer math. */
function convertMinorByRate(sourceMinor, rate) {
    if (!Number.isFinite(sourceMinor) || sourceMinor < 0) {
        throw new StripeFxError("Source amount is invalid");
    }
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new StripeFxError(exports.STRIPE_FX_UNAVAILABLE_MESSAGE);
    }
    const scaled = Math.round(rate * RATE_SCALE);
    if (scaled <= 0) {
        throw new StripeFxError(exports.STRIPE_FX_UNAVAILABLE_MESSAGE);
    }
    return Math.round((sourceMinor * scaled) / RATE_SCALE);
}
function unavailable() {
    throw new StripeFxError(exports.STRIPE_FX_UNAVAILABLE_MESSAGE);
}
function snapshotExists(snap) {
    if (typeof snap.exists === "function")
        return snap.exists();
    return snap.exists === true;
}
function timestampToIso(value) {
    if (value == null)
        unavailable();
    if (typeof value === "string" && value.trim()) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed))
            return new Date(parsed).toISOString();
        return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        const ms = value < 1e12 ? value * 1000 : value;
        const parsed = new Date(ms);
        if (!Number.isNaN(parsed.getTime()))
            return parsed.toISOString();
    }
    if (typeof value === "object") {
        const v = value;
        if (typeof v.toDate === "function") {
            const dated = v.toDate();
            if (dated instanceof Date && !Number.isNaN(dated.getTime())) {
                return dated.toISOString();
            }
        }
        if (typeof v.toMillis === "function") {
            const parsed = new Date(v.toMillis());
            if (!Number.isNaN(parsed.getTime()))
                return parsed.toISOString();
        }
        const seconds = typeof v.seconds === "number" ? v.seconds : v._seconds;
        if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
            return new Date(seconds * 1000).toISOString();
        }
    }
    unavailable();
}
function readRate(rates, currency) {
    const direct = rates[currency] ?? rates[currency.toLowerCase()];
    if (!Number.isFinite(direct) || direct <= 0) {
        unavailable();
    }
    return Number(direct);
}
function stripeFxDocument(firestore) {
    return firestore.collection(exports.STRIPE_FX_COLLECTION).doc(exports.STRIPE_FX_DOC_ID);
}
/**
 * Validate a `config/stripe_fx` document. Rates mean 1 GHS = X target currency.
 * Does not accept client-supplied rates; callers must pass Firestore data.
 */
function parseStripeFxConfig(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        unavailable();
    }
    const payload = data;
    const base = String(payload.baseCurrency || "")
        .trim()
        .toUpperCase();
    if (base !== "GHS") {
        unavailable();
    }
    if (!payload.rates ||
        typeof payload.rates !== "object" ||
        Array.isArray(payload.rates)) {
        unavailable();
    }
    const rates = {};
    for (const [code, value] of Object.entries(payload.rates)) {
        const n = Number(value);
        rates[String(code).toUpperCase()] = n;
    }
    return {
        rates,
        rateTimestamp: timestampToIso(payload.updatedAt),
        provider: exports.MANUAL_FIREBASE_FX_PROVIDER,
    };
}
async function loadStripeFxConfig(firestore) {
    let snap;
    try {
        snap = await stripeFxDocument(firestore).get();
    }
    catch {
        unavailable();
    }
    if (!snap || !snapshotExists(snap)) {
        unavailable();
    }
    return parseStripeFxConfig(snap.data());
}
function resolveFirestore(firestore) {
    if (firestore)
        return firestore;
    try {
        return (0, firebase_admin_1.getFirestore)();
    }
    catch {
        unavailable();
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
        (await loadStripeFxConfig(resolveFirestore(options?.firestore)));
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
        provider: exports.MANUAL_FIREBASE_FX_PROVIDER,
    };
}
