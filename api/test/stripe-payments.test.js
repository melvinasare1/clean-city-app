const assert = require("assert");
const { describe, it } = require("node:test");
const crypto = require("crypto");
const {
  ignoreClientSpecifiedAmount,
  amountToMinorUnits,
  stripeMetadata,
  stripeCheckoutIdempotencyKey,
  canReuseCheckoutSession,
  getOrCreateStripeCheckoutSession,
  shouldFulfillStripeCheckout,
  bookingIdFromStripeSession,
} = require("../.test-out/stripe-checkout");
const {
  isValidStripeSignature,
  rawBodyForStripeSignature,
  stripeSignatureForPayload,
} = require("../.test-out/stripe-signature");
const {
  processStripeWebhookEvent,
} = require("../.test-out/stripe-webhook-process");
const {
  PaymentFulfillmentError,
} = require("../.test-out/payment-fulfillment-core");
const {
  isSuccessfulStripePaymentStatus,
  isStripeFulfillmentEvent,
  webhookHttpStatus,
} = require("../.test-out/payment-integrity");

function signedHeader(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = stripeSignatureForPayload(secret, String(timestamp), rawBody);
  return `t=${timestamp},v1=${sig}`;
}

function mockFirestore() {
  const writes = [];
  return {
    writes,
    collection(name) {
      return {
        doc(id) {
          return {
            async set(data, opts) {
              writes.push({ name, id, data, opts });
            },
          };
        },
      };
    },
  };
}

function paidSession(overrides = {}) {
  return {
    id: "cs_test_1",
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
    status: "complete",
    payment_status: "paid",
    amount_total: 1683,
    currency: "gbp",
    payment_intent: "pi_test_1",
    metadata: { bookingId: "booking-1", userId: "user-1", type: "one_time" },
    client_reference_id: "booking-1",
    ...overrides,
  };
}

describe("Stripe checkout initialization", () => {
  it("uses the server booking amount and ignores a client-supplied amount", () => {
    assert.equal(ignoreClientSpecifiedAmount(15, 1), 15);
    assert.equal(ignoreClientSpecifiedAmount(15, 9999), 15);
    assert.equal(amountToMinorUnits(15), 1500);
  });

  it("offers Stripe only when the booking total is above GHS 100", () => {
    const { isStripeCardAvailable } = require("../.test-out/stripe-threshold");
    assert.equal(isStripeCardAvailable(99), false);
    assert.equal(isStripeCardAvailable(100), false);
    assert.equal(isStripeCardAvailable(100.01), true);
    assert.equal(isStripeCardAvailable(101), true);
    assert.equal(isStripeCardAvailable(141), true);
  });

  it("includes the Clean City booking ID in Stripe metadata", () => {
    const metadata = stripeMetadata({ bookingId: "booking-1", userId: "user-1" });
    assert.equal(metadata.bookingId, "booking-1");
    assert.equal(metadata.type, "one_time");
    assert.equal(bookingIdFromStripeSession({ metadata, id: "cs_1" }), "booking-1");
  });

  it("reuses an open Checkout Session instead of creating a second payment object", async () => {
    let creates = 0;
    const existing = {
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
      status: "open",
      payment_status: "unpaid",
      amount_total: 1683,
      currency: "gbp",
    };
    const result = await getOrCreateStripeCheckoutSession({
      bookingId: "booking-1",
      userId: "user-1",
      email: "a@b.com",
      amountMinor: 1683,
      currency: "GBP",
      existingSessionId: "cs_test_1",
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      stripe: {
        retrieveCheckoutSession: async () => existing,
        createCheckoutSession: async () => {
          creates += 1;
          return { id: "cs_test_2", url: "https://checkout.stripe.com/c/pay/cs_test_2" };
        },
      },
    });
    assert.equal(result.reused, true);
    assert.equal(result.session.id, "cs_test_1");
    assert.equal(creates, 0);
    assert.equal(canReuseCheckoutSession(existing, 1683, "gbp"), true);
  });

  it("uses a deterministic idempotency key for the first checkout of a booking", () => {
    assert.equal(
      stripeCheckoutIdempotencyKey({
        bookingId: "booking-1",
        amountMinor: 1683,
        currency: "gbp",
      }),
      "booking_checkout_booking-1_gbp_1683"
    );
  });
});

