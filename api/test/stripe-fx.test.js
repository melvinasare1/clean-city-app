const assert = require("assert");
const { describe, it, beforeEach } = require("node:test");
const {
  convertGhsToStripeCurrency,
  convertMinorByRate,
  toMinorUnits,
  StripeFxError,
  fetchGhsFxQuote,
  parseExchangeRateFunResponse,
  resetStripeFxCache,
  EXCHANGE_RATE_FUN_LATEST_URL,
  EXCHANGE_RATE_FUN_PROVIDER,
  FX_CACHE_TTL_MS,
} = require("../.test-out/stripe-fx");
const {
  applyStripePaymentSurchargeMinor,
  snapshotFromConversion,
  STRIPE_SURCHARGE_PERCENT,
} = require("../.test-out/stripe-pricing");
const {
  resolveStripeChargeCurrency,
  isStripeChargeCurrency,
} = require("../.test-out/stripe-currency");
const {
  buildCheckoutSessionForm,
  buildSubscriptionCheckoutForm,
  ignoreClientSpecifiedAmount,
} = require("../.test-out/stripe-checkout");

const RATES = { USD: 0.08, GBP: 0.055, EUR: 0.07, CAD: 0.11 };

function quote(rates, extras = {}) {
  return {
    rates,
    rateTimestamp: "2026-09-17T12:00:00.000Z",
    provider: extras.provider || "test-fx",
  };
}

