import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue, getFirestore } from "../lib/firebase-admin";
import { fulfillPaidOneTimeBooking } from "../lib/payment-fulfillment";
import { webhookHttpStatus } from "../lib/payment-integrity";
import { liveStripeApi } from "../lib/stripe-api";
import { processStripeWebhookEvent } from "../lib/stripe-webhook-process";
import {
  isValidStripeSignature,
  rawBodyForStripeSignature,
} from "../lib/stripe-signature";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (Buffer.isBuffer(req.body)) return req.body;
  const raw = (req as VercelRequest & { rawBody?: unknown }).rawBody;
  if (typeof raw === "string") return Buffer.from(raw, "utf8");
  if (Buffer.isBuffer(raw)) return raw;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length) return Buffer.concat(chunks);
  return rawBodyForStripeSignature(req.body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) {
    return res.status(400).json({ error: "Missing Stripe-Signature header" });
  }

  const rawBody = await readRawBody(req);
  if (!isValidStripeSignature(webhookSecret, rawBody, signature)) {
    console.error("Invalid Stripe webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  if (!event?.type) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  console.log(`Stripe webhook event: ${event.type}`, {
    sessionId: event?.data?.object?.id,
    paymentStatus: event?.data?.object?.payment_status,
  });

  try {
    const result = await processStripeWebhookEvent(event, {
      stripe: liveStripeApi,
      firestore: getFirestore(),
      fulfill: fulfillPaidOneTimeBooking,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    });
    const status = webhookHttpStatus(result);
    if (!result.ok) {
      console.error("Stripe webhook processing failed (will retry):", result.error);
      return res.status(status).json({ error: result.error, retry: true });
    }
    return res.status(200).json({ received: true, duplicate: result.duplicate });
  } catch (error: any) {
    console.error("Error handling Stripe webhook:", error?.message);
    return res.status(500).json({
      error: "Internal server error",
      details: error?.message || "Unknown error",
    });
  }
}