describe("Stripe webhook integrity", () => {
  it("accepts a valid Stripe signature and rejects an invalid one", () => {
    const secret = "whsec_test";
    const body = { type: "checkout.session.completed" };
    const raw = rawBodyForStripeSignature(body);
    const header = signedHeader(secret, raw);
    assert.equal(isValidStripeSignature(secret, raw, header), true);
    assert.equal(isValidStripeSignature(secret, raw, "t=1,v1=nope"), false);
    assert.equal(isValidStripeSignature(secret, raw, undefined), false);
  });

  it("does not fulfill unpaid or failed Stripe payments", async () => {
    assert.equal(isSuccessfulStripePaymentStatus("unpaid"), false);
    assert.equal(isSuccessfulStripePaymentStatus("paid"), true);
    assert.equal(isStripeFulfillmentEvent("checkout.session.completed"), true);
    assert.equal(
      shouldFulfillStripeCheckout({
        eventName: "checkout.session.completed",
        paymentStatus: "unpaid",
      }),
      false
    );

    let fulfillCalls = 0;
    const unpaid = await processStripeWebhookEvent(
      {
        type: "checkout.session.completed",
        data: { object: paidSession({ payment_status: "unpaid", status: "open" }) },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () =>
            paidSession({ payment_status: "unpaid", status: "open" }),
          createCheckoutSession: async () => ({}),
        },
        firestore: mockFirestore(),
        fulfill: async () => {
          fulfillCalls += 1;
          return { jobId: "one_time_booking-1", created: true, alreadyFulfilled: false };
        },
        serverTimestamp: () => "now",
      }
    );
    assert.equal(unpaid.ok, true);
    assert.equal(fulfillCalls, 0);

    const failed = await processStripeWebhookEvent(
      {
        type: "checkout.session.async_payment_failed",
        data: { object: paidSession({ payment_status: "unpaid" }) },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () => paidSession({ payment_status: "unpaid" }),
          createCheckoutSession: async () => ({}),
        },
        firestore: mockFirestore(),
        fulfill: async () => {
          fulfillCalls += 1;
          return { jobId: "one_time_booking-1", created: true, alreadyFulfilled: false };
        },
        serverTimestamp: () => "now",
      }
    );
    assert.equal(failed.ok, true);
    assert.equal(fulfillCalls, 0);
  });

  it("fulfills a successful Stripe payment through shared fulfillment", async () => {
    const result = await processStripeWebhookEvent(
      {
        type: "checkout.session.completed",
        data: { object: paidSession() },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () => paidSession(),
          createCheckoutSession: async () => ({}),
        },
        firestore: mockFirestore(),
        fulfill: async (_db, params) => {
          assert.equal(params.source, "stripe");
          assert.equal(params.bookingId, "booking-1");
          assert.equal(params.reference, "cs_test_1");
          return { jobId: "one_time_booking-1", created: true, alreadyFulfilled: false };
        },
        serverTimestamp: () => "now",
      }
    );
    assert.equal(result.ok, true);
    assert.equal(result.duplicate, false);
    assert.equal(result.jobId, "one_time_booking-1");
  });

  it("duplicate Stripe webhook reuses the existing job and returns success", async () => {
    let fulfillCalls = 0;
    const deps = {
      stripe: {
        retrieveCheckoutSession: async () => paidSession(),
        createCheckoutSession: async () => ({}),
      },
      firestore: mockFirestore(),
      fulfill: async () => {
        fulfillCalls += 1;
        return {
          jobId: "one_time_booking-1",
          created: fulfillCalls === 1,
          alreadyFulfilled: fulfillCalls > 1,
        };
      },
      serverTimestamp: () => "now",
    };
    const event = {
      type: "checkout.session.completed",
      data: { object: paidSession() },
    };
    const first = await processStripeWebhookEvent(event, deps);
    const second = await processStripeWebhookEvent(event, deps);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(first.jobId, second.jobId);
    assert.equal(fulfillCalls, 2);
    assert.equal(webhookHttpStatus(second), 200);
  });

  it("returns a retryable webhook failure when payment succeeded but job creation fails", async () => {
    const result = await processStripeWebhookEvent(
      {
        type: "checkout.session.completed",
        data: { object: paidSession() },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () => paidSession(),
          createCheckoutSession: async () => ({}),
        },
        firestore: mockFirestore(),
        fulfill: async () => {
          throw new PaymentFulfillmentError("Firestore unavailable", true);
        },
        serverTimestamp: () => "now",
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.retry, true);
    assert.equal(webhookHttpStatus(result), 500);
  });
});
