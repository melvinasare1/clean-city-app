/**
 * GET /api/jobs/single?jobId=xxx&driverId=xxx
 * Returns one job by id. Validates that assignedTo === driverId (or returns 403).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { parsePickupCoordinates } from "../lib/geocode-address";
import {
  requireApprovedDriver,
  requireAssignedJob,
  sendAuthFailure,
  sendPublicError,
} from "../lib/request-auth";

const JOBS_COLLECTION = "jobs";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const actor = await requireApprovedDriver(req);
    if (!actor.ok) {
      return sendAuthFailure(res, actor);
    }

    const jobId = typeof req.query.jobId === "string" ? req.query.jobId.trim() : null;

    if (!jobId) {
      return sendPublicError(res, 400, "Missing required query: jobId");
    }

    const firestore = getFirestore();
    const doc = await firestore.collection(JOBS_COLLECTION).doc(jobId).get();

    if (!doc.exists) {
      return sendPublicError(res, 404, "Job not found");
    }

    const d = doc.data()!;
    const assigned = requireAssignedJob(d, actor.uid);
    if (!assigned.ok) {
      return sendAuthFailure(res, assigned);
    }

    const scheduledDate = d.scheduledDate?.toDate?.();
    const scheduledDateStr = scheduledDate
      ? scheduledDate.toISOString().slice(0, 10)
      : "";

    return res.status(200).json({
      id: doc.id,
      scheduledDate: scheduledDateStr,
      location: d.location ?? "",
      windowLabel: d.windowLabel ?? "",
      items: d.items ?? [],
      paymentStatus: d.paymentStatus ?? "pending",
      jobStatus: d.jobStatus ?? "scheduled",
      assignmentStatus: d.assignmentStatus ?? "unassigned",
      offerExpiresAt: d.offerExpiresAt?.toDate?.()?.toISOString?.() ?? null,
      subscriptionId: d.subscriptionId ?? null,
      addressSnapshot: d.addressSnapshot ?? { addressLine1: "", area: "", phoneNumber: "" },
      pickup: parsePickupCoordinates(d.pickup),
    });
  } catch (error: unknown) {
    console.error("[GET /api/jobs/single] Error:", error);
    return sendPublicError(res, 500, "Internal server error");
  }
}
