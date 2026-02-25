/**
 * POST /api/jobs/complete
 * Body: { jobId: string, driverId: string }
 * Update job: jobStatus = "completed", completedAt = now, completedBy = driverId.
 * Increment totalJobsCompleted on today's driverShift.
 * Not allowed if paymentStatus !== "paid" or assignedTo !== driverId.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";

const JOBS_COLLECTION = "jobs";
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
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : null;
    const driverId = typeof body.driverId === "string" ? body.driverId.trim() : null;

    if (!jobId) {
      return res.status(400).json({ error: "Missing required field: jobId" });
    }
    if (!driverId) {
      return res.status(400).json({ error: "Missing required field: driverId" });
    }

    const firestore = getFirestore();
    const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
    const snapshot = await jobRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const data = snapshot.data();
    if (data?.paymentStatus !== "paid") {
      return res.status(400).json({
        error: "Cannot complete job. Payment status must be 'paid'.",
      });
    }
    if (data?.assignedTo !== driverId) {
      return res.status(403).json({
        error: "Not allowed to complete this job. It is assigned to another driver.",
      });
    }

    const now = firestore.Timestamp.now();
    const date = todayUtcYYYYMMDD();
    const shiftId = `${driverId}_${date}`;
    const shiftRef = firestore.collection(DRIVER_SHIFTS_COLLECTION).doc(shiftId);

    await firestore.runTransaction(async (tx) => {
      tx.update(jobRef, {
        jobStatus: "completed",
        completedAt: now,
        completedBy: driverId,
        updatedAt: now,
      });
      tx.set(
        shiftRef,
        {
          totalJobsCompleted: firestore.FieldValue.increment(1),
          updatedAt: now,
        },
        { merge: true }
      );
    });

    const updated = await jobRef.get();
    const u = updated.data();
    return res.status(200).json({
      id: jobRef.id,
      jobStatus: "completed",
      completedAt: u?.completedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      completedBy: driverId,
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/complete] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
