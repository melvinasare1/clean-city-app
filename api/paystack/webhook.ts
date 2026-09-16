import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, getFirestore, admin } from "../lib/firebase-admin";
import {
  PaymentFulfillmentError,
  fulfillPaidOneTimeBooking,
} from "../lib/payment-fulfillment";
import {
  isChargeSuccessEvent,
  isSuccessfulPaystackStatus,
  webhookHttpStatus,
  type WebhookProcessResult,
} from "../lib/payment-integrity";
import {
  isValidPaystackSignature,
  rawBodyForSignature,
} from "../lib/paystack-signature";
import {
  addCalendarMonth,
  toDate,
  createJobsForSubscription,
} from "./subscription-helpers";
import type {
  JobAddressSnapshot,
  JobCollectionFrequency,
  JobItemSnapshot,
} from "./payment-and-job-types";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function processPaystackWebhookEvent(
  event: any
): Promise<WebhookProcessResult> {
  const eventName = event?.event;
  if (
    eventName !== "charge.success" &&
    eventName !== "charge.failed" &&
    eventName !== "charge.abandoned"
  ) {
    return { ok: true, duplicate: false };
  }

  const paystackData = event.data;
  const reference =
    trimId(paystackData?.reference) || trimId(paystackData?.transaction_reference);
  if (!reference) {
    return { ok: false, retry: true, error: "Webhook missing transaction reference" };
  }

  let firestore;
  try {
    firestore = getFirestore();
  } catch (err: any) {
    return {
      ok: false,
      retry: true,
      error: err?.message || "Firebase Admin not initialized",
    };
  }

  const amountKobo = paystackData.amount || 0;
  const amount = amountKobo / 100;
  const currency = paystackData.currency || "GHS";
  const status = (paystackData.status || "pending") as
    | "success"
    | "failed"
    | "abandoned"
    | "pending";
  const metadata = paystackData.metadata || {};

  const docRef = firestore.collection("transactions").doc(reference);
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? snapshot.data() : null;

  if (existing && existing.status === "success" && status !== "success") {
    return { ok: true, duplicate: true };
  }

  await docRef.set(
    {
      userId: metadata?.userId ?? existing?.userId ?? null,
      bookingId: metadata?.bookingId ?? existing?.bookingId ?? null,
      metadata: metadata ?? existing?.metadata ?? {},
      reference,
      amount,
      currency,
      status,
      rawPaystack: event,
      createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const paymentStatus =
    status === "success" ? "success" : status === "failed" ? "failed" : "abandoned";
  const paymentRef = firestore.collection("payments").doc(reference);
  await paymentRef.set(
    {
      status: paymentStatus,
      paystackStatus: status,
      reference,
      lastWebhookEvent: eventName,
      ...(metadata?.bookingId != null && metadata.bookingId !== ""
        ? { bookingId: String(metadata.bookingId) }
        : {}),
      ...(metadata?.orderId != null && metadata.orderId !== ""
        ? { orderId: String(metadata.orderId) }
        : {}),
      ...(metadata?.userId != null && metadata.userId !== ""
        ? { userId: String(metadata.userId) }
        : {}),
      ...(metadata?.type != null && metadata.type !== ""
        ? { type: String(metadata.type) }
        : {}),
      ...(metadata?.subscriptionId != null && metadata.subscriptionId !== ""
        ? { subscriptionId: String(metadata.subscriptionId) }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const paymentSnap = await paymentRef.get();
  const paymentDoc = paymentSnap.exists ? paymentSnap.data() : null;
  const paymentType = metadata?.type || paymentDoc?.type;

  if (isChargeSuccessEvent(eventName) && isSuccessfulPaystackStatus(status)) {
    if (paymentType === "store_order") {
      const orderId = trimId(metadata?.orderId) || trimId(paymentDoc?.orderId);
      if (orderId) {
        await firestore.collection("orders").doc(orderId).set(
          {
            status: "paid",
            payment: {
              status: "paid",
              reference,
              paidAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );
      }
    } else if (
      paymentType === "one_time" ||
      (paymentType == null && (trimId(metadata?.bookingId) || trimId(paymentDoc?.bookingId)))
    ) {
      const bookingId = trimId(metadata?.bookingId) || trimId(paymentDoc?.bookingId);
      if (!bookingId) {
        return {
          ok: false,
          retry: true,
          error: `Successful charge ${reference} has no bookingId`,
        };
      }
      try {
        const result = await fulfillPaidOneTimeBooking(firestore, {
          bookingId,
          source: "paystack",
          reference,
          webhookEvent: eventName,
          Timestamp: admin.firestore.Timestamp,
        });
        return { ok: true, duplicate: result.alreadyFulfilled, jobId: result.jobId };
      } catch (err: any) {
        const retry = !(err instanceof PaymentFulfillmentError) || err.retry;
        return {
          ok: false,
          retry,
          error: err?.message || `Failed to fulfill booking ${bookingId}`,
        };
      }
    } else if (paymentType === "subscription") {
      const subscriptionId = metadata?.subscriptionId;
      const userId = metadata?.userId as string | undefined;
      if (subscriptionId && userId) {
        const subRef = firestore.collection("subscriptions").doc(subscriptionId);
        const subSnap = await subRef.get();
        if (subSnap.exists) {
          const now = new Date();
          const subData = subSnap.data() as Record<string, any>;
          const wasOverdue = subData?.status === "overdue";
          const nextBilling = subData?.nextBillingDate
            ? addCalendarMonth(toDate(subData.nextBillingDate) ?? now)
            : addCalendarMonth(now);
          await subRef.set(
            {
              status: "active",
              lastPaymentDate: FieldValue.serverTimestamp(),
              lastPaymentReference: reference,
              nextBillingDate: nextBilling,
              paymentDueSince: FieldValue.delete(),
              currentPaymentReference: FieldValue.delete(),
              payment: {
                status: "paid",
                reference,
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const subscriptionBookingId =
            trimId(metadata?.bookingId) || trimId(subData?.bookingId);
          if (subscriptionBookingId) {
            await firestore.collection("bookings").doc(subscriptionBookingId).set(
              {
                payment: {
                  status: "paid",
                  reference,
                  source: "paystack",
                  paidAt: FieldValue.serverTimestamp(),
                },
              },
              { merge: true }
            );
          }

          if (!wasOverdue) {
            const collectionFrequency = (subData?.collectionFrequency ??
              "monthly") as JobCollectionFrequency;
            const billingPeriodStart = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate()
            );
            const meta =
              subData?.metadata && typeof subData.metadata === "object"
                ? subData.metadata
                : {};
            const addressSnapshot: JobAddressSnapshot = {
              addressLine1: meta?.addressLine1 ?? subData?.location ?? "",
              area: meta?.area ?? "",
              phoneNumber: meta?.phoneNumber ?? "",
            };
            const subItems = Array.isArray(subData?.items) ? subData.items : [];
            const items: JobItemSnapshot[] = subItems
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
            const location = subData?.location != null ? String(subData.location) : "";
            await createJobsForSubscription(firestore, {
              subscriptionId,
              userId,
              billingPeriodStart,
              collectionFrequency,
              collectionDay: subData?.collectionDay ?? undefined,
              items,
              location,
              addressSnapshot,
              windowId: subData?.windowId ?? meta?.windowId ?? "morning",
              windowLabel: subData?.windowLabel ?? meta?.windowLabel ?? "",
              Timestamp: admin.firestore.Timestamp,
            });
          }
        }
      }
    }
  } else if (status === "failed" && paymentType === "subscription") {
    const subscriptionId = metadata?.subscriptionId;
    if (subscriptionId) {
      await firestore.collection("subscriptions").doc(subscriptionId).set(
        { status: "overdue", updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }

  return { ok: true, duplicate: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const signature = req.headers["x-paystack-signature"] as string | undefined;
  if (!signature) {
    return res.status(400).json({ error: "Missing signature header" });
  }

  const rawBody = rawBodyForSignature(req.body);
  if (!isValidPaystackSignature(PAYSTACK_SECRET_KEY, rawBody, signature)) {
    console.error("Invalid Paystack webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const eventName = event?.event;
  if (!eventName) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  console.log(`Paystack webhook event: ${eventName}`, {
    reference: event?.data?.reference,
    status: event?.data?.status,
  });

  try {
    const result = await processPaystackWebhookEvent(event);
    const status = webhookHttpStatus(result);
    if (!result.ok) {
      console.error("Paystack webhook processing failed (will retry):", result.error);
      return res.status(status).json({ error: result.error, retry: true });
    }
    return res.status(200).json({ received: true, duplicate: result.duplicate });
  } catch (error: any) {
    console.error("Error handling Paystack webhook:", error?.message);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message || "Unknown error",
    });
  }
}
