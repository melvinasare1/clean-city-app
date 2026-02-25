import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getSubscriptionById } from "./bookings";

const SUBSCRIPTIONS_COLLECTION = "subscriptions";

/**
 * POST /api/paystack/cancel-subscription
 * MoMo only; no Paystack subscription. Updates Firestore status to "cancelled".
 * Accepts subscriptionId or subscriptionCode (alias) as a non-empty string.
 */
interface CancelSubscriptionRequest {
  subscriptionId?: string;
  subscriptionCode?: string;
  reference?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Normalize body (Vercel may parse JSON; body might be string or undefined)
    let body = req.body as CancelSubscriptionRequest | string | undefined;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body) as CancelSubscriptionRequest;
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== "object") {
      body = {} as CancelSubscriptionRequest;
    }

    const rawId = body.subscriptionId ?? body.subscriptionCode;
    const subscriptionId =
      rawId != null && rawId !== "" ? String(rawId).trim() : "";

    console.log(
      "[Cancel subscription] Raw ID:",
      rawId,
      "Subscription ID:",
      subscriptionId,
    );

    if (!subscriptionId) {
      return res.status(400).json({
        ok: false,
        error: "subscriptionId is required and must be a string",
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

    await admin
      .firestore()
      .collection(SUBSCRIPTIONS_COLLECTION)
      .doc(subscriptionId)
      .set(
        {
          status: "cancelled",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
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
