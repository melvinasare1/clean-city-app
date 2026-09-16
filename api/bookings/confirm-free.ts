/**
 * POST /api/bookings/confirm-free
 * Body: { bookingId: string }
 *
 * Confirms a free (totalPrice === 0) booking immediately:
 * - Marks booking as paid and confirmed
 * - Creates the job in the jobs collection
 * No Paystack flow; used when user selects only the complimentary/free product.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { admin, getFirestore } from "../lib/firebase-admin";
import { getBookingById } from "../paystack/bookings";
import { fulfillPaidOneTimeBooking } from "../lib/payment-fulfillment";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : null;

    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        error: "bookingId is required",
      });
    }

    const firestore = getFirestore();
    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        ok: false,
        error: "Booking not found",
      });
    }

    const totalPrice = Number(booking.totalPrice);
    if (totalPrice !== 0) {
      return res.status(400).json({
        ok: false,
        error: "Only free bookings (totalPrice 0) can be confirmed via this endpoint",
      });
    }

    const result = await fulfillPaidOneTimeBooking(firestore, {
      bookingId,
      source: "free",
      Timestamp: admin.firestore.Timestamp,
    });

    return res.status(200).json({
      ok: true,
      alreadyConfirmed: result.alreadyFulfilled,
      jobId: result.jobId || undefined,
    });
  } catch (error: any) {
    console.error("[confirm-free] Error:", error?.message);
    return res.status(500).json({
      ok: false,
      error: error?.message ?? "Failed to confirm free booking",
    });
  }
}
