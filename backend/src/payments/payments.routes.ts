import express, { Request, Response, Router } from "express";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
  handlePaystackWebhookEvent,
} from "./paystack.service";
import type {
  InitializeTransactionBody,
  InitializeTransactionResponse,
} from "./paystack.types";
import { getBookingById } from "./bookings.repository";
import { getUserEmail } from "./users.repository";

export const paymentsRouter = Router();

/**
 * POST /api/payments/initialize
 * Simplified: accepts only { bookingId }, looks up booking and user details.
 * Returns: { ok: true, authorizationUrl, reference }
 */
paymentsRouter.post("/initialize", async (req, res) => {
  try {
    const { bookingId } = req.body;

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
    const userEmail = await getUserEmail(booking.userId, booking);
    if (!userEmail) {
      console.error("[Backend Init] ❌ No email found for user:", booking.userId);
      console.error("[Backend Init] Checked: Firebase Auth and booking.userEmail");
      return res.status(400).json({
        ok: false,
        error: "User email not found. Please ensure the user has an email address in their profile.",
        details: "Email is required by Paystack to process payments.",
      });
    }
    console.log("[Backend Init] ✅ Email found:", userEmail);

    // Initialize Paystack transaction
    const result = await initializePaystackTransaction({
      email: userEmail,
      amount: booking.totalPrice,
      metadata: {
        userId: booking.userId,
        bookingId: bookingId,
      },
    });

    // Return simplified response with ok flag
    return res.status(201).json({
      ok: true,
      authorizationUrl: result.authorization_url,
      reference: result.reference,
    });
  } catch (error: any) {
    console.error("Error initializing Paystack transaction:", error?.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize transaction",
      details: error?.message,
    });
  }
});


/**
 * GET /api/payments/verify?reference=...
 */
paymentsRouter.get("/verify", async (req: Request, res: Response) => {
  try {
    const reference = req.query.reference as string | undefined;
    if (!reference) {
      return res
        .status(400)
        .json({ error: "reference query param is required" });
    }

    const result = await verifyPaystackTransaction(reference);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error verifying Paystack transaction:", error?.message);
    return res.status(500).json({
      error: "Failed to verify transaction",
      details: error?.message,
    });
  }
});

/**
 * Webhook: POST /api/payments/webhook
 * Note: this handler expects raw body (configured in index.ts).
 */
export const paystackWebhookHandler = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-paystack-signature"] as
      | string
      | undefined;

    const rawBody = req.body as Buffer;
    const event = verifyPaystackWebhookSignature(rawBody, signature);

    if (!event) {
      return res.status(400).json({ error: "Invalid signature or payload" });
    }

    await handlePaystackWebhookEvent(event);

    return res.sendStatus(200);
  } catch (error: any) {
    console.error("Error handling Paystack webhook:", error?.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};


