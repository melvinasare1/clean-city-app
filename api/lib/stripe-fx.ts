/**
 * GHS → Stripe currency conversion using manually maintained Firestore rates.
 *
 * Source of truth: config/stripe_fx (Admin SDK / server only).
 * No external FX APIs. No hardcoded production rates. Fail closed if the
 * document is missing or invalid. A future POST /api/admin/stripe-fx can
 * reuse parseStripeFxConfig + stripeFxDocument without changing pricing.
 */

import { getFirestore } from "./firebase-admin";
import {
  isStripeChargeCurrency,
  type StripeChargeCurrency,
} from "./stripe-currency";

const RATE_SCALE = 100_000_000;

export const STRIPE_FX_COLLECTION = "config";
export const STRIPE_FX_DOC_ID = "stripe_fx";
export const MANUAL_FIREBASE_FX_PROVIDER = "manual_firebase";
export const STRIPE_FX_CONFIG_PROVIDER = "manual";
export const STRIPE_FX_UNAVAILABLE_MESSAGE =
  "Stripe FX configuration unavailable";

export type GhsFxConversion = {
  sourceAmountGhs: number;
  sourceCurrency: "GHS";
  targetCurrency: StripeChargeCurrency;
  exchangeRate: number;
  convertedAmount: number;
  convertedAmountMinor: number;
  rateTimestamp: string;
  provider: string;
};

export class StripeFxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeFxError";
  }
}

export function toMinorUnits(amountMajor: number): number {
  if (!Number.isFinite(amountMajor)) {
    throw new StripeFxError("Amount is not a finite number");
  }
  return Math.round(amountMajor * 100);
}

export function fromMinorUnits(amountMinor: number): number {
  return Math.round(amountMinor) / 100;
}

/** Convert GHS minor units by a rate using fixed-scale integer math. */
export function convertMinorByRate(sourceMinor: number, rate: number): number {
  if (!Number.isFinite(sourceMinor) || sourceMinor < 0) {
    throw new StripeFxError("Source amount is invalid");
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new StripeFxError(STRIPE_FX_UNAVAILABLE_MESSAGE);
  }
  const scaled = Math.round(rate * RATE_SCALE);
  if (scaled <= 0) {
    throw new StripeFxError(STRIPE_FX_UNAVAILABLE_MESSAGE);
  }
  return Math.round((sourceMinor * scaled) / RATE_SCALE);
}

export type FxQuote = {
  rates: Record<string, number>;
  rateTimestamp: string;
  provider: string;
};

export type StripeFxFirestoreReader = {
  collection: (name: string) => {
    doc: (id: string) => {
      get: () => Promise<{
        exists?: boolean | (() => boolean);
        data: () => Record<string, unknown> | undefined;
      }>;
    };
  };
};

export type ConvertGhsFxOptions = {
  firestore?: StripeFxFirestoreReader;
  quote?: FxQuote;
};

function unavailable(): never {
  throw new StripeFxError(STRIPE_FX_UNAVAILABLE_MESSAGE);
}

function snapshotExists(snap: {
  exists?: boolean | (() => boolean);
}): boolean {
  if (typeof snap.exists === "function") return snap.exists();
  return snap.exists === true;
}

function timestampToIso(value: unknown): string {
  if (value == null) unavailable();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (typeof value === "object") {
    const v = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof v.toDate === "function") {
      const dated = v.toDate();
      if (dated instanceof Date && !Number.isNaN(dated.getTime())) {
        return dated.toISOString();
      }
    }
    if (typeof v.toMillis === "function") {
      const parsed = new Date(v.toMillis());
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    const seconds = typeof v.seconds === "number" ? v.seconds : v._seconds;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  unavailable();
}

function readRate(
  rates: Record<string, number>,
  currency: StripeChargeCurrency
): number {
  const direct = rates[currency] ?? rates[currency.toLowerCase()];
  if (!Number.isFinite(direct) || direct <= 0) {
    unavailable();
  }
  return Number(direct);
}

export function stripeFxDocument(firestore: StripeFxFirestoreReader) {
  return firestore.collection(STRIPE_FX_COLLECTION).doc(STRIPE_FX_DOC_ID);
}

/**
 * Validate a `config/stripe_fx` document. Rates mean 1 GHS = X target currency.
 * Does not accept client-supplied rates; callers must pass Firestore data.
 */
export function parseStripeFxConfig(data: unknown): FxQuote {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    unavailable();
  }
  const payload = data as Record<string, unknown>;
  const base = String(payload.baseCurrency || "")
    .trim()
    .toUpperCase();
  if (base !== "GHS") {
    unavailable();
  }
  if (
    !payload.rates ||
    typeof payload.rates !== "object" ||
    Array.isArray(payload.rates)
  ) {
    unavailable();
  }
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(
    payload.rates as Record<string, unknown>
  )) {
    const n = Number(value);
    rates[String(code).toUpperCase()] = n;
  }
  return {
    rates,
    rateTimestamp: timestampToIso(payload.updatedAt),
    provider: MANUAL_FIREBASE_FX_PROVIDER,
  };
}

type FxSnapshot = {
  exists?: boolean | (() => boolean);
  data: () => Record<string, unknown> | undefined;
};

export async function loadStripeFxConfig(
  firestore: StripeFxFirestoreReader
): Promise<FxQuote> {
  let snap: FxSnapshot;
  try {
    snap = await stripeFxDocument(firestore).get();
  } catch {
    unavailable();
  }
  if (!snap || !snapshotExists(snap)) {
    unavailable();
  }
  return parseStripeFxConfig(snap.data());
}

function resolveFirestore(
  firestore?: StripeFxFirestoreReader
): StripeFxFirestoreReader {
  if (firestore) return firestore;
  try {
    return getFirestore();
  } catch {
    unavailable();
  }
}

export async function convertGhsToStripeCurrency(
  amountGhs: number,
  targetCurrency: StripeChargeCurrency,
  options?: ConvertGhsFxOptions
): Promise<GhsFxConversion> {
  if (!isStripeChargeCurrency(targetCurrency)) {
    throw new StripeFxError("Unsupported Stripe currency");
  }
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
    throw new StripeFxError("GHS amount must be greater than zero");
  }
  const quote =
    options?.quote ||
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
    provider: MANUAL_FIREBASE_FX_PROVIDER,
  };
}
