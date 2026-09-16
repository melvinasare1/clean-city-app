/**
 * POST /api/jobs/missed
 * Body: { jobId, reason, note?, photoUrl? }
 * Caller must be the authenticated assigned driver.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import {
  bookingStatusForMissedJob,
  canMarkJobMissed,
  parseMissedPickupInput,
  serializeCompletionOutcome,
} from "../lib/job-outcome";
import {
  requireApprovedDriver,
  requireAssignedJob,
  sendAuthFailure,
  sendPublicError,
} from "../lib/request-auth";

const JOBS_COLLECTION = "jobs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const actor = await requireApprovedDriver(req);
    if (!actor.ok) {
      return sendAuthFailure(res, actor);
    }
    const uid = actor.uid;

    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : null;

    if (!jobId) {
      return sendPublicError(res, 400, "Missing required field: jobId");
    }

    const parsed = parseMissedPickupInput(body);
    if (!parsed.ok) {
      return sendPublicError(res, 400, parsed.message);
    }

    const firestore = getFirestore();
    const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
    const snapshot = await jobRef.get();
    if (!snapshot.exists) {
      return sendPublicError(res, 404, "Job not found");
    }

    const data = snapshot.data();
    const assigned = requireAssignedJob(data, uid);
    if (!assigned.ok) {
      return sendAuthFailure(res, assigned);
    }
    const markable = canMarkJobMissed(data?.jobStatus);
    if (!markable.ok) {
      return sendPublicError(res, 400, markable.message);
    }

    const now = firestore.Timestamp.now();
    const driverRef = firestore.collection("drivers").doc(uid);
    const completionOutcome = {
      type: "missed" as const,
      reason: parsed.reason,
      note: parsed.note,
      recordedAt: now,
      recordedBy: uid,
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
            driverId: uid,
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
    return sendPublicError(res, 500, "Internal server error");
  }
}
