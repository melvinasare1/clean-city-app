import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, getFirestore } from "../lib/firebase-admin";
import { liveStripeApi } from "../lib/stripe-api";
import {
  amountToMinorUnits,
  getOrCreateStripeCheckoutSession,
  paymentIntentIdFromSession,
} from "../lib/stripe-checkout";
import { getBookingById, getUserEmail } from "../paystack/bookings";

const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";
const PAYMENTS_COLLECTION = "payments";

/**
 * POST /api/stripe/initialize
 * Body: { bookingId: string, amount?: number }
 *
 * Amount from the client is ignored. The booking total in Firestore is used.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
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
    const body =
      typeof req.body === "object" && req.body != null ? req.body : {};
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "bookingId is required" });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ ok: false, error: "Booking not found" });
    }
    if (booking.payment?.status === "paid") {
      return res.status(400).json({ ok: false, error: "Booking is already paid" });
    }

    const email = await getUserEmail(booking.userId, booking);
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "User email not found. Please ensure the user has an email address in their profile.",
      });
    }

    const serverAmount = Number(booking.totalPrice);
    if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
      return res.status(400).json({ ok: false, error: "Booking has no valid amount" });
    }

    const existingSessionId =
      typeof booking.payment?.stripeCheckoutSessionId === "string"
        ? booking.payment.stripeCheckoutSessionId
        : typeof booking.payment?.reference === "string" &&
            String(booking.payment.reference).startsWith("cs_")
          ? booking.payment.reference
          : null;

    const successUrl = `${CLIENT_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${CLIENT_APP_URL}/payment/cancel`;

    const { session, reused } = await getOrCreateStripeCheckoutSession({
      bookingId,
      userId: booking.userId,
      email,
      serverAmountMajor: serverAmount,
      clientAmount: body.amount,
      existingSessionId,
      successUrl,
      cancelUrl,
      stripe: liveStripeApi,
    });

    if (!session?.id || !session.url) {
      return res.status(500).json({
        ok: false,
        error: "Stripe did not return a checkout URL",
      });
    }

    const paymentIntentId = paymentIntentIdFromSession(session);
    const firestore = getFirestore();
    const itemsSnapshot = Array.isArray(booking.items)
      ? (booking.items as any[])
          .map((i: any) => ({
            type: String(i?.type ?? ""),
            quantity: Number(i?.quantity) || 0,
            unitPrice: Number(i?.unitPrice) || 0,
            totalPrice: Number(i?.totalPrice) || 0,
          }))
          .filter((i) => i.type)
      : undefined;

    await firestore.collection(PAYMENTS_COLLECTION).doc(session.id).set(
      {
        userId: booking.userId,
        bookingId,
        type: "one_time",
        amount: serverAmount,
        amountMinor: amountToMinorUnits(serverAmount),
        currency: "GHS",
        reference: session.id,
        status: "initialized",
        paymentMethod: "card",
        source: "stripe",
        fulfillmentStatus: "pending",
        stripeCheckoutSessionId: session.id,
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        email,
        ...(itemsSnapshot?.length ? { items: itemsSnapshot } : {}),
        ...((booking as any).location != null
          ? { location: String((booking as any).location) }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
        ...(reused ? {} : { createdAt: FieldValue.serverTimestamp() }),
      },
      { merge: true }
    );

    await firestore.collection("bookings").doc(bookingId).set(
      {
        payment: {
          status: "initiated",
          source: "stripe",
          reference: session.id,
          authorizationUrl: session.url,
          amount: serverAmount,
          fulfillmentStatus: "pending",
          stripeCheckoutSessionId: session.id,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
          initiatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return res.status(reused ? 200 : 201).json({
      ok: true,
      authorizationUrl: session.url,
      reference: session.id,
      stripeCheckoutSessionId: session.id,
      reused,
    });
  } catch (error: any) {
    console.error("Error in stripe initialize:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize Stripe checkout",
      details: error?.message || "Unknown error",
    });
  }
}
