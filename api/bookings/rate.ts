/**
 * POST /api/bookings/rate
 * Body: { bookingId: string, stars: number (1-5), comment?: string }
 * Auth: Firebase ID token in Authorization: Bearer <token>.
 * Records the customer's rating on the booking and recomputes the
 * attributed driver's running average rating. One rating per booking.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { parseRequestBody } from "../lib/parse-request-body";
import { verifyAuthHeader } from "../lib/verify-auth";

function parseStars(value: unknown): number | null {
  const stars = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  return stars;
}

function parseComment(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return res.status(401).json({ error: "Sign in required" });
    }

    const body = parseRequestBody(req);
    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : null;
    const stars = parseStars(body.stars);
    const comment = parseComment(body.comment);

    if (!bookingId) {
      return res.status(400).json({ error: "Missing required field: bookingId" });
    }
    if (stars === null) {
      return res.status(400).json({ error: "stars must be an integer between 1 and 5" });
    }

    const firestore = getFirestore();
    const bookingRef = firestore.collection("bookings").doc(bookingId);
    const now = firestore.Timestamp.now();

    await firestore.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) {
        throw new Error("not_found:Booking not found");
      }
      const booking = bookingSnap.data() || {};
      if (booking.userId !== uid) {
        throw new Error("forbidden:This booking is not yours");
      }
      if (booking.status !== "completed") {
        throw new Error("failed_precondition:This booking is not completed yet");
      }
      if (booking.customerRating) {
        throw new Error("failed_precondition:This booking has already been rated");
      }
      const driverId = typeof booking.driverId === "string" ? booking.driverId : null;
      if (!driverId) {
        throw new Error("failed_precondition:No driver is attributed to this booking");
      }

      const driverRef = firestore.collection("drivers").doc(driverId);
      const driverSnap = await tx.get(driverRef);
      if (!driverSnap.exists) {
        throw new Error("not_found:Driver not found");
      }
      const driver = driverSnap.data() || {};
      const currentRating = typeof driver.rating === "number" ? driver.rating : 0;
      const currentCount = typeof driver.ratingCount === "number" ? driver.ratingCount : 0;
      const newCount = currentCount + 1;
      const newRating = (currentRating * currentCount + stars) / newCount;

      tx.set(
        bookingRef,
        {
          customerRating: { stars, comment, ratedAt: now },
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        driverRef,
        {
          rating: newRating,
          ratingCount: newCount,
          updatedAt: now,
        },
        { merge: true }
      );
    });

    return res.status(200).json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const [code, detail] = message.includes(":") ? message.split(":", 2) : ["server_error", message];
    if (code === "not_found") return res.status(404).json({ error: detail });
    if (code === "forbidden") return res.status(403).json({ error: detail });
    if (code === "failed_precondition") return res.status(400).json({ error: detail });

    console.error("[POST /api/bookings/rate] Error:", error);
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
