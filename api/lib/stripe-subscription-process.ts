import type { Firestore } from "firebase-admin/firestore";
import type { WebhookProcessResult } from "./payment-integrity";
import {
  customerIdFromSession,
  invoiceIdFromSession,
  priceIdFromSession,
  subscriptionIdFromSession,
  type StripeApi,
  type StripeCheckoutSessionLike,
} from "./stripe-checkout";

export type StripeSubscriptionLike = {
  id?: string;
  status?: string;
  customer?: string | { id?: string };
  latest_invoice?: string | { id?: string };
  metadata?: Record<string, string | undefined> | null;
  items?: { data?: Array<{ price?: { id?: string } | string }> };
};

export type StripeInvoiceLike = {
  id?: string;
  paid?: boolean;
  status?: string;
  billing_reason?: string;
  subscription?: string | { id?: string } | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string | undefined> | null;
};

export type StripeBillingApi = StripeApi & {
  retrieveSubscription?: (id: string) => Promise<StripeSubscriptionLike>;
  retrieveInvoice?: (id: string) => Promise<StripeInvoiceLike>;
};

export type ApplyStripeSubscriptionResult = {
  duplicate: boolean;
  createdJobs: boolean;
};

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function idFrom(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && typeof (value as any).id === "string") {
    return String((value as any).id).trim();
  }
  return "";
}

