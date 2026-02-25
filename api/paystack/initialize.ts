import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getBookingById, getSubscriptionById, getUserEmail } from "./bookings";
import type { CollectionFrequency } from "./subscription-types";
import { getBillingPeriodEnd, toDate } from "./subscription-helpers";

/** Item snapshot for payment/subscription: type, quantity, unitPrice, totalPrice */
export interface PaymentItemSnapshot {
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

function createPaymentDocument(
  firestore: admin.firestore.Firestore,
  params: {
    id: string;
    userId: string;
    subscriptionId?: string;
    bookingId?: string;
    type: "subscription" | "one_time";
    amount: number;
    reference: string;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    /** User email at time of payment init */
    email?: string;
    /** Items being paid for (quantity, type, prices) */
    items?: PaymentItemSnapshot[];
    /** Location/address at time of payment init */
    location?: string;
  }
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const doc: Record<string, unknown> = {
    userId: params.userId,
    type: params.type,
    amount: params.amount,
    currency: "GHS",
    reference: params.reference,
    status: "initialized",
    paymentMethod: "momo",
    createdAt: now,
    updatedAt: now,
  };
  if (params.subscriptionId) doc.subscriptionId = params.subscriptionId;
  if (params.bookingId) doc.bookingId = params.bookingId;
  if (params.billingPeriodStart)
    doc.billingPeriodStart = admin.firestore.Timestamp.fromDate(params.billingPeriodStart);
  if (params.billingPeriodEnd)
    doc.billingPeriodEnd = admin.firestore.Timestamp.fromDate(params.billingPeriodEnd);
  if (params.email != null && params.email !== "") doc.email = params.email;
  if (params.items != null && params.items.length > 0) doc.items = params.items;
  if (params.location != null && params.location !== "") doc.location = params.location;
  return firestore.collection(PAYMENTS_COLLECTION).doc(params.id).set(doc);
}

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";
const PAYMENTS_COLLECTION = "payments";

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

export type PaymentType = "one_time" | "subscription_initial" | "subscription_renewal";

interface InitializeRequest {
  /** Required. Determines which flow to run. */
  paymentType: PaymentType;
  /** Required when paymentType === "one_time" */
  bookingId?: string;
  /** Required when paymentType === "subscription_renewal" */
  subscriptionId?: string;
  /** Required when paymentType === "subscription_initial" */
  userId?: string;
  email?: string;
  amount?: number;
  collectionFrequency?: CollectionFrequency;
  collectionDay?: string;
  billingDay?: number;
  interval?: "weekly" | "monthly";
  collectionDayOfWeek?: string;
  /** Required for subscription_initial: id of the subscription booking created by the client. */
  /** For subscription_initial: items (type, quantity, unitPrice, totalPrice) and location to store on subscription + payment. */
  items?: PaymentItemSnapshot[];
  location?: string;
  metadata?: Record<string, unknown>;
}

function getNextBillingDate(billingDay: number): Date {
  const now = new Date();
  const day = Math.min(Math.max(1, Math.floor(billingDay)), 28);
  const next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * POST /api/paystack/initialize
 * Unified endpoint. Required body: paymentType: "one_time" | "subscription_initial" | "subscription_renewal".
 * - one_time: require bookingId → create payment doc (type: one_time), metadata.type + metadata.bookingId, initialize Paystack (channels: ["mobile_money"]).
 * - subscription_initial: create subscription doc, create payment doc (type: subscription), metadata.type + metadata.subscriptionId, initialize Paystack (channels: ["mobile_money"]).
 * - subscription_renewal: require subscriptionId → create payment doc (type: subscription), set subscription status = "payment_due", metadata.type + metadata.subscriptionId, initialize Paystack (channels: ["mobile_money"]).
 * Returns: { ok: true, authorizationUrl, reference, subscriptionId? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Server configuration error",
      message: "PAYSTACK_SECRET_KEY not configured",
    });
  }

  try {
    const body = req.body as InitializeRequest;
    const paymentType = body.paymentType;

    if (!paymentType || !["one_time", "subscription_initial", "subscription_renewal"].includes(paymentType)) {
      return res.status(400).json({
        ok: false,
        error: "paymentType is required and must be one of: one_time, subscription_initial, subscription_renewal",
      });
    }

    if (paymentType === "one_time") {
      if (!body.bookingId) {
        return res.status(400).json({ ok: false, error: "bookingId is required when paymentType is one_time" });
      }
      return await handleBookingPayment(req, res, body.bookingId);
    }

    if (paymentType === "subscription_initial") {
      const { userId, email, amount } = body;
      if (!userId || !email || amount == null || !(body.collectionFrequency != null || body.collectionDayOfWeek != null)) {
        return res.status(400).json({
          ok: false,
          error: "userId, email, amount, and (collectionFrequency or collectionDayOfWeek) are required when paymentType is subscription_initial",
        });
      }
      if (!body.bookingId) {
        return res.status(400).json({ ok: false, error: "bookingId is required for subscription_initial" });
      }
      return await handleNewSubscription(req, res, body);
    }

    if (paymentType === "subscription_renewal") {
      if (!body.subscriptionId) {
        return res.status(400).json({ ok: false, error: "subscriptionId is required when paymentType is subscription_renewal" });
      }
      return await handleSubscriptionPayment(req, res, body.subscriptionId);
    }

    return res.status(400).json({
      ok: false,
      error: "Invalid paymentType",
    });
  } catch (error: any) {
    console.error("Error in initialize:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize transaction",
      details: error?.message || "Unknown error",
    });
  }
}

