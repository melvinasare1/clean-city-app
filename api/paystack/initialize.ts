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

    // Call Paystack API
    console.log("[Backend Init] 🚀 Calling Paystack API...");
    console.log("[Backend Init] Amount:", amount, "Email:", email);
    
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
          amount,
          metadata,
          callback_url: callback_url || `${CLIENT_APP_URL}/payment/success`,
        }),
      }
    );

    const text = await paystackResponse.text();
    console.log("[Backend Init] Paystack status:", paystackResponse.status);
    console.log("[Backend Init] Paystack raw response:", text.slice(0, 300));

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("[Backend Init] ❌ Paystack returned non-JSON:", e);
      return res.status(500).json({
        error: "Invalid response from payment provider",
        details: text.slice(0, 200),
      });
    }

    console.log("[Backend Init] Paystack parsed response:", data);

    if (!paystackResponse.ok || !data.status) {
      console.error("[Backend Init] ❌ Paystack error response:", data);
      return res.status(paystackResponse.status || 500).json({
        error: "Failed to initialize transaction",
        details: data.message || "Unknown error",
      });
    }

    const authData = data.data;
    console.log("[Backend Init] authData:", authData);
    console.log("[Backend Init] authorization_url:", authData?.authorization_url);
    console.log("[Backend Init] reference:", authData?.reference);

    const response = {
      authorization_url: authData.authorization_url,
      access_code: authData.access_code,
      reference: authData.reference,
    };
    
    console.log("[Backend Init] ✅ Returning to frontend:", response);
    return res.status(201).json(response);
  } catch (error: any) {
    console.error("Error initializing Paystack transaction:", error?.message);
    return res.status(500).json({
      error: "Failed to initialize transaction",
      details: error?.message || "Unknown error",
    });
  }
}
