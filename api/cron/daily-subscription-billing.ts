/**
 * Daily subscription billing job (MoMo only, internal recurring) + payment_due reminders.
 * Invoked by Vercel Cron; secure with CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
 *
 * 1) status === "active" AND today === nextBillingDate (billing day):
 *    - Call Paystack transaction/initialize with channels: ["mobile_money"]
 *    - Set status = payment_due, paymentDueSince = now, currentPaymentReference
 *    - Send push with payment link
 *
 * 2) status === payment_due:
 *    - Day 3: send reminder
 *    - Day 7: set status = overdue
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import { getUserEmail } from "../paystack/bookings";
import {
  toDate,
  isBillingDayToday,
  shouldSendReminderToday,
  shouldMarkOverdueToday,
  initializeManualPayment,
  getBillingPeriodEnd,
} from "../paystack/subscription-helpers";
import type { SubscriptionDocument } from "../paystack/subscription-types";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "https://clean-city-app.vercel.app";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error("Firebase init failed:", e);
  }
}

function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}

function isAuthorized(req: VercelRequest): boolean {
  const secret = getCronSecret();
  if (!secret) return true; // no secret configured => allow (dev)
  const auth = req.headers.authorization;
  return auth === `Bearer ${secret}`;
}

async function getPushToken(userId: string): Promise<string | null> {
  if (!admin.apps.length) return null;
  const snap = await admin.firestore().doc(`profiles/${userId}`).get();
  const token = snap.data()?.expoPushToken;
  return typeof token === "string" ? token : null;
}

async function sendPush(to: string, title: string, body: string, data?: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to, sound: "default", title, body, data: data || {} }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const receipt = Array.isArray(json.data) ? json.data[0] : json.data;
    return receipt?.status !== "error";
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: "Firebase not configured" });
  }
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: "Paystack not configured" });
  }

  const firestore = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const now = new Date();
  const today = now;
  const results = { manualBilling: 0, reminders: 0, overdue: 0, errors: [] as string[] };

  try {
    // --- 1) Active subscriptions due today (billing day): generate MoMo link, set payment_due, notify ---
    const activeSnap = await firestore
      .collection(SUBSCRIPTIONS_COLLECTION)
      .where("status", "==", "active")
      .get();

    for (const doc of activeSnap.docs) {
      const sub = { id: doc.id, ...doc.data() } as SubscriptionDocument;
      const nextBilling = toDate(sub.nextBillingDate);
      if (!isBillingDayToday(nextBilling, today)) continue;

      const email = sub.email || (await getUserEmail(sub.userId));
      if (!email) {
        results.errors.push(`Subscription ${sub.id}: no email`);
        continue;
      }

      try {
        const periodStart = nextBilling
          ? new Date(nextBilling.getFullYear(), nextBilling.getMonth(), nextBilling.getDate())
          : new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const periodEnd = getBillingPeriodEnd(periodStart);
        const { authorizationUrl, reference } = await initializeManualPayment({
          secretKey: PAYSTACK_SECRET_KEY,
          email,
          amountGhs: sub.amount,
          subscriptionId: sub.id,
          userId: sub.userId,
          callbackUrl: `${CLIENT_APP_URL}/payment/success`,
          collectionFrequency: sub.collectionFrequency ?? "monthly",
          billingDay: sub.billingDay ?? 1,
          billingPeriodStart: periodStart.toISOString(),
          billingPeriodEnd: periodEnd.toISOString(),
        });

        const subRef = firestore.collection(SUBSCRIPTIONS_COLLECTION).doc(sub.id);
        await subRef.set(
          {
            status: "payment_due",
            paymentDueSince: FieldValue.serverTimestamp(),
            currentPaymentReference: reference,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const pushToken = await getPushToken(sub.userId);
        if (pushToken) {
          await sendPush(
            pushToken,
            "Subscription payment due",
            `Your monthly payment of GHS ${sub.amount} is due. Pay now to avoid interruption.`,
            { type: "subscription_payment_due", subscriptionId: sub.id, paymentUrl: authorizationUrl }
          );
        }
        results.manualBilling++;
      } catch (e: any) {
        results.errors.push(`Subscription ${sub.id}: ${e?.message || String(e)}`);
      }
    }

    // --- 2) payment_due: Day 3 reminder, Day 7+ mark overdue ---
    const paymentDueSnap = await firestore
      .collection(SUBSCRIPTIONS_COLLECTION)
      .where("status", "==", "payment_due")
      .get();

    for (const doc of paymentDueSnap.docs) {
      const sub = { id: doc.id, ...doc.data() } as SubscriptionDocument;
      const paymentDueSince = toDate(sub.paymentDueSince);

      if (shouldMarkOverdueToday(paymentDueSince, today)) {
        try {
          await firestore.collection(SUBSCRIPTIONS_COLLECTION).doc(sub.id).set(
            { status: "overdue", updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          results.overdue++;
        } catch (e: any) {
          results.errors.push(`Overdue ${sub.id}: ${e?.message || String(e)}`);
        }
        continue;
      }

      if (shouldSendReminderToday(paymentDueSince, today)) {
        const pushToken = await getPushToken(sub.userId);
        if (pushToken) {
          const paymentUrl = sub.currentPaymentReference
            ? `${CLIENT_APP_URL}/payment?ref=${sub.currentPaymentReference}`
            : `${CLIENT_APP_URL}/subscription/${sub.id}/pay`;
          await sendPush(
            pushToken,
            "Reminder: subscription payment due",
            `Please complete your payment of GHS ${sub.amount} to keep your subscription active.`,
            { type: "subscription_reminder", subscriptionId: sub.id }
          );
          results.reminders++;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      date: today.toISOString(),
      ...results,
    });
  } catch (error: any) {
    console.error("daily-subscription-billing error:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Internal server error",
      ...results,
    });
  }
}
