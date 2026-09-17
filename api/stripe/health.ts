import type { VercelRequest, VercelResponse } from "@vercel/node";
import { publicStripeError, retrieveStripeAccount, stripeKeyMode } from "../lib/stripe-api";
import { resolveStripeChargeCurrency } from "../lib/stripe-currency";
import { StripeFxError } from "../lib/stripe-fx";
import { buildStripePriceSnapshot } from "../lib/stripe-pricing";

/**
 * GET /api/stripe/health
 * Account probe plus a Firebase FX quote for GHS 141. Does not create Checkout Sessions.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      ok: false,
      error: "STRIPE_SECRET_KEY not configured",
      mode: stripeKeyMode(),
    });
  }
  try {
    const account = await retrieveStripeAccount();
    const currency = resolveStripeChargeCurrency({
      requested: req.query.currency,
      country: account.country,
    });
    const payload: Record<string, unknown> = {
      ok: true,
      mode: stripeKeyMode(),
      account,
      presentationCurrency: currency,
    };
    try {
      payload.ghs141_quote = await buildStripePriceSnapshot(141, currency);
    } catch (error: unknown) {
      payload.ok = false;
      payload.fx_error =
        error instanceof StripeFxError ? error.message : publicStripeError(error);
    }
    return res.status(payload.ok === false ? 500 : 200).json(payload);
  } catch (error: unknown) {
    const stripe = publicStripeError(error);
    console.error("[stripe/health] failed", stripe);
    return res.status(500).json({
      ok: false,
      mode: stripeKeyMode(),
      stripe,
    });
  }
}
