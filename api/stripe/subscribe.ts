import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue, getFirestore } from "../lib/firebase-admin";
import {
  liveStripeApi,
  publicStripeError,
  stripeKeyMode,
} from "../lib/stripe-api";
import {
  buildSubscriptionCheckoutForm,
  customerIdFromSession,
  priceIdFromSession,
  subscriptionIdFromSession,
} from "../lib/stripe-checkout";
import { resolveStripeChargeCurrency } from "../lib/stripe-currency";
import { StripeFxError } from "../lib/stripe-fx";
import {
  buildStripePriceSnapshot,
  lockedSnapshotFromRecord,
  stripePriceSnapshotFields,
  type StripePriceSnapshot,
} from "../lib/stripe-pricing";
import { getBookingById, getSubscriptionById, getUserEmail } from "../paystack/bookings";
import { getBillingPeriodEnd } from "../paystack/subscription-helpers";
import type { CollectionFrequency } from "../paystack/subscription-types";

const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";
const PAYMENTS_COLLECTION = "payments";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";
const PROFILES_COLLECTION = "profiles";

function parseStartDateIso(iso: string): Date {
  const part = iso.trim().split("T")[0];
  const [y, m, d] = part.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function getNextBillingDate(billingDay: number): Date {
  const now = new Date();
  const day = Math.min(Math.max(1, Math.floor(billingDay)), 28);
  const next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
}

function addDaysDate(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * POST /api/stripe/subscribe
 * Creates or reuses a Stripe Checkout Session in subscription mode.
 * GHS plan price is converted once from Firebase FX (or reused from the locked snapshot).
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

  const firestore = getFirestore();
  let sourceAmountGhs = 0;
  let stripeCurrency = resolveStripeChargeCurrency({});

  try {
    const body =
      typeof req.body === "object" && req.body != null ? req.body : {};
    const existingSubscriptionId =
      typeof body.subscriptionId === "string" ? body.subscriptionId.trim() : "";

    if (existingSubscriptionId) {
      return await resumeStripeSubscriptionCheckout(res, firestore, existingSubscriptionId, body);
    }

    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!bookingId || !userId || !email) {
      return res.status(400).json({
        ok: false,
        error: "bookingId, userId, and email are required",
      });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ ok: false, error: "Booking not found" });
    }
    sourceAmountGhs = Number(body.amount ?? booking.totalPrice);
    if (!Number.isFinite(sourceAmountGhs) || sourceAmountGhs <= 0) {
      return res.status(400).json({ ok: false, error: "Valid GHS amount is required" });
    }

    const profileSnap = await firestore.collection(PROFILES_COLLECTION).doc(userId).get();
    const profile = (profileSnap.data() || {}) as Record<string, unknown>;
    stripeCurrency = resolveStripeChargeCurrency({
      requested: body.stripeCurrency,
      preferred: profile.preferredStripeCurrency,
      country: profile.country,
    });
    const snapshot = await buildStripePriceSnapshot(sourceAmountGhs, stripeCurrency);

    const validFrequencies: CollectionFrequency[] = ["weekly", "biweekly", "monthly"];
    const collectionFrequency = validFrequencies.includes(body.collectionFrequency)
      ? (body.collectionFrequency as CollectionFrequency)
      : "monthly";
    const collectionDay = String(body.collectionDay || "").trim();
    const billingDay = Math.min(28, Math.max(1, Math.floor(Number(body.billingDay) || 1)));
    const startRaw = typeof body.startDate === "string" ? body.startDate.trim() : "";

    let billingPeriodStart: Date;
    let nextBillingDate: Date;
    if (startRaw) {
      const anchor = parseStartDateIso(startRaw);
      anchor.setHours(0, 0, 0, 0);
      billingPeriodStart = anchor;
      nextBillingDate = addDaysDate(anchor, 28);
    } else {
      nextBillingDate = getNextBillingDate(billingDay);
      billingPeriodStart = new Date(
        nextBillingDate.getFullYear(),
        nextBillingDate.getMonth(),
        nextBillingDate.getDate()
      );
    }
    const billingPeriodEnd = getBillingPeriodEnd(billingPeriodStart);

    const itemsSnapshot = Array.isArray(body.items)
      ? body.items
          .map((i: any) => ({
            type: String(i.type ?? ""),
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            totalPrice: Number(i.totalPrice) || 0,
          }))
          .filter((i: { type: string }) => i.type)
      : undefined;
    const locationToStore =
      body.location != null && String(body.location).trim() !== ""
        ? String(body.location).trim()
        : undefined;

    const docRef = firestore.collection(SUBSCRIPTIONS_COLLECTION).doc();
    const subscriptionId = docRef.id;
    const now = new Date();
    const snapshotFields = stripePriceSnapshotFields(snapshot);
    await docRef.set({
      userId,
      email,
      paymentMethod: "card",
      source: "stripe",
      collectionFrequency,
      collectionDay,
      bookingId,
      amount: sourceAmountGhs,
      billingDay,
      nextBillingDate,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      ...snapshotFields,
      ...(startRaw
        ? { startDate: startRaw, subscriptionAnchorDate: billingPeriodStart }
        : {}),
      ...(itemsSnapshot?.length ? { items: itemsSnapshot } : {}),
      ...(locationToStore ? { location: locationToStore } : {}),
      ...(body.metadata && typeof body.metadata === "object"
        ? { metadata: body.metadata }
        : {}),
    });

    const session = await createSubscriptionSession({
      bookingId,
      userId,
      subscriptionId,
      email,
      snapshot,
      stripePriceId: null,
    });

    await persistCheckout(firestore, {
      session,
      userId,
      bookingId,
      subscriptionId,
      email,
      sourceAmountGhs,
      snapshot,
      billingPeriodStart,
      billingPeriodEnd,
      itemsSnapshot,
      locationToStore,
    });

    if (body.stripeCurrency) {
      await firestore.collection(PROFILES_COLLECTION).doc(userId).set(
        { preferredStripeCurrency: snapshot.stripeCurrency },
        { merge: true }
      );
    }

    return res.status(201).json({
      ok: true,
      authorizationUrl: session.url,
      reference: session.id,
      subscriptionId,
      sourceAmountGhs: snapshot.sourceAmountGhs,
      stripeCurrency: snapshot.stripeCurrency,
      finalStripeAmount: snapshot.finalStripeAmount,
      stripeSurchargePercent: snapshot.stripeSurchargePercent,
    });
  } catch (error: unknown) {
    const stripe = publicStripeError(error);
    const isFx = error instanceof StripeFxError;
    console.error("[stripe/subscribe] failed", {
      currency: stripeCurrency,
      sourceAmountGhs,
      mode: stripeKeyMode(),
      ...stripe,
    });
    return res.status(isFx ? 503 : 500).json({
      ok: false,
      error: stripe.message || "Failed to initialize Stripe subscription",
      stripe: { ...stripe, currency: stripeCurrency, mode: stripeKeyMode() },
    });
  }
}

