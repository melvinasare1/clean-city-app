const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const {
  convertGhsToStripeCurrency,
  convertMinorByRate,
  toMinorUnits,
  StripeFxError,
  parseStripeFxConfig,
  loadStripeFxConfig,
  STRIPE_FX_COLLECTION,
  STRIPE_FX_DOC_ID,
  MANUAL_FIREBASE_FX_PROVIDER,
  STRIPE_FX_UNAVAILABLE_MESSAGE,
} = require("../.test-out/stripe-fx");
const {
  applyStripePaymentSurchargeMinor,
  snapshotFromConversion,
  stripeQuoteResponseFields,
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
const UPDATED_AT = "2026-09-17T12:00:00.000Z";

function fxConfig(overrides = {}) {
  return {
    baseCurrency: "GHS",
    rates: { ...RATES },
    updatedAt: UPDATED_AT,
    updatedBy: "admin-uid",
    provider: "manual",
    version: 1,
    ...overrides,
  };
}

function mockFxFirestore(data, exists = true, onGet) {
  return {
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              if (onGet) onGet(name, id);
              return {
                exists,
                data: () => data,
              };
            },
          };
        },
      };
    },
  };
}

function quote(rates, extras = {}) {
  return {
    rates,
    rateTimestamp: extras.rateTimestamp || UPDATED_AT,
    provider: extras.provider || MANUAL_FIREBASE_FX_PROVIDER,
  };
}

describe("Firebase FX configuration", () => {
  it("loads a valid config/stripe_fx document", async () => {
    const paths = [];
    const result = await loadStripeFxConfig(
      mockFxFirestore(fxConfig(), true, (name, id) => {
        paths.push(`${name}/${id}`);
      })
    );
    assert.deepEqual(paths, [`${STRIPE_FX_COLLECTION}/${STRIPE_FX_DOC_ID}`]);
    assert.equal(STRIPE_FX_COLLECTION, "config");
    assert.equal(STRIPE_FX_DOC_ID, "stripe_fx");
    assert.equal(result.provider, MANUAL_FIREBASE_FX_PROVIDER);
    assert.equal(result.provider, "manual_firebase");
    assert.equal(result.rateTimestamp, UPDATED_AT);
    assert.equal(result.rates.USD, 0.08);
    assert.equal(result.rates.GBP, 0.055);
  });

  it("fails when the document is missing", async () => {
    await assert.rejects(
      () => convertGhsToStripeCurrency(200, "USD", {
        firestore: mockFxFirestore(undefined, false),
      }),
      (err) => {
        assert.ok(err instanceof StripeFxError);
        assert.equal(err.message, STRIPE_FX_UNAVAILABLE_MESSAGE);
        return true;
      }
    );
  });

  it("fails when rates are missing", () => {
    assert.throws(
      () => parseStripeFxConfig(fxConfig({ rates: undefined })),
      /Stripe FX configuration unavailable/
    );
    assert.throws(
      () => parseStripeFxConfig({ baseCurrency: "GHS", updatedAt: UPDATED_AT }),
      /Stripe FX configuration unavailable/
    );
  });

  it("fails when a rate is not a finite number", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          firestore: mockFxFirestore(fxConfig({ rates: { USD: "abc" } })),
        }),
      /Stripe FX configuration unavailable/
    );
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          firestore: mockFxFirestore(fxConfig({ rates: { USD: Infinity } })),
        }),
      /Stripe FX configuration unavailable/
    );
  });

  it("fails when a rate is zero", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          firestore: mockFxFirestore(fxConfig({ rates: { ...RATES, USD: 0 } })),
        }),
      /Stripe FX configuration unavailable/
    );
  });

  it("fails when a rate is negative", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          firestore: mockFxFirestore(
            fxConfig({ rates: { ...RATES, USD: -0.08 } })
          ),
        }),
      /Stripe FX configuration unavailable/
    );
  });

  it("fails when the target currency is unsupported", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "GHS", {
          firestore: mockFxFirestore(fxConfig()),
        }),
      StripeFxError
    );
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "JPY", {
          firestore: mockFxFirestore(fxConfig({ rates: { JPY: 12 } })),
        }),
      /Unsupported Stripe currency/
    );
    assert.equal(isStripeChargeCurrency("GHS"), false);
    assert.equal(isStripeChargeCurrency("JPY"), false);
  });

  it("fails when the requested supported currency is missing from rates", async () => {
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "GBP", {
          firestore: mockFxFirestore(fxConfig({ rates: { USD: 0.08 } })),
        }),
      /Stripe FX configuration unavailable/
    );
  });

  it("fails when baseCurrency is not GHS", () => {
    assert.throws(
      () => parseStripeFxConfig(fxConfig({ baseCurrency: "USD" })),
      /Stripe FX configuration unavailable/
    );
    assert.throws(
      () => parseStripeFxConfig(fxConfig({ baseCurrency: "" })),
      /Stripe FX configuration unavailable/
    );
  });

  it("never falls back to a hardcoded or previous rate", async () => {
    const first = await convertGhsToStripeCurrency(200, "USD", {
      firestore: mockFxFirestore(fxConfig({ rates: { ...RATES, USD: 0.08 } })),
    });
    assert.equal(first.exchangeRate, 0.08);
    await assert.rejects(
      () =>
        convertGhsToStripeCurrency(200, "USD", {
          firestore: mockFxFirestore(undefined, false),
        }),
      /Stripe FX configuration unavailable/
    );
  });
});

