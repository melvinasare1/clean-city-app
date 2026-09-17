import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StripeFxError } from "../lib/stripe-fx";
import { resolveStripeChargeCurrency } from "../lib/stripe-currency";
import {
  buildStripePriceSnapshot,
  stripeQuoteResponseFields,
} from "../lib/stripe-pricing";
import { rejectDisabledStripePayments } from "../lib/stripe-payments-enabled";
import { isStripeCardAvailable } from "../lib/stripe-threshold";

/**
 * GET /api/stripe/quote?amountGhs=141&currency=GBP
 * Firebase FX + 2% surcharge preview. Does not create a Stripe object.
 * The quoted amount is display-only; initialize/subscribe recalculate.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (rejectDisabledStripePayments(res)) return;

  try {
    const body =
      typeof req.body === "object" && req.body != null ? req.body : {};
    const amountRaw =
      (typeof req.query.amountGhs === "string" ? req.query.amountGhs : "") ||
      (typeof body.amountGhs === "number" ? String(body.amountGhs) : "") ||
      (typeof body.amount === "number" ? String(body.amount) : "");
    const amountGhs = Number(amountRaw);
    if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
      return res.status(400).json({ ok: false, error: "amountGhs is required" });
    }

    const currency = resolveStripeChargeCurrency({
      requested: req.query.currency || body.stripeCurrency || body.currency,
    });
    const snapshot = await buildStripePriceSnapshot(amountGhs, currency);
    return res.status(200).json({
      ok: true,
      stripeAvailable: isStripeCardAvailable(amountGhs),
      ...stripeQuoteResponseFields(snapshot),
    });
  } catch (error: unknown) {
    const message =
      error instanceof StripeFxError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to quote Stripe amount";
    return res.status(error instanceof StripeFxError ? 503 : 500).json({
      ok: false,
      error: message,
    });
  }
}
