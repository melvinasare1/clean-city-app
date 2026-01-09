import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";

interface InitializeRequest {
  email: string;
  amount: number; // in app currency units (e.g. GHS)
  metadata?: Record<string, any>;
  callback_url?: string;
}

/**
 * POST /api/paystack/initialize
 * Initialize a Paystack transaction
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      error: "Server configuration error",
      message: "PAYSTACK_SECRET_KEY not configured",
    });
  }

  try {
    const body = req.body as InitializeRequest;
    const { email, amount, metadata, callback_url } = body;

    // Validate required fields
    if (!email || typeof amount !== "number" || isNaN(amount)) {
      return res.status(400).json({
        error: "email and amount are required (amount must be a valid number)",
      });
    }

    // Convert amount to smallest currency unit (kobo for NGN, pesewas for GHS, etc.)
    const updatedAmount = amount * 100;
    console.log("amountInSmallestUnit", updatedAmount);
    // Call Paystack API
    const paystackResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: updatedAmount,
          metadata,
          callback_url: callback_url || `${CLIENT_APP_URL}/payment/success`,
        }),
      }
    );

    const data = await paystackResponse.json();

    if (!paystackResponse.ok || !data.status) {
      console.error("Paystack initialize error:", data);
      return res.status(paystackResponse.status || 500).json({
        error: "Failed to initialize transaction",
        details: data.message || "Unknown error",
      });
    }

    const authData = data.data;

    return res.status(201).json({
      authorization_url: authData.authorization_url,
      access_code: authData.access_code,
      reference: authData.reference,
    });
  } catch (error: any) {
    console.error("Error initializing Paystack transaction:", error?.message);
    return res.status(500).json({
      error: "Failed to initialize transaction",
      details: error?.message || "Unknown error",
    });
  }
}