async function resumeStripeSubscriptionCheckout(
  res: VercelResponse,
  firestore: Firestore,
  subscriptionId: string,
  body: Record<string, unknown>
) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({ ok: false, error: "Subscription not found" });
  }
  const sub = subscription as Record<string, unknown>;
  if (sub.status === "cancelled") {
    return res.status(400).json({ ok: false, error: "Subscription is cancelled" });
  }
  const userId = String(sub.userId || "");
  const email = String(sub.email || (await getUserEmail(userId)) || "");
  const bookingId = String(sub.bookingId || "");
  if (!userId || !email || !bookingId) {
    return res.status(400).json({ ok: false, error: "Subscription is missing user or booking" });
  }
  const sourceAmountGhs = Number(sub.amount);
  const locked = lockedSnapshotFromRecord(sub, sourceAmountGhs);
  const snapshot =
    locked ||
    (await buildStripePriceSnapshot(
      sourceAmountGhs,
      resolveStripeChargeCurrency({
        requested: body.stripeCurrency,
        preferred: sub.stripeCurrency,
      })
    ));

  const session = await createSubscriptionSession({
    bookingId,
    userId,
    subscriptionId,
    email,
    snapshot,
    stripePriceId: typeof sub.stripePriceId === "string" ? sub.stripePriceId : null,
  });

  const now = new Date();
  await persistCheckout(firestore, {
    session,
    userId,
    bookingId,
    subscriptionId,
    email,
    sourceAmountGhs,
    snapshot,
    billingPeriodStart: now,
    billingPeriodEnd: getBillingPeriodEnd(now),
  });

  return res.status(200).json({
    ok: true,
    authorizationUrl: session.url,
    reference: session.id,
    subscriptionId,
    reusedLockedPrice: Boolean(locked),
    sourceAmountGhs: snapshot.sourceAmountGhs,
    stripeCurrency: snapshot.stripeCurrency,
    finalStripeAmount: snapshot.finalStripeAmount,
  });
}

