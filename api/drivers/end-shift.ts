/**
 * POST /api/drivers/end-shift
 * Body: { driverId: string }
 * Find today's shift; set shiftEndedAt = now. Return updated shift.
 * Validates driver exists in drivers collection (or profiles) and isActive === true.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { getDriverDoc } from "../lib/collections";

const DRIVER_SHIFTS_COLLECTION = "driverShifts";

function todayUtcYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const driverId = typeof body.driverId === "string" ? body.driverId.trim() : null;

    if (!driverId) {
      return res.status(400).json({ error: "Missing required field: driverId" });
    }

    const firestore = getFirestore();
    const driver = await getDriverDoc(firestore, driverId);
    if (!driver.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }
    if (!driver.isActive) {
      return res.status(400).json({ error: "Cannot end shift: driver is inactive." });
    }
    const date = todayUtcYYYYMMDD();
    const docId = `${driverId}_${date}`;
    const ref = firestore.collection(DRIVER_SHIFTS_COLLECTION).doc(docId);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "No shift found for today. Start a shift first." });
    }

    const now = firestore.Timestamp.now();
    await ref.update({
      shiftEndedAt: now,
      updatedAt: now,
    });

    const updated = await ref.get();
    const d = updated.data();
    return res.status(200).json({
      id: ref.id,
      driverId: d?.driverId ?? driverId,
      date: d?.date ?? date,
      shiftStartedAt: d?.shiftStartedAt?.toDate?.()?.toISOString() ?? null,
      shiftEndedAt: d?.shiftEndedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      totalJobsCompleted: d?.totalJobsCompleted ?? 0,
    });
  } catch (error: unknown) {
    console.error("[POST /api/drivers/end-shift] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
