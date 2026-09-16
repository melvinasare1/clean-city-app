/**
 * POST /api/jobs/missed
 * Body: { jobId, driverId, reason, note?, photoUrl? }
 * Marks an in-progress job as missed (unable to collect). Does not complete the job
 * and does not create earnings. Syncs the linked booking to status "missed".
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { getDriverDoc } from "../lib/collections";
import {
  bookingStatusForMissedJob,
  canMarkJobMissed,
  parseMissedPickupInput,
  serializeCompletionOutcome,
} from "../lib/job-outcome";

const JOBS_COLLECTION = "jobs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const parsed = parseMissedPickupInput(body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message });
    }

    const firestore = getFirestore();
    const driver = await getDriverDoc(firestore, driverId);
    if (!driver.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }
    if (!driver.isApproved) {
      return res.status(400).json({ error: "Cannot mark missed: driver is not approved." });
    }

    const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
    const snapshot = await jobRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const data = snapshot.data();
    if (data?.assignedTo !== driverId) {
      return res.status(403).json({
        error: "Not allowed to update this job. It is assigned to another driver.",
      });
    }
    const markable = canMarkJobMissed(data?.jobStatus);
    if (!markable.ok) {
      return res.status(400).json({ error: markable.message });
    }

    const now = firestore.Timestamp.now();
    const driverRef = firestore.collection("drivers").doc(driverId);
    const completionOutcome = {
      type: "missed" as const,
      reason: parsed.reason,
      note: parsed.note,
      recordedAt: now,
      recordedBy: driverId,
      photoUrl: parsed.photoUrl,
    };

    await firestore.runTransaction(async (tx) => {
      const driverSnap = await tx.get(driverRef);
      const driverName =
        typeof driverSnap.data()?.name === "string" ? (driverSnap.data()?.name as string) : null;

      const historyId =
        typeof data?.currentAssignmentId === "string" ? data.currentAssignmentId : null;
      if (historyId) {
        tx.update(jobRef.collection("assignmentHistory").doc(historyId), {
          endedAt: now,
          outcome: "missed",
          completionOutcome,
        });
      }

      tx.update(jobRef, {
        jobStatus: "missed",
        completionOutcome,
        updatedAt: now,
      });

      const bookingId = typeof data?.bookingId === "string" ? data.bookingId : null;
      if (bookingId) {
        tx.set(
          firestore.collection("bookings").doc(bookingId),
          {
            status: bookingStatusForMissedJob(),
            driverId,
            driverName,
            completionOutcome,
            updatedAt: now,
          },
          { merge: true }
        );
      }
    });

    return res.status(200).json({
      id: jobRef.id,
      jobStatus: "missed",
      completionOutcome: serializeCompletionOutcome(completionOutcome),
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/missed] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
