import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * GET /api/paystack/verify?reference=...
 * POST /api/paystack/verify (with body.reference)
 *
 * Verify a Paystack transaction
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      error: "Server configuration error",
      message: "PAYSTACK_SECRET_KEY not configured",
    });
  }

  try {
    // Get reference from query or body
    const reference =
      (req.query.reference as string | undefined) ||
      (req.body?.reference as string | undefined);

    if (!reference) {
      return res.status(400).json({
        error: "reference query param or body.reference is required",
      });
    }

    // Call Paystack API
    const paystackResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await paystackResponse.json();

    if (!paystackResponse.ok || !data.status) {
      console.error("Paystack verify error:", data);
      return res.status(paystackResponse.status || 500).json({
        error: "Failed to verify transaction",
        details: data.message || "Unknown error",
      });
    }

    const paystackData = data.data;

    console.log("paystackData", paystackData.amount);
    // Normalize response
    const status = (paystackData.status || "failed") as
      | "success"
      | "failed"
      | "abandoned"
      | "pending";

    return res.status(200).json({
      status,
      reference: paystackData.reference,
      amount: paystackData.amount, // convert from smallest unit
      currency: paystackData.currency,
      statusMessage: paystackData.gateway_response,
      metadata: paystackData.metadata,
      rawPaystack: data,
    });
  } catch (error: any) {
    console.error("Error verifying Paystack transaction:", error?.message);
    return res.status(500).json({
      error: "Failed to verify transaction",
      details: error?.message || "Unknown error",
    });
  }
}