function okFetch(payload, onCall) {
  return async (url, init) => {
    if (onCall) onCall(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };
}

function providerPayload(overrides = {}) {
  return {
    base: "GHS",
    date: "2026-09-17",
    timestamp: 1789657200,
    rates: { ...RATES },
    ...overrides,
  };
}

beforeEach(() => {
  resetStripeFxCache();
});

describe("ExchangeRate.fun request", () => {
  it("requests latest rates with base=GHS and no API key", async () => {
    const urls = [];
    await fetchGhsFxQuote(
      okFetch(providerPayload(), (url, init) => {
        urls.push(url);
        assert.equal(init?.method, "GET");
        assert.equal(url.includes("app_id"), false);
        assert.equal(url.includes("api_key"), false);
        assert.equal(url.includes("apikey"), false);
      })
    );
    assert.deepEqual(urls, [EXCHANGE_RATE_FUN_LATEST_URL]);
    assert.equal(
      EXCHANGE_RATE_FUN_LATEST_URL,
      "https://api.exchangerate.fun/latest?base=GHS"
    );
  });

  it("stores the provider name and timestamp from ExchangeRate.fun", async () => {
    const result = parseExchangeRateFunResponse(providerPayload());
    assert.equal(result.provider, EXCHANGE_RATE_FUN_PROVIDER);
    assert.equal(result.provider, "exchangerate.fun");
    assert.equal(result.rateTimestamp, new Date("2026-09-17").toISOString());
    assert.equal(result.rates.USD, 0.08);
  });

  it("accepts the live unix-timestamp payload shape", () => {
    const result = parseExchangeRateFunResponse({
      timestamp: 1789657200,
      base: "GHS",
      rates: { USD: 0.0868366, GBP: 0.0650324, EUR: 0.0756012, CAD: 0.121449 },
    });
    assert.equal(result.provider, "exchangerate.fun");
    assert.equal(result.rateTimestamp, new Date(1789657200 * 1000).toISOString());
    assert.equal(result.rates.GBP, 0.0650324);
  });
});

describe("Stripe FX conversion", () => {
  it("converts GHS to USD, GBP, EUR, and CAD using live rates", async () => {
    for (const currency of ["USD", "GBP", "EUR", "CAD"]) {
      const result = await convertGhsToStripeCurrency(141, currency, {
        quote: quote(RATES),
      });
      assert.equal(result.sourceCurrency, "GHS");
      assert.equal(result.sourceAmountGhs, 141);
      assert.equal(result.targetCurrency, currency);
      assert.equal(result.exchangeRate, RATES[currency]);
      assert.equal(result.provider, "test-fx");
      assert.equal(
        result.convertedAmountMinor,
        convertMinorByRate(toMinorUnits(141), RATES[currency])
      );
    }
  });

  it("rejects an unsupported currency", async () => {
    await assert.rejects(
      () => convertGhsToStripeCurrency(141, "GHS", { quote: quote({ USD: 0.08 }) }),
      StripeFxError
    );
    await assert.rejects(
      () => convertGhsToStripeCurrency(141, "JPY", { quote: quote({ JPY: 12 }) }),
      StripeFxError
    );
    assert.equal(isStripeChargeCurrency("GHS"), false);
    assert.equal(isStripeChargeCurrency("JPY"), false);
  });

  it("rejects a missing rate", async () => {
    await assert.rejects(
      () => convertGhsToStripeCurrency(141, "GBP", { quote: quote({ USD: 0.08 }) }),
      /No live GBP rate/
    );
  });

  it("rejects zero or negative rates", async () => {
    await assert.rejects(
      () => convertGhsToStripeCurrency(141, "USD", { quote: quote({ USD: 0 }) }),
      StripeFxError
    );
    await assert.rejects(
      () => convertGhsToStripeCurrency(141, "USD", { quote: quote({ USD: -0.08 }) }),
      StripeFxError
    );
  });

  it("uses integer minor-unit rounding", () => {
    assert.equal(toMinorUnits(16.5), 1650);
    assert.equal(convertMinorByRate(30000, 0.055), 1650);
  });

  it("does not accept a client-supplied FX rate or Stripe amount", async () => {
    const fetchImpl = okFetch(providerPayload({ rates: { ...RATES, USD: 0.08 } }));
    const result = await convertGhsToStripeCurrency(200, "USD", {
      fetchImpl,
    });
    assert.equal(result.exchangeRate, 0.08);
    assert.equal(result.provider, "exchangerate.fun");
    const snapshot = snapshotFromConversion(result);
    assert.notEqual(snapshot.stripeAmountMinor, 1);
    assert.equal(
      ignoreClientSpecifiedAmount(snapshot.finalStripeAmount, 0.01),
      snapshot.finalStripeAmount
    );
  });
});

describe("Invalid ExchangeRate.fun responses fail closed", () => {
  it("fails when the HTTP request fails", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          fetchImpl: async () => ({
            ok: false,
            status: 503,
            json: async () => ({}),
          }),
        }),
      /FX provider request failed \(503\)/
    );
  });

  it("fails when the provider is unreachable", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          fetchImpl: async () => {
            throw new Error("ECONNREFUSED");
          },
        }),
      /FX provider request failed \(ECONNREFUSED\)/
    );
  });

  it("fails when JSON is malformed", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => {
              throw new Error("bad json");
            },
          }),
        }),
      /malformed JSON/
    );
  });

  it("fails when GHS base is missing", async () => {
    assert.throws(
      () => parseExchangeRateFunResponse({ rates: RATES, date: "2026-09-17" }),
      /GHS-base/
    );
    assert.throws(
      () =>
        parseExchangeRateFunResponse({
          base: "USD",
          rates: RATES,
          date: "2026-09-17",
        }),
      /GHS-base/
    );
  });

  it("fails when the response is malformed", async () => {
    assert.throws(() => parseExchangeRateFunResponse(null), /malformed/);
    assert.throws(
      () => parseExchangeRateFunResponse({ base: "GHS", date: "2026-09-17" }),
      /usable GHS rates/
    );
  });
});

