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
import { getFirestore } from "../lib/firebase-admin";
import { getBookingById } from "../paystack/bookings";
import {
  createJobForOneTimeBooking,
  toDate,
} from "../paystack/subscription-helpers";
import type {
  JobAddressSnapshot,
  JobItemSnapshot,
} from "../paystack/payment-and-job-types";

const JOBS_COLLECTION = "jobs";

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

    // Already confirmed?
    if (booking.payment?.status === "paid") {
      return res.status(200).json({ ok: true, alreadyConfirmed: true });
    }

    const Timestamp = firestore.Timestamp;

    // 1. Mark booking as paid and confirmed
    await firestore
      .collection("bookings")
      .doc(bookingId)
      .set(
        {
          payment: {
            status: "paid",
            paidAt: Timestamp.now(),
          },
          status: "confirmed",
        },
        { merge: true }
      );

    // 2. Create job (same shape as verify.ts for one-time bookings)
    const existingJob = await firestore
      .collection(JOBS_COLLECTION)
      .where("bookingId", "==", bookingId)
      .limit(1)
      .get();

    if (existingJob.empty) {
      const items: JobItemSnapshot[] = Array.isArray(booking.items)
        ? (booking.items as any[]).map((i: any, idx: number) => ({
            id:
              i?.id ??
              (i?.type
                ? String(i.type).replace(/\s+/g, "_").toUpperCase()
                : `ITEM_${idx}`),
            type: String(i?.type ?? ""),
            quantity: Number(i?.quantity) ?? 0,
            unitPrice: Number(i?.unitPrice) ?? 0,
            totalPrice: Number(i?.totalPrice) ?? 0,
          })).filter((i) => i.type)
        : [];
      const loc =
        (booking as any).location != null ? String((booking as any).location) : "";
      const meta =
        (booking as any).metadata && typeof (booking as any).metadata === "object"
          ? (booking as any).metadata
          : {};
      const addressSnapshot: JobAddressSnapshot = {
        addressLine1:
          meta?.addressLine1 ?? (booking as any).addressLine1 ?? loc ?? "",
        area: meta?.area ?? (booking as any).area ?? "",
        phoneNumber: meta?.phoneNumber ?? (booking as any).phoneNumber ?? "",
      };
      const bookingDate = (booking as any).date;
      const scheduledDate = bookingDate
        ? (typeof bookingDate === "string"
            ? new Date(bookingDate)
            : toDate(bookingDate) ?? new Date())
        : new Date();

      await createJobForOneTimeBooking(firestore, {
        bookingId,
        userId: booking.userId,
        scheduledDate,
        items,
        location: loc,
        addressSnapshot,
        windowId: (booking as any).windowId ?? "morning",
        windowLabel: (booking as any).windowLabel ?? "",
        Timestamp: Timestamp as any,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[confirm-free] Error:", error?.message);
    return res.status(500).json({
      ok: false,
      error: error?.message ?? "Failed to confirm free booking",
    });
  }
}
