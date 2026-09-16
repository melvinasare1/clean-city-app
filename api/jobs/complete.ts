/**
 * POST /api/jobs/complete
 * Body: { jobId: string, driverId: string }
 * Update job: jobStatus = "completed", completedAt = now, completedBy = driverId.
 * Increment totalJobsCompleted on today's driverShift.
 * Validates driver exists in drivers collection and is approved. Not allowed if paymentStatus !== "paid" or assignedTo !== driverId.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { getDriverDoc } from "../lib/collections";

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
    const driver = await getDriverDoc(firestore, driverId);
    if (!driver.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }
    if (!driver.isApproved) {
      return res.status(400).json({ error: "Cannot complete job: driver is not approved." });
    }

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
    if (data?.jobStatus === "completed") {
      return res.status(400).json({ error: "Job is already completed." });
    }

    const now = firestore.Timestamp.now();
    const date = todayUtcYYYYMMDD();
    const shiftId = `${driverId}_${date}`;
    const shiftRef = firestore.collection(DRIVER_SHIFTS_COLLECTION).doc(shiftId);
    const driverRef = firestore.collection("drivers").doc(driverId);

    await firestore.runTransaction(async (tx) => {
      const driverSnap = await tx.get(driverRef);
      const driverName =
        typeof driverSnap.data()?.name === "string" ? (driverSnap.data()?.name as string) : null;

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
            driverId,
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
      completedBy: driverId,
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/complete] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