describe("FX cache", () => {
  it("reuses a fresh cached GHS-base quote instead of refetching", async () => {
    let calls = 0;
    const fetchImpl = okFetch(providerPayload(), () => {
      calls += 1;
    });
    await convertGhsToStripeCurrency(200, "USD", { fetchImpl, nowMs: 1_000 });
    await convertGhsToStripeCurrency(200, "GBP", {
      fetchImpl,
      nowMs: 1_000 + 30 * 60 * 1000,
    });
    assert.equal(calls, 1);
  });

  it("refetches after the cache is stale", async () => {
    let calls = 0;
    const fetchImpl = okFetch(providerPayload(), () => {
      calls += 1;
    });
    await convertGhsToStripeCurrency(200, "USD", { fetchImpl, nowMs: 1_000 });
    await convertGhsToStripeCurrency(200, "USD", {
      fetchImpl,
      nowMs: 1_000 + FX_CACHE_TTL_MS + 1,
    });
    assert.equal(calls, 2);
  });

  it("does not use a stale cached rate when a refresh fails", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: true, status: 200, json: async () => providerPayload() };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const first = await convertGhsToStripeCurrency(200, "USD", {
      fetchImpl,
      nowMs: 1_000,
    });
    assert.equal(first.exchangeRate, 0.08);
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          fetchImpl,
          nowMs: 1_000 + FX_CACHE_TTL_MS + 1,
        }),
      StripeFxError
    );
    assert.equal(calls, 2);
  });
});

describe("Stripe 2% payment surcharge", () => {
  it("adds 2% after FX conversion", async () => {
    const conversion = await convertGhsToStripeCurrency(300, "GBP", {
      quote: quote({ GBP: 0.055 }),
    });
    assert.equal(conversion.convertedAmount, 16.5);
    const snapshot = snapshotFromConversion(conversion);
    assert.equal(snapshot.stripeSurchargePercent, STRIPE_SURCHARGE_PERCENT);
    assert.equal(snapshot.stripeSurchargePercent, 2);
    assert.equal(snapshot.stripeSurchargeAmount, 0.33);
    assert.equal(snapshot.finalStripeAmount, 16.83);
    assert.equal(snapshot.stripeAmountMinor, 1683);
    assert.equal(snapshot.sourceAmountGhs, 300);
    assert.equal(snapshot.sourceCurrency, "GHS");
  });

  it("rounds surcharge using minor units", () => {
    const { surchargeMinor, finalMinor } = applyStripePaymentSurchargeMinor(101);
    assert.equal(finalMinor, 103);
    assert.equal(surchargeMinor, 2);
  });

  it("converts GHS 200 to Stripe minor units with 2% surcharge", async () => {
    const conversion = await convertGhsToStripeCurrency(200, "USD", {
      quote: quote({ USD: 0.08 }),
    });
    // 200.00 GHS * 0.08 = 16.00 USD → 1600 minor, * 1.02 = 1632
    assert.equal(conversion.convertedAmountMinor, 1600);
    const snapshot = snapshotFromConversion(conversion);
    assert.equal(snapshot.stripeAmountMinor, 1632);
    assert.equal(snapshot.finalStripeAmount, 16.32);
  });
});

describe("Stripe currency selection", () => {
  it("prefers an explicit customer choice, then profile, then country default", () => {
    assert.equal(
      resolveStripeChargeCurrency({ requested: "gbp", preferred: "USD", country: "US" }),
      "GBP"
    );
    assert.equal(
      resolveStripeChargeCurrency({ preferred: "CAD", country: "US" }),
      "CAD"
    );
    assert.equal(resolveStripeChargeCurrency({ country: "GB" }), "GBP");
    assert.equal(resolveStripeChargeCurrency({ country: "GH" }), "USD");
    assert.equal(resolveStripeChargeCurrency({}), "USD");
  });
});

describe("Converted amount reaches Stripe Checkout", () => {
  it("passes server-computed minor units into one-time Checkout", async () => {
    const conversion = await convertGhsToStripeCurrency(200, "USD", {
      quote: quote({ USD: 0.08 }),
    });
    const snapshot = snapshotFromConversion(conversion);
    const form = buildCheckoutSessionForm({
      bookingId: "booking-1",
      userId: "user-1",
      email: "a@b.com",
      amountMinor: snapshot.stripeAmountMinor,
      currency: "USD",
      successUrl: "https://ok",
      cancelUrl: "https://cancel",
    });
    assert.equal(form["line_items[0][price_data][unit_amount]"], "1632");
    assert.equal(form["line_items[0][price_data][currency]"], "usd");
    assert.notEqual(form["line_items[0][price_data][unit_amount]"], "1");
  });
});
