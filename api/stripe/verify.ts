import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore, admin } from "../lib/firebase-admin";
import {
  PaymentFulfillmentError,
  fulfillPaidOneTimeBooking,
} from "../lib/payment-fulfillment";
import {
  bookingIdFromStripeSession,
  paymentIntentIdFromSession,
  shouldFulfillStripeCheckout,
} from "../lib/stripe-checkout";
import { liveStripeApi } from "../lib/stripe-api";

function pickQueryParam(value: string | string[] | undefined): string {
  if (value == null) return "";
  const s = Array.isArray(value) ? String(value[0] ?? "") : String(value);
  return s.trim();
}

/**
 * GET/POST /api/stripe/verify
 * Looks up the Checkout Session from Stripe (never from the client) and fulfills
 * only when payment_status is paid.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Server configuration error",
      message: "STRIPE_SECRET_KEY not configured",
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== "object") body = {};

    let sessionId =
      pickQueryParam(req.query.session_id as string | string[] | undefined) ||
      pickQueryParam(req.query.reference as string | string[] | undefined) ||
      (typeof body.sessionId === "string" ? body.sessionId.trim() : "") ||
      (typeof body.reference === "string" ? body.reference.trim() : "");

    const clientBookingId =
      pickQueryParam(req.query.bookingId as string | string[] | undefined) ||
      (typeof body.bookingId === "string" ? body.bookingId.trim() : "");

    if (!sessionId && clientBookingId) {
      const firestore = getFirestore();
      const bookingSnap = await firestore.collection("bookings").doc(clientBookingId).get();
      if (!bookingSnap.exists) {
        return res.status(404).json({ ok: false, paid: false, error: "Booking not found" });
      }
      const payment = (bookingSnap.data()?.payment || {}) as Record<string, unknown>;
      sessionId =
        (typeof payment.stripeCheckoutSessionId === "string"
          ? payment.stripeCheckoutSessionId
          : "") ||
        (typeof payment.reference === "string" ? payment.reference : "");
    }

    if (!sessionId) {
      return res.status(400).json({
        ok: false,
        paid: false,
        error: "sessionId or bookingId is required",
      });
    }

    const session = await liveStripeApi.retrieveCheckoutSession(sessionId);
    const evidenceBookingId = bookingIdFromStripeSession(session);
    if (clientBookingId && evidenceBookingId && clientBookingId !== evidenceBookingId) {
      return res.status(400).json({
        ok: false,
        paid: false,
        error: "Payment reference does not belong to the requested booking.",
      });
    }

    const paid = shouldFulfillStripeCheckout({
      eventName: "checkout.session.completed",
      paymentStatus: session.payment_status,
    });
    const bookingId = evidenceBookingId || clientBookingId;

    if (paid && bookingId) {
      try {
        const firestore = getFirestore();
        await fulfillPaidOneTimeBooking(firestore, {
          bookingId,
          source: "stripe",
          reference: session.id,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentIdFromSession(session),
          Timestamp: admin.firestore.Timestamp,
        });
      } catch (err: any) {
        const retry = !(err instanceof PaymentFulfillmentError) || err.retry;
        return res.status(retry ? 500 : 400).json({
          ok: false,
          paid: true,
          fulfilled: false,
          error: err?.message || "Payment verified but job fulfillment failed",
        });
      }
    }

    return res.status(200).json({
      ok: true,
      paid,
      status: session.payment_status,
      reference: session.id,
      amount:
        typeof session.amount_total === "number" ? session.amount_total / 100 : undefined,
      currency: session.currency,
    });
  } catch (error: any) {
    console.error("Error verifying Stripe checkout:", error?.message);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to verify Stripe payment",
    });
  }
}
