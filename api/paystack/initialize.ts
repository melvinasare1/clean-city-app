import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getBookingById, getSubscriptionById, getUserEmail } from "./bookings";
import type { CollectionFrequency } from "./subscription-types";
import { getBillingPeriodEnd, toDate } from "./subscription-helpers";

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

interface InitializeRequest {
  bookingId?: string;
  subscriptionId?: string;
  /** New subscription (same URL as one-off): creates doc + MoMo payment link. May include bookingId. */
  userId?: string;
  email?: string;
  amount?: number;
  collectionFrequency?: CollectionFrequency;
  collectionDay?: string;
  billingDay?: number;
  interval?: "weekly" | "monthly";
  collectionDayOfWeek?: string;
  /** Required for new subscription: id of the subscription booking created by the client. */
  bookingId?: string;
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
 * One-off: { bookingId } → booking payment.
 * Existing subscription: { subscriptionId } → subscription payment (MoMo).
 * New subscription: { userId, email, amount, collectionFrequency, collectionDay, ... } → create doc + MoMo payment (channels: ["mobile_money"]).
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
    const { bookingId, subscriptionId, userId, email, amount } = body;

    if (bookingId && !(userId && email && amount != null && (body.collectionFrequency != null || body.collectionDayOfWeek != null))) {
      return await handleBookingPayment(req, res, bookingId);
    }
    if (userId && email && amount != null && (body.collectionFrequency != null || body.collectionDayOfWeek != null)) {
      return await handleNewSubscription(req, res, body);
    }
    if (subscriptionId) {
      return await handleSubscriptionPayment(req, res, subscriptionId);
    }

    return res.status(400).json({
      ok: false,
      error: "Provide bookingId, subscriptionId, or (userId + email + amount + collectionFrequency/collectionDay) for new subscription",
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

  let subscriptionId: string | null = null;
  if (admin.apps.length) {
    const firestore = admin.firestore();
    const docRef = firestore.collection(SUBSCRIPTIONS_COLLECTION).doc();
    subscriptionId = docRef.id;
    const now = new Date();
    await docRef.set(
      {
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
      },
      { merge: false }
    );
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

  if (admin.apps.length) {
    try {
      await createPaymentDocument(admin.firestore(), {
        id: reference,
        userId: userId!,
        subscriptionId: subscriptionId ?? undefined,
        bookingId: body.bookingId,
        type: "subscription",
        amount: amountNum,
        reference,
        billingPeriodStart: billingPeriodStart,
        billingPeriodEnd,
      });
    } catch (e) {
      console.error("Failed to create payment document:", e);
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
  const nextBilling = sub.nextBillingDate
    ? toDate(sub.nextBillingDate as { _seconds: number })
    : null;
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
            payment: { status: "initiated", reference },
            currentPaymentReference: reference,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      const sub = subscription as { nextBillingDate?: { _seconds: number }; billingDay?: number };
      const nextBilling = sub.nextBillingDate ? toDate(sub.nextBillingDate as any) : null;
      const periodStart = nextBilling
        ? new Date(nextBilling.getFullYear(), nextBilling.getMonth(), nextBilling.getDate())
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const periodEnd = getBillingPeriodEnd(periodStart);
      await createPaymentDocument(firestore, {
        id: reference,
        userId,
        subscriptionId,
        type: "subscription",
        amount: amountNum,
        reference,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
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
      await createPaymentDocument(admin.firestore(), {
        id: reference,
        userId: booking.userId,
        bookingId,
        type: "one_time",
        amount,
        reference,
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
