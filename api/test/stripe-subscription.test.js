const assert = require("assert");
const { describe, it } = require("node:test");
const {
  processStripeSubscriptionEvent,
  mapStripeSubscriptionStatus,
  shouldCreateJobsForStripeInvoice,
} = require("../.test-out/stripe-subscription-process");
const {
  buildSubscriptionCheckoutForm,
} = require("../.test-out/stripe-checkout");
const { webhookHttpStatus } = require("../.test-out/payment-integrity");
const {
  convertGhsToStripeCurrency,
} = require("../.test-out/stripe-fx");
const {
  snapshotFromConversion,
  lockedSnapshotFromRecord,
} = require("../.test-out/stripe-pricing");

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

describe("Stripe subscription price creation", () => {
  it("locks the converted recurring amount in Checkout price_data", () => {
    const form = buildSubscriptionCheckoutForm({
      bookingId: "b1",
      userId: "u1",
      subscriptionId: "sub_cc_1",
      email: "a@b.com",
      amountMinor: 1683,
      currency: "GBP",
      successUrl: "https://ok",
      cancelUrl: "https://cancel",
    });
    assert.equal(form.mode, "subscription");
    assert.equal(form["line_items[0][price_data][currency]"], "gbp");
    assert.equal(form["line_items[0][price_data][unit_amount]"], "1683");
    assert.equal(form["line_items[0][price_data][recurring][interval]"], "month");
    assert.equal(form["metadata[subscriptionId]"], "sub_cc_1");
  });

  it("reuses a locked Stripe Price id instead of converting again", () => {
    const form = buildSubscriptionCheckoutForm({
      bookingId: "b1",
      userId: "u1",
      subscriptionId: "sub_cc_1",
      email: "a@b.com",
      amountMinor: 1683,
      currency: "GBP",
      successUrl: "https://ok",
      cancelUrl: "https://cancel",
      stripePriceId: "price_locked",
    });
    assert.equal(form["line_items[0][price]"], "price_locked");
    assert.equal(form["line_items[0][price_data][unit_amount]"], undefined);
  });

  it("does not reprice an existing subscriber when FX later changes", async () => {
    const first = snapshotFromConversion(
      await convertGhsToStripeCurrency(200, "USD", {
        quote: {
          rates: { USD: 0.08 },
          rateTimestamp: "2026-09-17T12:00:00.000Z",
          provider: "manual_firebase",
        },
      })
    );
    const later = snapshotFromConversion(
      await convertGhsToStripeCurrency(200, "USD", {
        quote: {
          rates: { USD: 0.2 },
          rateTimestamp: "2026-09-18T12:00:00.000Z",
          provider: "manual_firebase",
        },
      })
    );
    const locked = lockedSnapshotFromRecord(first, 200);
    assert.ok(locked);
    assert.equal(locked.stripeAmountMinor, first.stripeAmountMinor);
    assert.notEqual(later.stripeAmountMinor, first.stripeAmountMinor);
    const form = buildSubscriptionCheckoutForm({
      bookingId: "b1",
      userId: "u1",
      subscriptionId: "sub_cc_1",
      email: "a@b.com",
      amountMinor: locked.stripeAmountMinor,
      currency: "USD",
      successUrl: "https://ok",
      cancelUrl: "https://cancel",
      stripePriceId: "price_locked",
    });
    assert.equal(form["line_items[0][price]"], "price_locked");
    assert.equal(form["line_items[0][price_data][unit_amount]"], undefined);
  });

  it("uses the new Firebase FX rate only for a newly created subscription", async () => {
    const existing = snapshotFromConversion(
      await convertGhsToStripeCurrency(200, "USD", {
        quote: {
          rates: { USD: 0.08 },
          rateTimestamp: "2026-09-17T12:00:00.000Z",
          provider: "manual_firebase",
        },
      })
    );
    const createdAfterRateChange = snapshotFromConversion(
      await convertGhsToStripeCurrency(200, "USD", {
        quote: {
          rates: { USD: 0.2 },
          rateTimestamp: "2026-09-18T12:00:00.000Z",
          provider: "manual_firebase",
        },
      })
    );
    assert.equal(existing.fxProvider, "manual_firebase");
    assert.equal(createdAfterRateChange.fxProvider, "manual_firebase");
    assert.equal(existing.stripeAmountMinor, 1632);
    assert.equal(createdAfterRateChange.stripeAmountMinor, 4080);
    assert.notEqual(existing.stripeAmountMinor, createdAfterRateChange.stripeAmountMinor);
  });
});