export function mapStripeSubscriptionStatus(
  stripeStatus: unknown
): "pending" | "active" | "overdue" | "cancelled" {
  switch (String(stripeStatus || "").toLowerCase()) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "overdue";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function shouldCreateJobsForStripeInvoice(input: {
  paid: boolean;
  billingReason?: string | null;
}): boolean {
  if (!input.paid) return false;
  const reason = String(input.billingReason || "");
  return (
    reason === "subscription_create" ||
    reason === "subscription_cycle" ||
    reason === "" ||
    reason === "subscription_update"
  );
}

export function stripeSubscriptionMetaIds(input: {
  session?: StripeCheckoutSessionLike | null;
  subscription?: StripeSubscriptionLike | null;
  invoice?: StripeInvoiceLike | null;
}): { subscriptionId: string; bookingId: string; userId: string } {
  const meta = {
    ...(input.invoice?.metadata || {}),
    ...(input.subscription?.metadata || {}),
    ...(input.session?.metadata || {}),
  };
  return {
    subscriptionId: trimId(meta.subscriptionId),
    bookingId: trimId(meta.bookingId),
    userId: trimId(meta.userId),
  };
}

export async function processStripeSubscriptionEvent(
  event: any,
  deps: {
    stripe: StripeBillingApi;
    firestore: Firestore;
    serverTimestamp: () => unknown;
    applyPaidPeriod: (params: {
      firestore: Firestore;
      subscriptionId: string;
      bookingId?: string;
      userId?: string;
      processingId: string;
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
      stripePriceId?: string;
      stripeInvoiceId?: string;
      stripeCheckoutSessionId?: string;
      webhookEvent: string;
      skipJobs?: boolean;
    }) => Promise<ApplyStripeSubscriptionResult>;
    markFailed?: (params: {
      firestore: Firestore;
      subscriptionId: string;
      webhookEvent: string;
      processingId?: string;
    }) => Promise<void>;
    markCancelled?: (params: {
      firestore: Firestore;
      subscriptionId: string;
      webhookEvent: string;
    }) => Promise<void>;
  }
): Promise<WebhookProcessResult> {
  const eventName = String(event?.type || "");
  const object = event?.data?.object || {};

  if (eventName.startsWith("checkout.session.")) {
    const session = object as StripeCheckoutSessionLike;
    if (String(session.mode || "") !== "subscription") {
      return { ok: true, duplicate: false };
    }
    const sessionId = trimId(session.id);
    let latest = session;
    if (sessionId && deps.stripe.retrieveCheckoutSession) {
      try {
        latest = await deps.stripe.retrieveCheckoutSession(sessionId);
      } catch (err: any) {
        return {
          ok: false,
          retry: true,
          error: err?.message || "Failed to retrieve Checkout Session from Stripe",
        };
      }
    }
    const ids = stripeSubscriptionMetaIds({ session: latest });
    if (!ids.subscriptionId) {
      return {
        ok: false,
        retry: true,
        error: "Stripe subscription checkout is missing subscriptionId metadata",
      };
    }
    if (
      eventName === "checkout.session.async_payment_failed" ||
      eventName === "checkout.session.expired"
    ) {
      if (deps.markFailed) {
        await deps.markFailed({
          firestore: deps.firestore,
          subscriptionId: ids.subscriptionId,
          webhookEvent: eventName,
        });
      }
      return { ok: true, duplicate: false };
    }
    const paid = String(latest.payment_status || "").toLowerCase() === "paid";
    if (!paid) return { ok: true, duplicate: false };
    const processingId =
      invoiceIdFromSession(latest) || sessionId || `cs_${ids.subscriptionId}`;
    try {
      const result = await deps.applyPaidPeriod({
        firestore: deps.firestore,
        subscriptionId: ids.subscriptionId,
        bookingId: ids.bookingId,
        userId: ids.userId,
        processingId,
        stripeSubscriptionId: subscriptionIdFromSession(latest),
        stripeCustomerId: customerIdFromSession(latest),
        stripePriceId: priceIdFromSession(latest),
        stripeInvoiceId: invoiceIdFromSession(latest),
        stripeCheckoutSessionId: sessionId,
        webhookEvent: eventName,
        skipJobs: true,
      });
      return { ok: true, duplicate: result.duplicate };
    } catch (err: any) {
      return {
        ok: false,
        retry: true,
        error: err?.message || "Failed to apply Stripe subscription checkout",
      };
    }
  }

  if (eventName === "invoice.paid" || eventName === "invoice.payment_failed") {
    const invoice = object as StripeInvoiceLike;
    const invoiceId = trimId(invoice.id);
    let latest = invoice;
    if (invoiceId && deps.stripe.retrieveInvoice) {
      try {
        latest = await deps.stripe.retrieveInvoice(invoiceId);
      } catch (err: any) {
        return {
          ok: false,
          retry: true,
          error: err?.message || "Failed to retrieve invoice from Stripe",
        };
      }
    }
    const stripeSubId = idFrom(latest.subscription);
    let subscription: StripeSubscriptionLike | null = null;
    if (stripeSubId && deps.stripe.retrieveSubscription) {
      try {
        subscription = await deps.stripe.retrieveSubscription(stripeSubId);
      } catch (err: any) {
        return {
          ok: false,
          retry: true,
          error: err?.message || "Failed to retrieve subscription from Stripe",
        };
      }
    }
    const ids = stripeSubscriptionMetaIds({ subscription, invoice: latest });
    if (!ids.subscriptionId) {
      return { ok: true, duplicate: false };
    }
    if (eventName === "invoice.payment_failed") {
      if (deps.markFailed) {
        await deps.markFailed({
          firestore: deps.firestore,
          subscriptionId: ids.subscriptionId,
          webhookEvent: eventName,
          processingId: invoiceId,
        });
      }
      return { ok: true, duplicate: false };
    }
    if (
      !shouldCreateJobsForStripeInvoice({
        paid: latest.paid === true || String(latest.status || "") === "paid",
        billingReason: latest.billing_reason,
      })
    ) {
      return { ok: true, duplicate: false };
    }
    try {
      const result = await deps.applyPaidPeriod({
        firestore: deps.firestore,
        subscriptionId: ids.subscriptionId,
        bookingId: ids.bookingId,
        userId: ids.userId,
        processingId: invoiceId || `in_${ids.subscriptionId}`,
        stripeSubscriptionId: stripeSubId || undefined,
        stripeInvoiceId: invoiceId || undefined,
        webhookEvent: eventName,
      });
      return { ok: true, duplicate: result.duplicate };
    } catch (err: any) {
      return {
        ok: false,
        retry: true,
        error: err?.message || "Failed to apply Stripe invoice.paid",
      };
    }
  }

  if (
    eventName === "customer.subscription.updated" ||
    eventName === "customer.subscription.deleted" ||
    eventName === "customer.subscription.created"
  ) {
    const sub = object as StripeSubscriptionLike;
    const stripeSubId = trimId(sub.id);
    let latest = sub;
    if (stripeSubId && deps.stripe.retrieveSubscription) {
      try {
        latest = await deps.stripe.retrieveSubscription(stripeSubId);
      } catch (err: any) {
        return {
          ok: false,
          retry: true,
          error: err?.message || "Failed to retrieve subscription from Stripe",
        };
      }
    }
    const ids = stripeSubscriptionMetaIds({ subscription: latest });
    if (!ids.subscriptionId) return { ok: true, duplicate: false };
    const mapped = mapStripeSubscriptionStatus(latest.status);
    if (mapped === "cancelled" && deps.markCancelled) {
      await deps.markCancelled({
        firestore: deps.firestore,
        subscriptionId: ids.subscriptionId,
        webhookEvent: eventName,
      });
    } else if (mapped === "overdue" && deps.markFailed) {
      await deps.markFailed({
        firestore: deps.firestore,
        subscriptionId: ids.subscriptionId,
        webhookEvent: eventName,
      });
    } else {
      await deps.firestore.collection("subscriptions").doc(ids.subscriptionId).set(
        {
          status: mapped,
          stripeSubscriptionId: stripeSubId || latest.id,
          updatedAt: deps.serverTimestamp(),
          lastWebhookEvent: eventName,
        },
        { merge: true }
      );
    }
    return { ok: true, duplicate: false };
  }

  return { ok: true, duplicate: false };
}
