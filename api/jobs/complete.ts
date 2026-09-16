/**
 * POST /api/jobs/complete
 * Body: { jobId: string }
 * Caller must be the authenticated assigned driver.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { canCompleteJob } from "../lib/job-outcome";
import {
  requireApprovedDriver,
  requireAssignedJob,
  sendAuthFailure,
  sendPublicError,
} from "../lib/request-auth";

const JOBS_COLLECTION = "jobs";
const DRIVER_SHIFTS_COLLECTION = "driverShifts";
// Kept in sync by hand with DRIVER_COMMISSION_RATE in functions/src/job-offers.ts
// and apps/driver/src/lib/earnings.ts — these three runtimes don't share a package.
const DRIVER_COMMISSION_RATE = 0.8;

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

    const firestore = getFirestore();
    const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
    const snapshot = await jobRef.get();

    if (!snapshot.exists) {
      return sendPublicError(res, 404, "Job not found");
    }

    const data = snapshot.data();
    if (data?.paymentStatus !== "paid") {
      return sendPublicError(res, 400, "Cannot complete job. Payment status must be 'paid'.");
    }
    const assigned = requireAssignedJob(data, uid);
    if (!assigned.ok) {
      return sendAuthFailure(res, assigned);
    }
    const completable = canCompleteJob(data?.jobStatus);
    if (!completable.ok) {
      return sendPublicError(res, 400, completable.message);
    }

    const now = firestore.Timestamp.now();
    const date = todayUtcYYYYMMDD();
    const shiftId = `${uid}_${date}`;
    const shiftRef = firestore.collection(DRIVER_SHIFTS_COLLECTION).doc(shiftId);
    const driverRef = firestore.collection("drivers").doc(uid);

    await firestore.runTransaction(async (tx) => {
      const driverSnap = await tx.get(driverRef);
      const driverName =
        typeof driverSnap.data()?.name === "string" ? (driverSnap.data()?.name as string) : null;

      tx.update(jobRef, {
        jobStatus: "completed",
        completedAt: now,
        completedBy: uid,
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
      tx.set(
        driverRef,
        {
          jobsCompletedCount: firestore.FieldValue.increment(1),
          updatedAt: now,
        },
        { merge: true }
      );

      const bookingId = typeof data?.bookingId === "string" ? data.bookingId : null;
      if (bookingId) {
        tx.set(
          firestore.collection("bookings").doc(bookingId),
          {
            status: "completed",
            driverId: uid,
            driverName,
            completedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      const grossAmount = items.reduce((sum: number, item: unknown) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const value = Number(record.totalPrice ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      const driverAmount = grossAmount * DRIVER_COMMISSION_RATE;
      const platformAmount = grossAmount - driverAmount;

      tx.set(driverRef.collection("earnings").doc(), {
        jobId,
        bookingId,
        grossAmount,
        commissionRate: DRIVER_COMMISSION_RATE,
        driverAmount,
        platformAmount,
        earnedAt: now,
        customerName: typeof data?.customerName === "string" ? data.customerName : null,
        location: typeof data?.location === "string" ? data.location : null,
        payoutStatus: "pending",
        payoutBatchId: null,
      });
    });

    const updated = await jobRef.get();
    const u = updated.data();
    return res.status(200).json({
      id: jobRef.id,
      jobStatus: "completed",
      completedAt: u?.completedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      completedBy: uid,
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/complete] Error:", error);
    return sendPublicError(res, 500, "Internal server error");
  }
}
