/**
 * POST /api/bookings/mark-paid
 * Body: { bookingId: string }
 *
 * Explicit admin operational action: mark a booking paid and ensure the
 * operational job exists. Separate from the Paystack customer/webhook path.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { admin, getFirestore } from "../lib/firebase-admin";
import { parseRequestBody } from "../lib/parse-request-body";
import { requireStaff, sendAuthFailure } from "../lib/request-auth";
import { fulfillPaidOneTimeBooking } from "../lib/payment-fulfillment";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const staff = await requireStaff(req, "admin_only");
  if (!staff.ok) {
    return sendAuthFailure(res, staff);
  }

  const body = parseRequestBody(req);
  const bookingId =
    typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId) {
    return res.status(400).json({ ok: false, error: "bookingId is required" });
  }

  try {
    const firestore = getFirestore();
    const result = await fulfillPaidOneTimeBooking(firestore, {
      bookingId,
      source: "admin",
      Timestamp: admin.firestore.Timestamp,
    });
    return res.status(200).json({
      ok: true,
      bookingId,
      jobId: result.jobId,
      created: result.created,
      alreadyFulfilled: result.alreadyFulfilled,
      source: "admin",
    });
  } catch (error: any) {
    console.error("[mark-paid] Error:", error?.message);
    return res.status(500).json({
      ok: false,
      error: error?.message ?? "Failed to mark booking paid",
    });
  }
}
