/**
 * POST /api/drivers/start-shift
 * Body: { driverId: string }
 * Find or create driverShift for today; set shiftStartedAt = now. Return shift document.
 * Validates driver exists in drivers collection with status approved.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { requireApprovedDriver, sendAuthFailure, sendPublicError } from "../lib/request-auth";

const DRIVER_SHIFTS_COLLECTION = "driverShifts";

function todayUtcYYYYMMDD(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const actor = await requireApprovedDriver(req);
    if (!actor.ok) {
      return sendAuthFailure(res, actor);
    }
    const driverId = actor.uid;

    const firestore = getFirestore();
    const date = todayUtcYYYYMMDD();
    const docId = `${driverId}_${date}`;
    const ref = firestore.collection(DRIVER_SHIFTS_COLLECTION).doc(docId);
    const now = firestore.Timestamp.now();

    const existing = await ref.get();
    if (existing.exists) {
      const data = existing.data();
      if (data?.shiftStartedAt) {
        return res.status(200).json({
          id: ref.id,
          driverId: data.driverId ?? driverId,
          date: data.date ?? date,
          shiftStartedAt: data.shiftStartedAt?.toDate?.()?.toISOString() ?? null,
          shiftEndedAt: data.shiftEndedAt?.toDate?.()?.toISOString() ?? null,
          totalJobsCompleted: data.totalJobsCompleted ?? 0,
        });
      }
      await ref.update({
        shiftStartedAt: now,
        updatedAt: now,
      });
    } else {
      await ref.set({
        driverId,
        date,
        shiftStartedAt: now,
        totalJobsCompleted: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const updated = await ref.get();
    const d = updated.data();
    return res.status(200).json({
      id: ref.id,
      driverId: d?.driverId ?? driverId,
      date: d?.date ?? date,
      shiftStartedAt: d?.shiftStartedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      shiftEndedAt: d?.shiftEndedAt?.toDate?.()?.toISOString() ?? null,
      totalJobsCompleted: d?.totalJobsCompleted ?? 0,
    });
  } catch (error: unknown) {
    console.error("[POST /api/drivers/start-shift] Error:", error);
    return sendPublicError(res, 500, "Internal server error");
  }
}
