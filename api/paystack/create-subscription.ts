import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import type { CollectionFrequency } from "./subscription-types";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

interface CreateSubscriptionRequest {
  userId: string;
  email: string;
  amount: number;
  collectionFrequency: CollectionFrequency;
  collectionDay: string;
  billingDay?: number;
  /** Legacy: map to collectionFrequency */
  interval?: "weekly" | "monthly";
  collectionDayOfWeek?: string;
  metadata?: Record<string, unknown>;
}

/** Next billing date: first occurrence of billingDay (1–28) on or after now. Calendar monthly. */
function getNextBillingDate(billingDay: number): Date {
  const now = new Date();
  const day = Math.min(Math.max(1, Math.floor(billingDay)), 28);
  const next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * POST /api/paystack/create-subscription
 * MoMo only. No Paystack plan or subscription. Internal recurring via daily cron.
 * transaction/initialize with channels: ["mobile_money"].
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
    const body = req.body as CreateSubscriptionRequest;
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

    if (!email || !userId) {
      return res.status(400).json({
        ok: false,
        error: "userId and email are required",
      });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Valid amount (GHS) is required",
      });
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

    const metadata: Record<string, string | number> = {
      userId,
      collectionDay: effectiveCollectionDay,
      ...(subscriptionId ? { subscriptionId } : {}),
      ...Object.fromEntries(
        Object.entries(extraMetadata || {}).map(([k, v]) => [
          k,
          typeof v === "object" ? JSON.stringify(v) : String(v),
        ])
      ),
    };

    const payload = {
      email,
      amount: Math.round(amountNum * 100),
      metadata,
      callback_url: `${CLIENT_APP_URL}/payment/success`,
      channels: ["mobile_money"] as const,
    };

    const paystackResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await paystackResponse.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[create-subscription] Paystack non-JSON:", text.slice(0, 200));
      return res.status(500).json({
        ok: false,
        error: "Invalid response from payment provider",
      });
    }

    if (!paystackResponse.ok || !data.status) {
      console.error("[create-subscription] Paystack error:", data);
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
      try {
        await admin
          .firestore()
          .collection(SUBSCRIPTIONS_COLLECTION)
          .doc(subscriptionId)
          .set(
            { updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          );
      } catch (e) {
        console.error("Failed to update subscription:", e);
      }
    }

    return res.status(201).json({
      ok: true,
      authorizationUrl,
      reference,
      ...(subscriptionId ? { subscriptionId } : {}),
    });
  } catch (error: any) {
    console.error("create-subscription error:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize subscription payment",
      details: error?.message,
    });
  }
}
