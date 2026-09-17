const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { describe, it, before, beforeEach, afterEach } = require("node:test");
const {
  isStripePaymentsEnabled,
  parseStripePaymentsEnabledFlag,
  rejectDisabledStripePayments,
  stripePaymentsDisabledBody,
  STRIPE_PAYMENTS_DISABLED_MESSAGE,
  STRIPE_PAYMENTS_ENABLED_ENV,
} = require("../.test-out/stripe-payments-enabled");
const { isStripeCardAvailable } = require("../.test-out/stripe-threshold");

const ROOT = path.join(__dirname, "../..");

function readRepo(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function mockRes() {
  const captured = { statusCode: 0, body: null };
  return {
    captured,
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    },
  };
}

describe("STRIPE_PAYMENTS_ENABLED flag", () => {
  const original = process.env.STRIPE_PAYMENTS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.STRIPE_PAYMENTS_ENABLED;
    else process.env.STRIPE_PAYMENTS_ENABLED = original;
  });

  it("is off unless the env value is exactly true", () => {
    assert.equal(STRIPE_PAYMENTS_ENABLED_ENV, "STRIPE_PAYMENTS_ENABLED");
    assert.equal(parseStripePaymentsEnabledFlag(undefined), false);
    assert.equal(parseStripePaymentsEnabledFlag(""), false);
    assert.equal(parseStripePaymentsEnabledFlag("false"), false);
    assert.equal(parseStripePaymentsEnabledFlag("0"), false);
    assert.equal(parseStripePaymentsEnabledFlag("true"), true);
    assert.equal(parseStripePaymentsEnabledFlag("TRUE"), true);
    assert.equal(parseStripePaymentsEnabledFlag(" True "), true);
  });

  it("reads the backend env var on each check", () => {
    delete process.env.STRIPE_PAYMENTS_ENABLED;
    assert.equal(isStripePaymentsEnabled(), false);
    process.env.STRIPE_PAYMENTS_ENABLED = "false";
    assert.equal(isStripePaymentsEnabled(), false);
    process.env.STRIPE_PAYMENTS_ENABLED = "true";
    assert.equal(isStripePaymentsEnabled(), true);
  });
});

