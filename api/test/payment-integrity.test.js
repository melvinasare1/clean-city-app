const assert = require("assert");
const { describe, it } = require("node:test");
const {
  oneTimeJobDocId,
  isSuccessfulPaystackStatus,
  isChargeSuccessEvent,
  resolveEvidenceBookingId,
  shouldCreateOneTimeJob,
  isFulfillmentComplete,
  webhookHttpStatus,
  assemblePublicPaymentStatus,
  statusModeAllowOrigin,
} = require("../.test-out/payment-integrity");
const {
  executePaidOneTimeFulfillment,
  PaymentFulfillmentError,
} = require("../.test-out/payment-fulfillment-core");
const {
  isValidPaystackSignature,
  rawBodyForSignature,
} = require("../.test-out/paystack-signature");

const crypto = require("crypto");

function sampleBooking(overrides = {}) {
  return {
    userId: "user-1",
    type: "one_off",
    location: "East Legon",
    date: "2026-09-20",
    windowId: "morning",
    windowLabel: "Morning",
    items: [{ type: "bin", quantity: 1, unitPrice: 1, totalPrice: 1 }],
    metadata: { addressLine1: "1 Test St", area: "Accra", phoneNumber: "0550000000" },
    ...overrides,
  };
}

describe("Paystack booking/job integrity", () => {
  it("uses a deterministic one-time job id", () => {
    assert.equal(oneTimeJobDocId("abc"), "one_time_abc");
  });

  it("treats only Paystack status=success as paid", () => {
    assert.equal(isSuccessfulPaystackStatus("success"), true);
    assert.equal(isSuccessfulPaystackStatus("failed"), false);
    assert.equal(isSuccessfulPaystackStatus("abandoned"), false);
    assert.equal(isSuccessfulPaystackStatus("paid"), false);
    assert.equal(isChargeSuccessEvent("charge.success"), true);
    assert.equal(isChargeSuccessEvent("charge.failed"), false);
  });

  it("does not bind a booking from a client bookingId alone", () => {
    const result = resolveEvidenceBookingId({
      clientBookingId: "booking-client",
    });
    assert.equal("error" in result, true);
  });

  it("rejects a reference that belongs to a different booking", () => {
    const result = resolveEvidenceBookingId({
      clientBookingId: "booking-a",
      metadataBookingId: "booking-b",
    });
    assert.match(result.error, /does not belong/);
  });

  it("accepts a bookingId that matches Paystack metadata or the payments doc", () => {
    const fromMeta = resolveEvidenceBookingId({
      clientBookingId: "booking-1",
      metadataBookingId: "booking-1",
    });
    assert.equal(fromMeta.bookingId, "booking-1");
    const fromPayment = resolveEvidenceBookingId({
      paymentDocBookingId: "booking-2",
    });
    assert.equal(fromPayment.bookingId, "booking-2");
    const fromStored = resolveEvidenceBookingId({
      clientBookingId: "booking-3",
      referenceLoadedFromBookingId: "booking-3",
    });
    assert.equal(fromStored.bookingId, "booking-3");
  });

  it("does not create a paid job for unverified/failed payments", () => {
    assert.equal(
      shouldCreateOneTimeJob({ verifiedPaid: false, bookingType: "one_off" }),
      false
    );
  });

  it("creates a one-time job only after verified payment", async () => {
    const writes = { booking: null, payment: null, jobs: 0 };
    const result = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "paystack",
      reference: "ref-1",
      webhookEvent: "charge.success",
      loadBooking: async () => sampleBooking(),
      createJob: async () => {
        writes.jobs += 1;
        return { jobId: "one_time_booking-1", created: true };
      },
      writeBookingPaid: async (params) => {
        writes.booking = params;
      },
      writePaymentReconciled: async (params) => {
        writes.payment = params;
      },
    });
    assert.equal(result.created, true);
    assert.equal(result.jobId, "one_time_booking-1");
    assert.equal(writes.jobs, 1);
    assert.equal(writes.booking.jobId, "one_time_booking-1");
    assert.equal(writes.booking.source, "paystack");
    assert.equal(writes.payment.jobId, "one_time_booking-1");
  });

  it("does not create a job when payment is unverified", () => {
    assert.equal(
      shouldCreateOneTimeJob({ verifiedPaid: false, bookingType: "one_off" }),
      false
    );
    assert.equal(
      isFulfillmentComplete({
        bookingPaymentStatus: "paid",
        expectedBookingId: "b1",
      }),
      false
    );
  });

  it("duplicate webhook / existing job does not create a second job", async () => {
    let jobs = 0;
    const createJob = async () => {
      jobs += 1;
      return { jobId: "one_time_booking-1", created: jobs === 1 };
    };
    const first = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "paystack",
      reference: "ref-1",
      loadBooking: async () => sampleBooking(),
      createJob,
      writeBookingPaid: async () => {},
      writePaymentReconciled: async () => {},
    });
    const second = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "paystack",
      reference: "ref-1",
      loadBooking: async () => sampleBooking(),
      createJob,
      writeBookingPaid: async () => {},
      writePaymentReconciled: async () => {},
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.alreadyFulfilled, true);
    assert.equal(first.jobId, second.jobId);
    assert.equal(jobs, 2);
  });

  it("duplicate payment callback reuses the same job id", async () => {
    const createJob = async () => ({ jobId: "one_time_booking-1", created: false });
    const result = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "paystack",
      reference: "ref-1",
      loadBooking: async () => sampleBooking(),
      createJob,
      writeBookingPaid: async () => {},
    });
    assert.equal(result.alreadyFulfilled, true);
    assert.equal(result.jobId, "one_time_booking-1");
  });

  it("job already exists is treated as success, not a second insert", async () => {
    const result = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "paystack",
      reference: "ref-1",
      loadBooking: async () => sampleBooking(),
      createJob: async () => ({ jobId: "legacy-random-id", created: false }),
      writeBookingPaid: async () => {},
    });
    assert.equal(result.created, false);
    assert.equal(result.jobId, "legacy-random-id");
  });

  it("payment confirmed but job creation fails is retryable and does not mark paid", async () => {
    let markedPaid = false;
    await assert.rejects(
      () =>
        executePaidOneTimeFulfillment({
          bookingId: "booking-1",
          source: "paystack",
          reference: "ref-1",
          loadBooking: async () => sampleBooking(),
          createJob: async () => {
            throw new Error("Firestore unavailable");
          },
          writeBookingPaid: async () => {
            markedPaid = true;
          },
        }),
      (err) => {
        assert.equal(err instanceof PaymentFulfillmentError, true);
        assert.equal(err.retry, true);
        return true;
      }
    );
    assert.equal(markedPaid, false);
    assert.equal(
      webhookHttpStatus({ ok: false, retry: true, error: "Firestore unavailable" }),
      500
    );
  });

  it("admin manual payment marking uses the admin source and still creates one job", async () => {
    const result = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "admin",
      loadBooking: async () => sampleBooking(),
      createJob: async () => ({ jobId: "one_time_booking-1", created: true }),
      writeBookingPaid: async (params) => {
        assert.equal(params.source, "admin");
        assert.equal(params.jobId, "one_time_booking-1");
      },
    });
    assert.equal(result.created, true);
    assert.equal(result.jobId, "one_time_booking-1");
  });

  it("Stripe fulfillment uses the shared payment-fulfillment logic", async () => {
    const result = await executePaidOneTimeFulfillment({
      bookingId: "booking-1",
      source: "stripe",
      reference: "cs_test_1",
      stripeCheckoutSessionId: "cs_test_1",
      stripePaymentIntentId: "pi_test_1",
      loadBooking: async () => sampleBooking(),
      createJob: async (params) => {
        assert.equal(params.paymentMethod, "card");
        assert.equal(params.paymentReference, "cs_test_1");
        return { jobId: "one_time_booking-1", created: true };
      },
      writeBookingPaid: async (params) => {
        assert.equal(params.source, "stripe");
        assert.equal(params.stripeCheckoutSessionId, "cs_test_1");
      },
      writePaymentReconciled: async (params) => {
        assert.equal(params.source, "stripe");
        assert.equal(params.jobId, "one_time_booking-1");
      },
    });
    assert.equal(result.created, true);
    assert.equal(result.jobId, "one_time_booking-1");
  });

  it("webhook HMAC must match the Paystack secret", () => {
    const secret = "sk_test_secret";
    const body = { event: "charge.success", data: { reference: "r1", status: "success" } };
    const raw = rawBodyForSignature(body);
    const signature = crypto.createHmac("sha512", secret).update(raw).digest("hex");
    assert.equal(isValidPaystackSignature(secret, raw, signature), true);
    assert.equal(isValidPaystackSignature(secret, raw, "nope"), false);
  });

  it("does not acknowledge an internal processing error as success", () => {
    assert.equal(webhookHttpStatus({ ok: true, duplicate: false }), 200);
    assert.equal(
      webhookHttpStatus({ ok: false, retry: true, error: "job create failed" }),
      500
    );
    assert.equal(
      webhookHttpStatus({ ok: false, retry: false, error: "Booking missing" }),
      400
    );
  });
});

