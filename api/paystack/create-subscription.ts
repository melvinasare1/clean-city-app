import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";

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

/**
 * Simulated subscription: we do NOT use Paystack plans.
 * We only call transaction/initialize so checkout shows Mobile Money + Card.
 */
interface CreateSubscriptionRequest {
  userId: string;
  email: string;
  /** Amount in GHS. Converted to pesewas once for Paystack. */
  amount: number;
  interval: "weekly" | "monthly";
  collectionDayOfWeek: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/paystack/create-subscription
 * Simulated recurring: initializes a one-time transaction only.
 * No plan, no subscription_code, no authorization_code → Mobile Money allowed.
 * Returns: { ok: true, authorizationUrl, reference }
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

    // Single conversion to pesewas; do not divide before initialize
    const amountInPesewas = Math.round(amountNum * 100);

    // Create subscription doc first so we can put subscriptionId in metadata (webhook will update it on success)
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
          amount: amountNum,
          interval: body.interval,
          collectionDayOfWeek: String(collectionDayOfWeek ?? ""),
          status: "pending",
          metadata: extraMetadata || {},
          createdAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        },
        { merge: false }
      );
    }

    const metadata: Record<string, string | number> = {
      userId,
      collectionDayOfWeek: String(collectionDayOfWeek ?? ""),
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
      amount: amountInPesewas,
      metadata,
      callback_url: `${CLIENT_APP_URL}/payment/success`,
    };

    console.log("[Init] Sending to Paystack:", {
      email,
      amount: amountInPesewas,
      metadata,
    });

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

    // Update subscription doc with reference
    if (admin.apps.length && subscriptionId) {
      try {
        await admin
          .firestore()
          .collection(SUBSCRIPTIONS_COLLECTION)
          .doc(subscriptionId)
          .set(
            { reference, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          );
      } catch (e) {
        console.error("Failed to update subscription with reference:", e);
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
