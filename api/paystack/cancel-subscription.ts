import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getSubscriptionById } from "./bookings";

const SUBSCRIPTIONS_COLLECTION = "subscriptions";

/**
 * POST /api/paystack/cancel-subscription
 * Simulated recurring: we do not use Paystack subscription API.
 * Only updates Firestore subscription status to "cancelled".
 */
interface CancelSubscriptionRequest {
  subscriptionId?: string;
  reference?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = (req.body || {}) as CancelSubscriptionRequest;
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return res.status(400).json({
        ok: false,
        error: "subscriptionId is required",
      });
    }

    if (!admin.apps.length) {
      return res.status(500).json({
        ok: false,
        error: "Server configuration error",
      });
    }

    const subscription = await getSubscriptionById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        ok: false,
        error: "Subscription not found",
      });
    }

    await admin.firestore().collection(SUBSCRIPTIONS_COLLECTION).doc(subscriptionId).set(
      {
        status: "cancelled",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      message: "Subscription cancelled",
    });
  } catch (error: any) {
    console.error("cancel-subscription error:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to cancel subscription",
      details: error?.message,
    });
  }
}
