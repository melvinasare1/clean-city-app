import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBookingById, getUserEmail } from "./bookings";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:19006";

interface InitializeRequest {
  bookingId: string;
}

/**
 * POST /api/paystack/initialize
 * Simplified: accepts only { bookingId }, looks up booking and user details.
 * Returns: { ok: true, authorizationUrl, reference }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Server configuration error",
      message: "PAYSTACK_SECRET_KEY not configured",
    });
  }

  try {
    const body = req.body as InitializeRequest;
    const { bookingId } = body;

    // Validate required field
    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        error: "bookingId is required",
      });
    }

    // Look up the booking
    console.log("[Backend Init] Looking up booking:", bookingId);
    const booking = await getBookingById(bookingId);
    if (!booking) {
      console.error("[Backend Init] ❌ Booking not found:", bookingId);
      return res.status(404).json({
        ok: false,
        error: "Booking not found",
      });
    }
    console.log("[Backend Init] ✅ Booking found. UserId:", booking.userId, "TotalPrice:", booking.totalPrice);

    // Check if already paid
    if (booking.payment?.status === "paid") {
      console.warn("[Backend Init] ⚠️ Booking already paid:", bookingId);
      return res.status(400).json({
        ok: false,
        error: "Booking is already paid",
      });
    }

    // Look up user email (with booking fallback)
    console.log("[Backend Init] Looking up user email for userId:", booking.userId);
    const email = await getUserEmail(booking.userId, booking);
    if (!email) {
      console.error("[Backend Init] ❌ No email found for user:", booking.userId);
      console.error("[Backend Init] Checked: Firebase Auth and booking.userEmail");
      return res.status(400).json({
        ok: false,
        error: "User email not found. Please ensure the user has an email address in their profile.",
        details: "Email is required by Paystack to process payments.",
      });
    }
    console.log("[Backend Init] ✅ Email found:", email);

    const amount = booking.totalPrice;
    const metadata = {
      userId: booking.userId,
      bookingId: bookingId,
    };

    // Call Paystack API
    console.log("[Backend Init] 🚀 Calling Paystack API...");
    console.log("[Backend Init] BookingId:", bookingId, "Amount:", amount, "Email:", email);
    
    // Convert amount to pesewas (GHS * 100)
    const amountInPesewas = Math.round(amount * 100);
    
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
          amount: amountInPesewas,
          metadata,
          callback_url: `${CLIENT_APP_URL}/payment/success`,
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
        ok: false,
        error: "Failed to initialize transaction",
        details: data.message || "Unknown error",
      });
    }

    const authData = data.data;
    console.log("[Backend Init] authData:", authData);
    console.log("[Backend Init] authorization_url:", authData?.authorization_url);
    console.log("[Backend Init] reference:", authData?.reference);

    const response = {
      ok: true,
      authorizationUrl: authData.authorization_url,
      reference: authData.reference,
    };
    
    console.log("[Backend Init] ✅ Returning to frontend:", response);
    return res.status(201).json(response);
  } catch (error: any) {
    console.error("Error initializing Paystack transaction:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize transaction",
      details: error?.message || "Unknown error",
    });
  }
}
