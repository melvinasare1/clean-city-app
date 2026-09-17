import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "./firebase-admin";
import {
  addCalendarMonth,
  createJobsForSubscription,
  toDate,
} from "../paystack/subscription-helpers";
import type {
  JobAddressSnapshot,
  JobCollectionFrequency,
  JobItemSnapshot,
} from "../paystack/payment-and-job-types";
import type { ApplyStripeSubscriptionResult } from "./stripe-subscription-process";

function jobItems(subData: Record<string, any>): JobItemSnapshot[] {
  const subItems = Array.isArray(subData?.items) ? subData.items : [];
  return subItems
    .map((i: any, idx: number) => ({
      id:
        i?.id ??
        (i?.type
          ? String(i.type).replace(/\s+/g, "_").toUpperCase()
          : `ITEM_${idx}`),
      type: String(i?.type ?? ""),
      quantity: Number(i?.quantity) ?? 0,
      unitPrice: Number(i?.unitPrice) ?? 0,
      totalPrice: Number(i?.totalPrice) ?? 0,
    }))
    .filter((i: JobItemSnapshot) => i.type);
}

export async function applyStripePaidSubscriptionPeriod(params: {
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
  Timestamp: { fromDate: (d: Date) => unknown };
}): Promise<ApplyStripeSubscriptionResult> {
  const subRef = params.firestore.collection("subscriptions").doc(params.subscriptionId);
  const snap = await subRef.get();
  if (!snap.exists) {
    throw new Error(`Subscription ${params.subscriptionId} not found`);
  }
  const subData = snap.data() as Record<string, any>;
  const already =
    subData?.lastProcessedStripeInvoiceId === params.processingId ||
    (Array.isArray(subData?.processedStripeBillingIds) &&
      subData.processedStripeBillingIds.includes(params.processingId));
  if (already) {
    return { duplicate: true, createdJobs: false };
  }

  const now = new Date();
  const wasOverdue = subData?.status === "overdue";
  const nextBilling = subData?.nextBillingDate
    ? addCalendarMonth(toDate(subData.nextBillingDate) ?? now)
    : addCalendarMonth(now);
  const bookingId = params.bookingId || String(subData.bookingId || "");
  const userId = params.userId || String(subData.userId || "");
  const processedIds = Array.isArray(subData?.processedStripeBillingIds)
    ? [...subData.processedStripeBillingIds, params.processingId]
    : [params.processingId];

  await subRef.set(
    {
      status: "active",
      paymentMethod: "card",
      source: "stripe",
      lastPaymentDate: FieldValue.serverTimestamp(),
      lastPaymentReference: params.processingId,
      lastProcessedStripeInvoiceId: params.processingId,
      processedStripeBillingIds: processedIds.slice(-24),
      nextBillingDate: nextBilling,
      paymentDueSince: FieldValue.delete(),
      currentPaymentReference: FieldValue.delete(),
      payment: {
        status: "paid",
        reference: params.processingId,
        source: "stripe",
      },
      ...(params.stripeSubscriptionId
        ? { stripeSubscriptionId: params.stripeSubscriptionId }
        : {}),
      ...(params.stripeCustomerId ? { stripeCustomerId: params.stripeCustomerId } : {}),
      ...(params.stripePriceId ? { stripePriceId: params.stripePriceId } : {}),
      ...(params.stripeInvoiceId ? { stripeInvoiceId: params.stripeInvoiceId } : {}),
      ...(params.stripeCheckoutSessionId
        ? { stripeCheckoutSessionId: params.stripeCheckoutSessionId }
        : {}),
      lastWebhookEvent: params.webhookEvent,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (bookingId) {
    await params.firestore.collection("bookings").doc(bookingId).set(
      {
        payment: {
          status: "paid",
          reference: params.processingId,
          source: "stripe",
          paidAt: FieldValue.serverTimestamp(),
          fulfillmentStatus: "fulfilled",
        },
      },
      { merge: true }
    );
  }

  const paymentDocId = params.stripeCheckoutSessionId || params.processingId;
  await params.firestore.collection("payments").doc(paymentDocId).set(
    {
      status: "success",
      source: "stripe",
      paymentMethod: "card",
      type: "subscription",
      subscriptionId: params.subscriptionId,
      ...(bookingId ? { bookingId } : {}),
      lastWebhookEvent: params.webhookEvent,
      fulfillmentStatus: "fulfilled",
      stripeInvoiceId: params.stripeInvoiceId || params.processingId,
      ...(params.stripeSubscriptionId
        ? { stripeSubscriptionId: params.stripeSubscriptionId }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (!params.skipJobs && !wasOverdue && userId) {
    const collectionFrequency = (subData?.collectionFrequency ??
      "monthly") as JobCollectionFrequency;
    const billingPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const meta =
      subData?.metadata && typeof subData.metadata === "object" ? subData.metadata : {};
    const addressSnapshot: JobAddressSnapshot = {
      addressLine1: meta?.addressLine1 ?? subData?.location ?? "",
      area: meta?.area ?? "",
      phoneNumber: meta?.phoneNumber ?? "",
    };
    await createJobsForSubscription(params.firestore, {
      subscriptionId: params.subscriptionId,
      userId,
      billingPeriodStart,
      collectionFrequency,
      collectionDay: subData?.collectionDay ?? undefined,
      items: jobItems(subData),
      location: subData?.location != null ? String(subData.location) : "",
      addressSnapshot,
      windowId: subData?.windowId ?? meta?.windowId ?? "morning",
      windowLabel: subData?.windowLabel ?? meta?.windowLabel ?? "",
      paymentMethod: "card",
      paymentReference: params.processingId,
      Timestamp: params.Timestamp as any,
    });
    return { duplicate: false, createdJobs: true };
  }

  return { duplicate: false, createdJobs: false };
}

export async function markStripeSubscriptionFailed(params: {
  firestore: Firestore;
  subscriptionId: string;
  webhookEvent: string;
  processingId?: string;
}): Promise<void> {
  await params.firestore.collection("subscriptions").doc(params.subscriptionId).set(
    {
      status: "overdue",
      lastWebhookEvent: params.webhookEvent,
      ...(params.processingId ? { lastFailedStripeInvoiceId: params.processingId } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markStripeSubscriptionCancelled(params: {
  firestore: Firestore;
  subscriptionId: string;
  webhookEvent: string;
}): Promise<void> {
  await params.firestore.collection("subscriptions").doc(params.subscriptionId).set(
    {
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: "system",
      lastWebhookEvent: params.webhookEvent,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