describe("Stripe FX conversion", () => {
  it("converts GHS to USD, GBP, EUR, and CAD using Firebase rates", async () => {
    for (const currency of ["USD", "GBP", "EUR", "CAD"]) {
      const result = await convertGhsToStripeCurrency(141, currency, {
        firestore: mockFxFirestore(fxConfig()),
      });
      assert.equal(result.sourceCurrency, "GHS");
      assert.equal(result.sourceAmountGhs, 141);
      assert.equal(result.targetCurrency, currency);
      assert.equal(result.exchangeRate, RATES[currency]);
      assert.equal(result.provider, "manual_firebase");
      assert.equal(
        result.convertedAmountMinor,
        convertMinorByRate(toMinorUnits(141), RATES[currency])
      );
    }
  });

  it("uses integer minor-unit rounding", () => {
    assert.equal(toMinorUnits(16.5), 1650);
    assert.equal(convertMinorByRate(30000, 0.055), 1650);
  });

  it("does not accept a client-supplied FX rate or Stripe amount", async () => {
    const result = await convertGhsToStripeCurrency(200, "USD", {
      firestore: mockFxFirestore(fxConfig({ rates: { ...RATES, USD: 0.08 } })),
      rate: 0.99,
      exchangeRate: 0.99,
      stripeAmountMinor: 1,
      amountMinor: 1,
    });
    assert.equal(result.exchangeRate, 0.08);
    assert.equal(result.provider, "manual_firebase");
    const snapshot = snapshotFromConversion(result);
    assert.notEqual(snapshot.stripeAmountMinor, 1);
    assert.equal(
      ignoreClientSpecifiedAmount(snapshot.finalStripeAmount, 0.01),
      snapshot.finalStripeAmount
    );
  });

  it("does not perform any HTTP request to load rates", async () => {
    let gets = 0;
    const result = await convertGhsToStripeCurrency(200, "USD", {
      firestore: mockFxFirestore(fxConfig(), true, () => {
        gets += 1;
      }),
    });
    assert.equal(gets, 1);
    assert.equal(result.provider, "manual_firebase");
    assert.equal(typeof result.exchangeRate, "number");
  });
});

describe("FX configuration security", () => {
  it("Firestore rules deny all client access to config/stripe_fx", () => {
    const rules = fs.readFileSync(
      path.join(__dirname, "../../firestore.rules"),
      "utf8"
    );
    const stripeFxBlock = rules.match(
      /match \/config\/stripe_fx \{[^}]+\}/
    );
    assert.ok(stripeFxBlock, "expected a dedicated config/stripe_fx match block");
    assert.match(stripeFxBlock[0], /allow read, write: if false;/);
    assert.doesNotMatch(stripeFxBlock[0], /isSignedIn|isOwner|isDriver|isStaff|isAdmin/);
    assert.match(rules, /function isStripeFxDoc\(pathSegments\)/);
    assert.match(rules, /allow read: if isAdmin\(\) && !isStripeFxDoc\(document\)/);
    assert.match(
      rules,
      /allow create, update: if isAdmin\(\)\s*&& !isStripeFxDoc\(document\)/
    );
    assert.match(rules, /allow delete: if isAdmin\(\) && !isStripeFxDoc\(document\)/);
  });
});

describe("No external FX providers", () => {
  it("API FX source has no ExchangeRate.fun, Open Exchange Rates, or API keys", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../lib/stripe-fx.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /exchangerate\.fun/i);
    assert.doesNotMatch(source, /open\.er-api\.com/i);
    assert.doesNotMatch(source, /openexchangerates/i);
    assert.doesNotMatch(source, /exchangerate-api/i);
    assert.doesNotMatch(source, /OPENEXCHANGERATES_APP_ID/);
    assert.doesNotMatch(source, /EXCHANGERATE_API_KEY/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
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

describe("FX quote response", () => {
  it("identifies source, target, rate, surcharge, and final amount", async () => {
    const conversion = await convertGhsToStripeCurrency(200, "USD", {
      firestore: mockFxFirestore(fxConfig()),
    });
    const snapshot = snapshotFromConversion(conversion);
    const payload = stripeQuoteResponseFields(snapshot);
    assert.equal(payload.sourceCurrency, "GHS");
    assert.equal(payload.targetCurrency, "USD");
    assert.equal(payload.exchangeRate, 0.08);
    assert.equal(payload.convertedAmount, 16);
    assert.equal(payload.surchargePercent, 2);
    assert.equal(payload.surchargeAmount, 0.32);
    assert.equal(payload.finalAmount, 16.32);
    assert.equal(payload.exchangeRateProvider, "manual_firebase");
    assert.equal(payload.finalStripeAmount, payload.finalAmount);
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
    assert.notEqual(form["line_items[0][price_data][currency]"], "ghs");
  });

  it("locks a new subscription at the Firebase rate used at creation", async () => {
    const conversion = await convertGhsToStripeCurrency(200, "GBP", {
      firestore: mockFxFirestore(fxConfig()),
    });
    const snapshot = snapshotFromConversion(conversion);
    const form = buildSubscriptionCheckoutForm({
      bookingId: "b1",
      userId: "u1",
      subscriptionId: "sub_cc_1",
      email: "a@b.com",
      amountMinor: snapshot.stripeAmountMinor,
      currency: "GBP",
      successUrl: "https://ok",
      cancelUrl: "https://cancel",
    });
    assert.equal(form["line_items[0][price_data][currency]"], "gbp");
    assert.equal(
      form["line_items[0][price_data][unit_amount]"],
      String(snapshot.stripeAmountMinor)
    );
  });
});
