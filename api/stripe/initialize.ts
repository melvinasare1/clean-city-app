import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, getFirestore } from "../lib/firebase-admin";
import {
  liveStripeApi,
  publicStripeError,
  stripeKeyMode,
} from "../lib/stripe-api";
import {
  getOrCreateStripeCheckoutSession,
  paymentIntentIdFromSession,
} from "../lib/stripe-checkout";
import { resolveStripeChargeCurrency } from "../lib/stripe-currency";
import { StripeFxError } from "../lib/stripe-fx";
import {
  buildStripePriceSnapshot,
  stripePriceSnapshotFields,
} from "../lib/stripe-pricing";
import {
  isStripeCardAvailable,
  STRIPE_CARD_THRESHOLD_MESSAGE,
} from "../lib/stripe-threshold";
import { getBookingById, getUserEmail } from "../paystack/bookings";

const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";
const PAYMENTS_COLLECTION = "payments";
const PROFILES_COLLECTION = "profiles";

/**
 * POST /api/stripe/initialize
 * Body: { bookingId: string, stripeCurrency?: "USD"|"GBP"|"EUR"|"CAD", amount?: number }
 *
 * Amount from the client is ignored. The booking total in Firestore (GHS) is used.
 * Card checkout is only allowed when that GHS total is above 100.
 * Stripe is charged in the customer's presentation currency after Firebase FX + 2%.
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

  let bookingId = "";
  let serverAmountGhs = 0;
  let stripeCurrency = resolveStripeChargeCurrency({});

  try {
    const body =
      typeof req.body === "object" && req.body != null ? req.body : {};
    bookingId =
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
    if (String(booking.type || "one_off") === "subscription") {
      return res.status(400).json({
        ok: false,
        error: "Use /api/stripe/subscribe for subscription card payments",
      });
    }

    const email = await getUserEmail(booking.userId, booking);
    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "User email not found. Please ensure the user has an email address in their profile.",
      });
    }

    serverAmountGhs = Number(booking.totalPrice);
    if (!Number.isFinite(serverAmountGhs) || serverAmountGhs <= 0) {
      return res.status(400).json({ ok: false, error: "Booking has no valid amount" });
    }

    if (!isStripeCardAvailable(serverAmountGhs)) {
      return res.status(400).json({
        ok: false,
        error: STRIPE_CARD_THRESHOLD_MESSAGE,
      });
    }

    const firestore = getFirestore();
    const profileSnap = await firestore
      .collection(PROFILES_COLLECTION)
      .doc(booking.userId)
      .get();
    const profile = (profileSnap.data() || {}) as Record<string, unknown>;
    stripeCurrency = resolveStripeChargeCurrency({
      requested: body.stripeCurrency,
      preferred: profile.preferredStripeCurrency,
      country: profile.country,
    });

    const snapshot = await buildStripePriceSnapshot(serverAmountGhs, stripeCurrency);

    const payment = (booking.payment || {}) as {
      status: string;
      reference?: string;
      stripeCheckoutSessionId?: string;
    };
    const existingSessionId =
      typeof payment.stripeCheckoutSessionId === "string"
        ? payment.stripeCheckoutSessionId
        : typeof payment.reference === "string" &&
            String(payment.reference).startsWith("cs_")
          ? payment.reference
          : null;

    const successUrl = `${CLIENT_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${CLIENT_APP_URL}/payment/cancel`;

    const { session, reused } = await getOrCreateStripeCheckoutSession({
      bookingId,
      userId: booking.userId,
      email,
      amountMinor: snapshot.stripeAmountMinor,
      currency: snapshot.stripeCurrency,
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
    const snapshotFields = stripePriceSnapshotFields(snapshot);
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
        amount: serverAmountGhs,
        currency: "GHS",
        ...snapshotFields,
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
          amount: serverAmountGhs,
          fulfillmentStatus: "pending",
          stripeCheckoutSessionId: session.id,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
          ...snapshotFields,
          initiatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    if (body.stripeCurrency) {
      await firestore.collection(PROFILES_COLLECTION).doc(booking.userId).set(
        { preferredStripeCurrency: snapshot.stripeCurrency },
        { merge: true }
      );
    }

    return res.status(reused ? 200 : 201).json({
      ok: true,
      authorizationUrl: session.url,
      reference: session.id,
      stripeCheckoutSessionId: session.id,
      reused,
      sourceAmountGhs: snapshot.sourceAmountGhs,
      sourceCurrency: "GHS",
      stripeCurrency: snapshot.stripeCurrency,
      finalStripeAmount: snapshot.finalStripeAmount,
      stripeSurchargePercent: snapshot.stripeSurchargePercent,
      exchangeRate: snapshot.exchangeRate,
    });
  } catch (error: unknown) {
    const stripe = publicStripeError(error);
    const isFx = error instanceof StripeFxError;
    console.error("[stripe/initialize] failed", {
      bookingId,
      currency: stripeCurrency,
      sourceAmountGhs: serverAmountGhs,
      mode: stripeKeyMode(),
      type: stripe.type,
      code: stripe.code,
      param: stripe.param,
      message: stripe.message,
      request_id: stripe.request_id,
    });
    return res.status(isFx ? 503 : 500).json({
      ok: false,
      error: stripe.message || "Failed to initialize Stripe checkout",
      stripe: {
        type: stripe.type,
        code: stripe.code,
        param: stripe.param,
        request_id: stripe.request_id,
        currency: stripeCurrency,
        amount: serverAmountGhs || undefined,
        mode: stripeKeyMode(),
      },
    });
  }
}