async function createSubscriptionSession(input: {
  bookingId: string;
  userId: string;
  subscriptionId: string;
  email: string;
  snapshot: StripePriceSnapshot;
  stripePriceId: string | null;
}) {
  const successUrl = `${CLIENT_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${CLIENT_APP_URL}/payment/cancel`;
  const session = await liveStripeApi.createCheckoutSession(
    buildSubscriptionCheckoutForm({
      bookingId: input.bookingId,
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      email: input.email,
      amountMinor: input.snapshot.stripeAmountMinor,
      currency: input.snapshot.stripeCurrency,
      successUrl,
      cancelUrl,
      stripePriceId: input.stripePriceId,
    }),
    `sub_checkout_${input.subscriptionId}_${input.snapshot.stripeCurrency}_${input.snapshot.stripeAmountMinor}`
  );
  if (!session?.id || !session.url) {
    throw new Error("Stripe did not return a subscription checkout URL");
  }
  return session;
}

async function persistCheckout(
  firestore: Firestore,
  input: {
    session: {
      id: string;
      url?: string | null;
      payment_intent?: unknown;
      subscription?: unknown;
      customer?: unknown;
      line_items?: unknown;
    };
    userId: string;
    bookingId: string;
    subscriptionId: string;
    email: string;
    sourceAmountGhs: number;
    snapshot: StripePriceSnapshot;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    itemsSnapshot?: unknown[];
    locationToStore?: string;
  }
) {
  const snapshotFields = stripePriceSnapshotFields(input.snapshot);
  const stripeSubId = subscriptionIdFromSession(input.session as any);
  const stripeCustomerId = customerIdFromSession(input.session as any);
  const stripePriceId = priceIdFromSession(input.session as any);

  await firestore.collection(PAYMENTS_COLLECTION).doc(input.session.id).set(
    {
      userId: input.userId,
      bookingId: input.bookingId,
      subscriptionId: input.subscriptionId,
      type: "subscription",
      amount: input.sourceAmountGhs,
      currency: "GHS",
      ...snapshotFields,
      reference: input.session.id,
      status: "initialized",
      paymentMethod: "card",
      source: "stripe",
      fulfillmentStatus: "pending",
      stripeCheckoutSessionId: input.session.id,
      email: input.email,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      ...(input.itemsSnapshot?.length ? { items: input.itemsSnapshot } : {}),
      ...(input.locationToStore ? { location: input.locationToStore } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await firestore.collection(SUBSCRIPTIONS_COLLECTION).doc(input.subscriptionId).set(
    {
      reference: input.session.id,
      payment: { status: "initiated", reference: input.session.id, source: "stripe" },
      currentPaymentReference: input.session.id,
      stripeCheckoutSessionId: input.session.id,
      ...(stripeSubId ? { stripeSubscriptionId: stripeSubId } : {}),
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      ...(stripePriceId ? { stripePriceId } : {}),
      ...snapshotFields,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await firestore.collection("bookings").doc(input.bookingId).set(
    {
      subscriptionId: input.subscriptionId,
      payment: {
        status: "initiated",
        source: "stripe",
        reference: input.session.id,
        authorizationUrl: input.session.url,
        amount: input.sourceAmountGhs,
        ...snapshotFields,
        initiatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
}