describe("Backend rejects Stripe when disabled", () => {
  const original = process.env.STRIPE_PAYMENTS_ENABLED;

  before(() => {
    const compiled = path.join(__dirname, "../.tmp-test/stripe/initialize.js");
    if (!fs.existsSync(compiled)) {
      execFileSync(
        "npx",
        [
          "tsc",
          "--outDir",
          "api/.tmp-test",
          "--rootDir",
          "api",
          "--module",
          "commonjs",
          "--esModuleInterop",
          "--skipLibCheck",
          "--target",
          "ES2020",
          "--moduleResolution",
          "node",
          "--declaration",
          "false",
          "api/stripe/initialize.ts",
          "api/stripe/subscribe.ts",
          "api/stripe/quote.ts",
        ],
        { cwd: ROOT, stdio: "pipe" }
      );
    }
  });

  beforeEach(() => {
    delete process.env.STRIPE_PAYMENTS_ENABLED;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.STRIPE_PAYMENTS_ENABLED;
    else process.env.STRIPE_PAYMENTS_ENABLED = original;
  });

  it("returns HTTP 503 with a public unavailable message", () => {
    const res = mockRes();
    const rejected = rejectDisabledStripePayments(res);
    assert.equal(rejected, true);
    assert.equal(res.captured.statusCode, 503);
    assert.deepEqual(res.captured.body, {
      ok: false,
      error: STRIPE_PAYMENTS_DISABLED_MESSAGE,
    });
    assert.equal(
      STRIPE_PAYMENTS_DISABLED_MESSAGE,
      "Stripe payments are temporarily unavailable"
    );
    assert.deepEqual(stripePaymentsDisabledBody(), res.captured.body);
  });

  it("does not reject when STRIPE_PAYMENTS_ENABLED=true", () => {
    process.env.STRIPE_PAYMENTS_ENABLED = "true";
    const res = mockRes();
    const rejected = rejectDisabledStripePayments(res);
    assert.equal(rejected, false);
    assert.equal(res.captured.statusCode, 0);
    assert.equal(res.captured.body, null);
  });

  it("gates initialize, subscribe, and quote before Stripe work", () => {
    const files = [
      "api/stripe/initialize.ts",
      "api/stripe/subscribe.ts",
      "api/stripe/quote.ts",
    ];
    for (const rel of files) {
      const src = readRepo(rel);
      const body = src.slice(src.indexOf("export default async function handler"));
      assert.match(body, /rejectDisabledStripePayments\(res\)/);
      const guardIdx = body.indexOf("rejectDisabledStripePayments(res)");
      const secretIdx = body.indexOf("STRIPE_SECRET_KEY");
      const fxIdx = body.indexOf("buildStripePriceSnapshot");
      assert.ok(guardIdx >= 0, `${rel} missing Stripe disable guard`);
      if (secretIdx >= 0) assert.ok(guardIdx < secretIdx, `${rel} checks secret before disable flag`);
      if (fxIdx >= 0) assert.ok(guardIdx < fxIdx, `${rel} quotes FX before disable flag`);
    }
  });

  it("rejects initialize and subscribe HTTP handlers with 503", async () => {
    delete process.env.STRIPE_PAYMENTS_ENABLED;
    const initialize = require("../.tmp-test/stripe/initialize").default;
    const subscribe = require("../.tmp-test/stripe/subscribe").default;
    const quote = require("../.tmp-test/stripe/quote").default;

    const initRes = mockRes();
    await initialize({ method: "POST", body: { bookingId: "booking-1" } }, initRes);
    assert.equal(initRes.captured.statusCode, 503);
    assert.equal(initRes.captured.body.error, STRIPE_PAYMENTS_DISABLED_MESSAGE);

    const subRes = mockRes();
    await subscribe(
      {
        method: "POST",
        body: {
          bookingId: "booking-1",
          userId: "user-1",
          email: "a@b.com",
          amount: 200,
        },
      },
      subRes
    );
    assert.equal(subRes.captured.statusCode, 503);
    assert.equal(subRes.captured.body.error, STRIPE_PAYMENTS_DISABLED_MESSAGE);

    const quoteRes = mockRes();
    await quote({ method: "GET", query: { amountGhs: "200", currency: "USD" }, body: {} }, quoteRes);
    assert.equal(quoteRes.captured.statusCode, 503);
    assert.equal(quoteRes.captured.body.error, STRIPE_PAYMENTS_DISABLED_MESSAGE);
  });

  it("does not disable Stripe webhooks or verification", () => {
    const webhookSrc = readRepo("api/stripe/webhook.ts");
    const verifySrc = readRepo("api/stripe/verify.ts");
    const processSrc = readRepo("api/lib/stripe-webhook-process.ts");
    assert.doesNotMatch(webhookSrc, /rejectDisabledStripePayments/);
    assert.doesNotMatch(verifySrc, /rejectDisabledStripePayments/);
    assert.doesNotMatch(processSrc, /rejectDisabledStripePayments/);
    assert.match(processSrc, /export async function processStripeWebhookEvent/);
    assert.match(webhookSrc, /STRIPE_WEBHOOK_SECRET/);
  });
});

describe("Paystack remains the active payment path", () => {
  it("does not gate Paystack initialize, verify, or webhook on the Stripe flag", () => {
    const initializeSrc = readRepo("api/paystack/initialize.ts");
    const verifySrc = readRepo("api/paystack/verify.ts");
    const webhookSrc = readRepo("api/paystack/webhook.ts");
    const markPaidSrc = readRepo("api/bookings/mark-paid.ts");
    for (const src of [initializeSrc, verifySrc, webhookSrc, markPaidSrc]) {
      assert.doesNotMatch(src, /rejectDisabledStripePayments/);
      assert.doesNotMatch(src, /STRIPE_PAYMENTS_ENABLED/);
    }
    assert.match(initializeSrc, /\/api\/paystack\/initialize|paystack/);
  });

  it("keeps the GHS 100 Stripe threshold in backend code", () => {
    assert.equal(isStripeCardAvailable(100), false);
    assert.equal(isStripeCardAvailable(100.01), true);
    const src = readRepo("api/lib/stripe-threshold.ts");
    assert.match(src, /STRIPE_CARD_MIN_AMOUNT_MAJOR = 100/);
  });
});