/** New subscription: create Firestore doc + Paystack transaction/initialize with channels: ["mobile_money"] */
async function handleNewSubscription(
  _req: VercelRequest,
  res: VercelResponse,
  body: InitializeRequest
) {
  const {
    userId,
    email,
    amount,
    collectionFrequency = "monthly",
    collectionDay = "",
    billingDay = 1,
    interval,
    collectionDayOfWeek,
    metadata: extraMetadata = {},
  } = body;

  if (!userId || !email) {
    return res.status(400).json({ ok: false, error: "userId and email are required" });
  }
  if (!body.bookingId) {
    return res.status(400).json({ ok: false, error: "bookingId is required for new subscription" });
  }
  const amountNum = Number(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ ok: false, error: "Valid amount (GHS) is required" });
  }

  const useLegacy = body.interval != null && body.collectionDayOfWeek != null;
  const effectiveFrequency: CollectionFrequency = useLegacy
    ? (interval === "monthly" ? "monthly" : "weekly")
    : collectionFrequency;
  const effectiveCollectionDay = useLegacy ? String(collectionDayOfWeek ?? "") : String(collectionDay ?? "");
  const effectiveBillingDay = Math.min(28, Math.max(1, Math.floor(Number(billingDay) || 1)));
  const nextBillingDate = getNextBillingDate(effectiveBillingDay);

  // Items: prefer body.items; fallback to metadata.binType + metadata.quantity for backward compat
  let itemsSnapshot: PaymentItemSnapshot[] | undefined;
  if (Array.isArray(body.items) && body.items.length > 0) {
    itemsSnapshot = body.items.map((i: any) => ({
      type: String(i.type ?? ""),
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      totalPrice: Number(i.totalPrice) || 0,
    })).filter((i) => i.type);
  } else if (body.metadata && typeof body.metadata === "object") {
    const meta = body.metadata as Record<string, unknown>;
    const binType = meta.binType != null ? String(meta.binType) : "";
    const qty = Math.max(0, Number(meta.quantity) || 0);
    if (binType || qty > 0) {
      itemsSnapshot = [{ type: binType || "subscription", quantity: qty || 1, unitPrice: 0, totalPrice: amountNum }];
    }
  }
  if (itemsSnapshot?.length === 0) itemsSnapshot = undefined;

  const locationStr =
    (body.location != null && String(body.location).trim() !== ""
      ? String(body.location).trim()
      : null) ??
    (body.metadata && typeof body.metadata === "object" && (body.metadata as Record<string, unknown>).location != null
      ? String((body.metadata as Record<string, unknown>).location).trim()
      : undefined);
  const locationToStore = locationStr && locationStr !== "" ? locationStr : undefined;

  let subscriptionId: string | null = null;
  if (admin.apps.length) {
    const firestore = admin.firestore();
    const docRef = firestore.collection(SUBSCRIPTIONS_COLLECTION).doc();
    subscriptionId = docRef.id;
    const now = new Date();
    const subDoc: Record<string, unknown> = {
      userId,
      email,
      paymentMethod: "momo",
      collectionFrequency: effectiveFrequency,
      collectionDay: effectiveCollectionDay,
      amount: amountNum,
      billingDay: effectiveBillingDay,
      nextBillingDate: admin.firestore.Timestamp.fromDate(nextBillingDate),
      status: "pending",
      createdAt: admin.firestore.Timestamp.fromDate(now),
      updatedAt: admin.firestore.Timestamp.fromDate(now),
      ...(extraMetadata && Object.keys(extraMetadata).length ? { metadata: extraMetadata } : {}),
    };
    if (itemsSnapshot?.length) subDoc.items = itemsSnapshot;
    if (locationToStore) subDoc.location = locationToStore;
    await docRef.set(subDoc, { merge: false });
  }

  const billingPeriodStart = new Date(nextBillingDate.getFullYear(), nextBillingDate.getMonth(), nextBillingDate.getDate());
  const billingPeriodEnd = getBillingPeriodEnd(billingPeriodStart);

  const metadata: Record<string, string> = {
    type: "subscription",
    subscriptionId: subscriptionId!,
    userId: userId!,
    bookingId: body.bookingId,
    collectionFrequency: effectiveFrequency,
    billingDay: String(effectiveBillingDay),
    billingPeriodStart: billingPeriodStart.toISOString(),
    billingPeriodEnd: billingPeriodEnd.toISOString(),
  };

  const paystackResponse = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountNum * 100),
        metadata,
        callback_url: `${CLIENT_APP_URL}/payment/success`,
        channels: ["mobile_money"],
      }),
    }
  );

  const text = await paystackResponse.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Invalid response from payment provider",
      details: text.slice(0, 200),
    });
  }
  if (!paystackResponse.ok || !data.status) {
    return res.status(paystackResponse.status || 500).json({
      ok: false,
      error: data.message || "Failed to initialize transaction",
    });
  }
  const authData = data.data;
  const authorizationUrl = authData?.authorization_url;
  const reference = authData?.reference;
  if (!authorizationUrl || !reference) {
    return res.status(500).json({
      ok: false,
      error: "Missing authorization_url or reference from Paystack",
    });
  }

  if (admin.apps.length && subscriptionId) {
    const firestore = admin.firestore();
    try {
      await createPaymentDocument(firestore, {
        id: reference,
        userId: userId!,
        subscriptionId: subscriptionId ?? undefined,
        bookingId: body.bookingId,
        type: "subscription",
        amount: amountNum,
        reference,
        billingPeriodStart: billingPeriodStart,
        billingPeriodEnd,
        email: email ?? undefined,
        items: itemsSnapshot?.length ? itemsSnapshot : undefined,
        location: locationToStore,
      });
      // Store reference on subscription doc so app can use it for verify/retry
      await firestore.collection(SUBSCRIPTIONS_COLLECTION).doc(subscriptionId).set(
        {
          reference,
          payment: { status: "initiated", reference },
          currentPaymentReference: reference,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to create payment document or update subscription:", e);
    }
  }

  return res.status(201).json({
    ok: true,
    authorizationUrl,
    reference,
    ...(subscriptionId ? { subscriptionId } : {}),
  });
}

async function handleSubscriptionPayment(
  _req: VercelRequest,
  res: VercelResponse,
  subscriptionId: string
) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({ ok: false, error: "Subscription not found" });
  }

  const userId = subscription.userId;
  const email = subscription.email || (await getUserEmail(userId));
  if (!email) {
    return res.status(400).json({
      ok: false,
      error: "User email not found for this subscription",
    });
  }

  const amountNum = Number(subscription.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({
      ok: false,
      error: "Subscription has no valid amount",
    });
  }

  const amountInPesewas = Math.round(amountNum * 100);
  const sub = subscription as Record<string, unknown>;
  const collectionFrequency = (sub.collectionFrequency as string) ?? "monthly";
  const billingDay = (sub.billingDay as number) ?? 1;
  const nextBilling = sub.nextBillingDate ? toDate(sub.nextBillingDate as any) : null;
  const now = new Date();
  const periodStart = nextBilling
    ? new Date(nextBilling.getFullYear(), nextBilling.getMonth(), nextBilling.getDate())
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEnd = getBillingPeriodEnd(periodStart);

  const metadata: Record<string, string> = {
    type: "subscription",
    subscriptionId,
    userId,
    collectionFrequency: String(collectionFrequency),
    billingDay: String(billingDay),
    billingPeriodStart: periodStart.toISOString(),
    billingPeriodEnd: periodEnd.toISOString(),
  };

  const paystackResponse = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInPesewas,
        metadata,
        callback_url: `${CLIENT_APP_URL}/payment/success`,
        channels: ["mobile_money"],
      }),
    }
  );

  const text = await paystackResponse.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Invalid response from payment provider",
      details: text.slice(0, 200),
    });
  }

  if (!paystackResponse.ok || !data.status) {
    return res.status(paystackResponse.status || 500).json({
      ok: false,
      error: data.message || "Failed to initialize transaction",
    });
  }

  const authData = data.data;
  const authorizationUrl = authData?.authorization_url;
  const reference = authData?.reference;
  if (!authorizationUrl || !reference) {
    return res.status(500).json({
      ok: false,
      error: "Missing authorization_url or reference from Paystack",
    });
  }

  if (admin.apps.length) {
    const firestore = admin.firestore();
    try {
      await firestore
        .collection(SUBSCRIPTIONS_COLLECTION)
        .doc(subscriptionId)
        .set(
          {
            status: "payment_due",
            payment: { status: "initiated", reference },
            currentPaymentReference: reference,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      const sub = subscription as { nextBillingDate?: { _seconds: number }; billingDay?: number; items?: PaymentItemSnapshot[]; location?: string; email?: string };
      const nextBilling = sub.nextBillingDate ? toDate(sub.nextBillingDate as any) : null;
      const periodStart = nextBilling
        ? new Date(nextBilling.getFullYear(), nextBilling.getMonth(), nextBilling.getDate())
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const periodEnd = getBillingPeriodEnd(periodStart);
      const renewalItems = Array.isArray(sub.items) && sub.items.length > 0
        ? sub.items.map((i: any) => ({
            type: String(i?.type ?? ""),
            quantity: Number(i?.quantity) || 0,
            unitPrice: Number(i?.unitPrice) || 0,
            totalPrice: Number(i?.totalPrice) || 0,
          })).filter((i: { type: string }) => i.type)
        : undefined;
      await createPaymentDocument(firestore, {
        id: reference,
        userId,
        subscriptionId,
        type: "subscription",
        amount: amountNum,
        reference,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        email: subscription.email ?? email ?? undefined,
        items: renewalItems?.length ? renewalItems : undefined,
        location: sub.location != null ? String(sub.location) : undefined,
      });
    } catch (e) {
      console.error("Failed to update subscription or create payment document:", e);
    }
  }

  return res.status(201).json({
    ok: true,
    authorizationUrl,
    reference,
  });
}

async function handleBookingPayment(
  _req: VercelRequest,
  res: VercelResponse,
  bookingId: string
) {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    return res.status(404).json({
      ok: false,
      error: "Booking not found",
    });
  }

  if (booking.payment?.status === "paid") {
    return res.status(400).json({
      ok: false,
      error: "Booking is already paid",
    });
  }

  const email = await getUserEmail(booking.userId, booking);
  if (!email) {
    return res.status(400).json({
      ok: false,
      error: "User email not found. Please ensure the user has an email address in their profile.",
      details: "Email is required by Paystack to process payments.",
    });
  }

  const amount = booking.totalPrice;
  const metadata: Record<string, string> = {
    type: "one_time",
    bookingId,
    userId: booking.userId,
  };
  const amountInPesewas = Math.round(amount * 100);

  const paystackResponse = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInPesewas,
        metadata,
        callback_url: `${CLIENT_APP_URL}/payment/success`,
        channels: ["mobile_money"],
      }),
    }
  );

  const text = await paystackResponse.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Invalid response from payment provider",
      details: text.slice(0, 200),
    });
  }

  if (!paystackResponse.ok || !data.status) {
    return res.status(paystackResponse.status || 500).json({
      ok: false,
      error: "Failed to initialize transaction",
      details: data.message || "Unknown error",
    });
  }

  const authData = data.data;
  const reference = authData.reference;
  if (admin.apps.length && reference) {
    try {
      const itemsSnapshot: PaymentItemSnapshot[] | undefined = Array.isArray(booking.items)
        ? (booking.items as any[]).map((i: any) => ({
            type: String(i?.type ?? ""),
            quantity: Number(i?.quantity) || 0,
            unitPrice: Number(i?.unitPrice) || 0,
            totalPrice: Number(i?.totalPrice) || 0,
          })).filter((i) => i.type)
        : undefined;
      await createPaymentDocument(admin.firestore(), {
        id: reference,
        userId: booking.userId,
        bookingId,
        type: "one_time",
        amount,
        reference,
        email: email ?? (booking as any).userEmail ?? undefined,
        items: itemsSnapshot?.length ? itemsSnapshot : undefined,
        location: (booking as any).location != null ? String((booking as any).location) : undefined,
      });
    } catch (e) {
      console.error("Failed to create payment document:", e);
    }
  }
  return res.status(201).json({
    ok: true,
    authorizationUrl: authData.authorization_url,
    reference,
  });
}