describe("public payment status", () => {
  it("allows only the website and local dev origins", () => {
    assert.equal(statusModeAllowOrigin("https://cleancitygh.com"), "https://cleancitygh.com");
    assert.equal(
      statusModeAllowOrigin("https://www.cleancitygh.com"),
      "https://www.cleancitygh.com"
    );
    assert.equal(statusModeAllowOrigin("http://localhost:8080"), "http://localhost:8080");
    assert.equal(statusModeAllowOrigin("https://evil.example"), null);
    assert.equal(statusModeAllowOrigin("https://cleancitygh.com.evil.com"), null);
    assert.equal(statusModeAllowOrigin("*"), null);
  });

  it("confirms a one-off booking only after it is marked paid", () => {
    const paid = assemblePublicPaymentStatus({
      reference: "ref_one",
      paymentDocExists: true,
      paymentType: "one_time",
      paymentAmount: 45,
      paymentCurrency: "GHS",
      paystackFound: true,
      paystackStatus: "success",
      booking: {
        paymentStatus: "paid",
        paymentReference: "ref_one",
        date: "2026-09-28",
        windowLabel: "Morning",
        items: [{ quantity: 2, type: "General waste" }],
      },
    });
    assert.equal(paid.status, "confirmed");
    assert.equal(paid.type, "one_time");
    assert.equal(paid.amount, 45);
    assert.equal(paid.currency, "GHS");
    assert.equal(paid.summary, "Morning · 28 Sep 2026 · 2 bins");
    assert.equal(paid.rawPaystack, undefined);
  });

  it("stays processing when Paystack succeeded and the webhook has not marked the booking paid", () => {
    const pendingWebhook = assemblePublicPaymentStatus({
      reference: "ref_one",
      paymentDocExists: true,
      paymentType: "one_time",
      paymentAmount: 45,
      paystackFound: true,
      paystackStatus: "success",
      booking: {
        paymentStatus: "initiated",
        paymentReference: "ref_one",
        date: "2026-09-28",
        windowLabel: "Morning",
        items: [{ quantity: 1, type: "bin" }],
      },
    });
    assert.equal(pendingWebhook.status, "processing");
    assert.equal(pendingWebhook.type, "one_time");
    assert.equal(pendingWebhook.summary, "Morning · 28 Sep 2026 · 1 bin");
  });

  it("confirms a subscription from the webhook payment reference and describes the cadence", () => {
    const result = assemblePublicPaymentStatus({
      reference: "ref_sub",
      paymentDocExists: true,
      paymentType: "subscription",
      paymentAmount: 120,
      paymentCurrency: "GHS",
      paystackFound: true,
      paystackStatus: "success",
      metadataFrequency: "weekly",
      subscription: {
        paymentStatus: "paid",
        paymentReference: "ref_sub",
        lastPaymentReference: "ref_sub",
        collectionFrequency: "weekly",
        items: [{ quantity: 1, type: "bin" }],
      },
    });
    assert.equal(result.status, "confirmed");
    assert.equal(result.type, "subscription");
    assert.equal(result.summary, "Weekly collection · 1 bin");
  });

  it("does not treat an older active subscription as paid for a new reference", () => {
    const result = assemblePublicPaymentStatus({
      reference: "ref_new",
      paymentDocExists: true,
      paymentType: "subscription",
      paystackFound: true,
      paystackStatus: "success",
      subscription: {
        paymentStatus: "paid",
        paymentReference: "ref_old",
        lastPaymentReference: "ref_old",
        collectionFrequency: "monthly",
        items: [{ quantity: 2, type: "bin" }],
      },
    });
    assert.equal(result.status, "processing");
  });

  it("confirms a store order without including the delivery address", () => {
    const result = assemblePublicPaymentStatus({
      reference: "ref_store",
      paymentDocExists: true,
      paymentType: "store_order",
      paymentAmount: 30,
      paystackFound: true,
      paystackStatus: "success",
      order: {
        status: "paid",
        paymentStatus: "paid",
        paymentReference: "ref_store",
        items: [{ quantity: 1 }, { quantity: 2 }],
      },
    });
    assert.equal(result.status, "confirmed");
    assert.equal(result.type, "store");
    assert.equal(result.summary, "3 items");
    assert.equal(result.address, undefined);
    assert.equal(result.email, undefined);
  });

  it("returns failed for abandoned Paystack charges and not_found for unknown references", () => {
    const failed = assemblePublicPaymentStatus({
      reference: "ref_fail",
      paymentDocExists: true,
      paymentType: "one_time",
      paystackFound: true,
      paystackStatus: "abandoned",
      booking: { paymentStatus: "initiated", paymentReference: "ref_fail" },
    });
    assert.equal(failed.status, "failed");

    const missing = assemblePublicPaymentStatus({
      reference: "missing_ref",
      paymentDocExists: false,
      paystackFound: false,
    });
    assert.deepEqual(missing, { status: "not_found" });
  });

  it("converts Paystack minor units when the payments document has no amount", () => {
    const result = assemblePublicPaymentStatus({
      reference: "ref_minor",
      paymentDocExists: false,
      paystackFound: true,
      paystackStatus: "success",
      paystackAmountMinor: 4500,
      paystackCurrency: "GHS",
      metadataType: "one_time",
    });
    assert.equal(result.status, "processing");
    assert.equal(result.amount, 45);
    assert.equal(result.currency, "GHS");
  });
});