describe("Customer payment UI hides Stripe while disabled", () => {
  const checkoutSrc = readRepo(
    "apps/customer/src/screens/customer/create-booking/create-booking-screen.tsx"
  );
  const cartSrc = readRepo(
    "apps/customer/src/screens/customer/cart-screen/cart-screen.tsx"
  );
  const methodsSrc = readRepo(
    "apps/customer/src/screens/customer/payment-methods-screen/payment-methods-screen.tsx"
  );
  const detailSrc = readRepo(
    "apps/customer/src/screens/customer/booking-detail/booking-detail-screen.tsx"
  );
  const paymentsSrc = readRepo("apps/customer/src/services/payments.ts");
  const bookingServiceSrc = readRepo(
    "apps/customer/src/services/booking-service.ts"
  );
  const flagSrc = readRepo(
    "apps/customer/src/lib/stripe-payments-enabled.ts"
  );
  const clientThresholdSrc = readRepo(
    "apps/customer/src/lib/stripe-threshold.ts"
  );

  it("defaults the client flag to off unless EXPO_PUBLIC_STRIPE_PAYMENTS_ENABLED=true", () => {
    assert.match(flagSrc, /EXPO_PUBLIC_STRIPE_PAYMENTS_ENABLED/);
    assert.match(flagSrc, /parseStripePaymentsEnabledFlag/);
    assert.match(flagSrc, /Stripe payments are temporarily unavailable/);
  });

  it("hides card/Stripe selection, FX quote, and currency picker behind the flag", () => {
    assert.match(checkoutSrc, /STRIPE_PAYMENTS_ENABLED \?/);
    assert.match(checkoutSrc, /STRIPE_PAYMENTS_ENABLED &&/);
    assert.match(cartSrc, /STRIPE_PAYMENTS_ENABLED \?/);
    assert.match(methodsSrc, /Card payments are temporarily unavailable/);
    assert.match(methodsSrc, /STRIPE_PAYMENTS_ENABLED \? \(/);
    assert.match(methodsSrc, /Card currency/);
  });

  it("does not let customer payment helpers start Stripe while disabled", () => {
    assert.match(paymentsSrc, /assertStripePaymentsEnabled\(\);/);
    const initIdx = paymentsSrc.indexOf("export async function initializeStripeCheckout");
    const quoteIdx = paymentsSrc.indexOf("export async function quoteStripePayment");
    const subIdx = paymentsSrc.indexOf("export async function createStripeSubscription");
    const verifyIdx = paymentsSrc.indexOf("export async function verifyStripeBookingPayment");
    for (const idx of [initIdx, quoteIdx, subIdx]) {
      const slice = paymentsSrc.slice(idx, idx + 400);
      assert.match(slice, /assertStripePaymentsEnabled\(\);/);
    }
    const verifySlice = paymentsSrc.slice(verifyIdx, verifyIdx + 400);
    assert.doesNotMatch(verifySlice, /assertStripePaymentsEnabled/);
    assert.match(bookingServiceSrc, /STRIPE_PAYMENTS_DISABLED_MESSAGE/);
    assert.match(
      bookingServiceSrc,
      /provider === "stripe" && !STRIPE_PAYMENTS_ENABLED/
    );
    assert.match(detailSrc, /STRIPE_PAYMENTS_DISABLED_MESSAGE/);
    assert.match(detailSrc, /STRIPE_PAYMENTS_ENABLED &&/);
  });

  it("keeps checkout from calling Stripe subscribe/init unless the flag is on", () => {
    assert.match(
      checkoutSrc,
      /STRIPE_PAYMENTS_ENABLED && paymentProvider === 'stripe'/
    );
    assert.match(checkoutSrc, /createStripeSubscription/);
    assert.match(clientThresholdSrc, /STRIPE_CARD_MIN_AMOUNT_MAJOR = 100/);
  });
});
