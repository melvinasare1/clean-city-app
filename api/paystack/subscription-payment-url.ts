import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getSubscriptionById, getUserEmail } from "./bookings";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

// Ensure Firebase Admin is initialized (bookings.ts initializes it when imported)
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

interface SubscriptionPaymentUrlRequest {
  subscriptionId: string;
  reference?: string;
}

/**
 * POST /api/paystack/subscription-payment-url
 * MoMo only. Initializes a one-time transaction for an existing subscription.
 * Always channels: ["mobile_money"]. No Paystack plan.
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
    const body = req.body as SubscriptionPaymentUrlRequest;
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return res.status(400).json({
        ok: false,
        error: "subscriptionId is required",
      });
    }

    const subscription = await getSubscriptionById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        ok: false,
        error: "Subscription not found",
      });
    }

    const userId = subscription.userId;
    const email =
      subscription.email ||
      (await getUserEmail(userId));
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
    const collectionDay = String(
      (subscription as any).collectionDay ?? subscription.collectionDayOfWeek ?? ""
    );

    const metadata: Record<string, string> = {
      subscriptionId,
      userId,
      collectionDay,
    };

    const payload = {
      email,
      amount: amountInPesewas,
      metadata,
      callback_url: `${CLIENT_APP_URL}/payment/success`,
      channels: ["mobile_money"] as const,
    };

    console.log("[Init] Sending to Paystack (subscription charge):", {
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
      console.error(
        "[subscription-payment-url] Paystack non-JSON:",
        text.slice(0, 200)
      );
      return res.status(500).json({
        ok: false,
        error: "Invalid response from payment provider",
      });
    }

    if (!paystackResponse.ok || !data.status) {
      console.error("[subscription-payment-url] Paystack error:", data);
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

    // Store reference (and optional payment_due state) for webhook/reminders
    if (admin.apps.length) {
      try {
        await admin
          .firestore()
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
      } catch (firestoreError) {
        console.error(
          "[subscription-payment-url] Failed to update subscription:",
          firestoreError
        );
        // Still return URL so user can pay
      }
    }

    return res.status(201).json({
      ok: true,
      authorizationUrl,
      reference,
    });
  } catch (error: any) {
    console.error("subscription-payment-url error:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to get subscription payment URL",
      details: error?.message,
    });
  }
}