describe("Stripe subscription webhooks", () => {
  it("maps Stripe subscription status into Clean City status", () => {
    assert.equal(mapStripeSubscriptionStatus("active"), "active");
    assert.equal(mapStripeSubscriptionStatus("past_due"), "overdue");
    assert.equal(mapStripeSubscriptionStatus("canceled"), "cancelled");
  });

  it("creates jobs only for successful subscription invoices", () => {
    assert.equal(
      shouldCreateJobsForStripeInvoice({ paid: true, billingReason: "subscription_create" }),
      true
    );
    assert.equal(
      shouldCreateJobsForStripeInvoice({ paid: true, billingReason: "subscription_cycle" }),
      true
    );
    assert.equal(
      shouldCreateJobsForStripeInvoice({ paid: false, billingReason: "subscription_cycle" }),
      false
    );
  });

  it("does not create one-time jobs from a subscription checkout", async () => {
    let paidCalls = 0;
    const result = await processStripeSubscriptionEvent(
      {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_sub_1",
            mode: "subscription",
            payment_status: "paid",
            metadata: { subscriptionId: "sub_cc_1", bookingId: "b1", userId: "u1" },
          },
        },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () => ({
            id: "cs_sub_1",
            mode: "subscription",
            payment_status: "paid",
            metadata: { subscriptionId: "sub_cc_1", bookingId: "b1", userId: "u1" },
            invoice: "in_1",
            subscription: "sub_stripe_1",
          }),
          createCheckoutSession: async () => ({}),
        },
        firestore: mockFirestore(),
        serverTimestamp: () => "now",
        applyPaidPeriod: async (params) => {
          paidCalls += 1;
          assert.equal(params.skipJobs, true);
          assert.equal(params.subscriptionId, "sub_cc_1");
          return { duplicate: false, createdJobs: false };
        },
      }
    );
    assert.equal(result.ok, true);
    assert.equal(paidCalls, 1);
  });

  it("applies invoice.paid once and treats a replay as duplicate", async () => {
    let calls = 0;
    const deps = {
      stripe: {
        retrieveCheckoutSession: async () => ({}),
        createCheckoutSession: async () => ({}),
        retrieveInvoice: async () => ({
          id: "in_1",
          paid: true,
          status: "paid",
          billing_reason: "subscription_cycle",
          subscription: "sub_stripe_1",
        }),
        retrieveSubscription: async () => ({
          id: "sub_stripe_1",
          status: "active",
          metadata: { subscriptionId: "sub_cc_1", bookingId: "b1", userId: "u1" },
        }),
      },
      firestore: mockFirestore(),
      serverTimestamp: () => "now",
      applyPaidPeriod: async () => {
        calls += 1;
        return { duplicate: calls > 1, createdJobs: calls === 1 };
      },
    };
    const event = {
      type: "invoice.paid",
      data: { object: { id: "in_1", paid: true, subscription: "sub_stripe_1" } },
    };
    const first = await processStripeSubscriptionEvent(event, deps);
    const second = await processStripeSubscriptionEvent(event, deps);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(calls, 2);
    assert.equal(webhookHttpStatus(second), 200);
  });

  it("marks a failed invoice without creating jobs", async () => {
    let failed = 0;
    let paid = 0;
    const result = await processStripeSubscriptionEvent(
      {
        type: "invoice.payment_failed",
        data: { object: { id: "in_fail", paid: false, subscription: "sub_stripe_1" } },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () => ({}),
          createCheckoutSession: async () => ({}),
          retrieveInvoice: async () => ({
            id: "in_fail",
            paid: false,
            subscription: "sub_stripe_1",
          }),
          retrieveSubscription: async () => ({
            id: "sub_stripe_1",
            metadata: { subscriptionId: "sub_cc_1" },
          }),
        },
        firestore: mockFirestore(),
        serverTimestamp: () => "now",
        applyPaidPeriod: async () => {
          paid += 1;
          return { duplicate: false, createdJobs: false };
        },
        markFailed: async () => {
          failed += 1;
        },
      }
    );
    assert.equal(result.ok, true);
    assert.equal(failed, 1);
    assert.equal(paid, 0);
  });

  it("cancels on customer.subscription.deleted", async () => {
    let cancelled = 0;
    const result = await processStripeSubscriptionEvent(
      {
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_stripe_1", status: "canceled" } },
      },
      {
        stripe: {
          retrieveCheckoutSession: async () => ({}),
          createCheckoutSession: async () => ({}),
          retrieveSubscription: async () => ({
            id: "sub_stripe_1",
            status: "canceled",
            metadata: { subscriptionId: "sub_cc_1" },
          }),
        },
        firestore: mockFirestore(),
        serverTimestamp: () => "now",
        applyPaidPeriod: async () => ({ duplicate: false, createdJobs: false }),
        markCancelled: async () => {
          cancelled += 1;
        },
      }
    );
    assert.equal(result.ok, true);
    assert.equal(cancelled, 1);
  });
});
