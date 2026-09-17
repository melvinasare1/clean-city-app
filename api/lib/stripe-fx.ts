/**
 * Live GHS → Stripe currency conversion via ExchangeRate.fun.
 * Clean City prices stay in GHS; this module only produces an audit snapshot of FX.
 * No API key. Fail closed if a usable GHS-base rate is not available.
 */

import {
  isStripeChargeCurrency,
  type StripeChargeCurrency,
} from "./stripe-currency";

const RATE_SCALE = 100_000_000;

export const EXCHANGE_RATE_FUN_LATEST_URL =
  "https://api.exchangerate.fun/latest?base=GHS";
export const EXCHANGE_RATE_FUN_PROVIDER = "exchangerate.fun";
export const FX_CACHE_TTL_MS = 60 * 60 * 1000;

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

/** Convert GHS minor units by a live rate using fixed-scale integer math. */
export function convertMinorByRate(sourceMinor: number, rate: number): number {
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

type FxFetch = (
  input: string,
  init?: { method?: string }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

export type FxQuote = {
  rates: Record<string, number>;
  rateTimestamp: string;
  provider: string;
};

type CachedQuote = {
  quote: FxQuote;
  fetchedAtMs: number;
};

let cachedQuote: CachedQuote | null = null;
let inFlightQuote: Promise<FxQuote> | null = null;

export function resetStripeFxCache(): void {
  cachedQuote = null;
  inFlightQuote = null;
}

function readFreshCache(nowMs: number): FxQuote | null {
  if (!cachedQuote) return null;
  if (nowMs - cachedQuote.fetchedAtMs >= FX_CACHE_TTL_MS) return null;
  return cachedQuote.quote;
}

function writeCache(quote: FxQuote, fetchedAtMs: number): void {
  cachedQuote = { quote, fetchedAtMs };
}

function readRate(
  rates: Record<string, number>,
  currency: StripeChargeCurrency
): number {
  const direct = rates[currency] ?? rates[currency.toLowerCase()];
  if (!Number.isFinite(direct) || direct <= 0) {
    throw new StripeFxError(`No live ${currency} rate from FX provider`);
  }
  return Number(direct);
}

function providerTimestamp(data: Record<string, unknown>): string {
  if (typeof data.date === "string" && data.date.trim()) {
    const parsed = Date.parse(data.date);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    return data.date.trim();
  }
  if (typeof data.timestamp === "number" && Number.isFinite(data.timestamp)) {
    if (data.timestamp <= 0) {
      throw new StripeFxError("FX provider did not return a timestamp");
    }
    const ms = data.timestamp < 1e12 ? data.timestamp * 1000 : data.timestamp;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  throw new StripeFxError("FX provider did not return a timestamp");
}

export function parseExchangeRateFunResponse(data: unknown): FxQuote {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new StripeFxError("FX provider returned a malformed response");
  }
  const payload = data as Record<string, unknown>;
  const base = String(payload.base || "").trim().toUpperCase();
  if (base !== "GHS") {
    throw new StripeFxError("FX provider did not return GHS-base rates");
  }
  if (
    !payload.rates ||
    typeof payload.rates !== "object" ||
    Array.isArray(payload.rates)
  ) {
    throw new StripeFxError("FX provider did not return usable GHS rates");
  }
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(
    payload.rates as Record<string, unknown>
  )) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      rates[String(code).toUpperCase()] = n;
    }
  }
  return {
    rates,
    rateTimestamp: providerTimestamp(payload),
    provider: EXCHANGE_RATE_FUN_PROVIDER,
  };
}

async function fetchJson(fetchImpl: FxFetch, url: string): Promise<unknown> {
  let response: Awaited<ReturnType<FxFetch>>;
  try {
    response = await fetchImpl(url, { method: "GET" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "network error";
    throw new StripeFxError(`FX provider request failed (${message})`);
  }
  if (!response.ok) {
    throw new StripeFxError(`FX provider request failed (${response.status})`);
  }
  try {
    return await response.json();
  } catch {
    throw new StripeFxError("FX provider returned malformed JSON");
  }
}

async function fetchExchangeRateFun(fetchImpl: FxFetch): Promise<FxQuote> {
  const data = await fetchJson(fetchImpl, EXCHANGE_RATE_FUN_LATEST_URL);
  return parseExchangeRateFunResponse(data);
}

export async function fetchGhsFxQuote(
  fetchImpl: FxFetch = fetch as FxFetch,
  nowMs: number = Date.now()
): Promise<FxQuote> {
  const cached = readFreshCache(nowMs);
  if (cached) return cached;
  if (inFlightQuote) return inFlightQuote;
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
  } catch (err) {
    throw err instanceof StripeFxError
      ? err
      : new StripeFxError("Live FX rate unavailable");
  }
}

export async function convertGhsToStripeCurrency(
  amountGhs: number,
  targetCurrency: StripeChargeCurrency,
  options?: { fetchImpl?: FxFetch; quote?: FxQuote; nowMs?: number }
): Promise<GhsFxConversion> {
  if (!isStripeChargeCurrency(targetCurrency)) {
    throw new StripeFxError("Unsupported Stripe currency");
  }
  if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
    throw new StripeFxError("GHS amount must be greater than zero");
  }
  const quote =
    options?.quote ||
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
