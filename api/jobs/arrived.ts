/**
 * POST /api/jobs/arrived
 * Body: { jobId: string }
 * Caller must be the authenticated assigned driver.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
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
    const assigned = requireAssignedJob(data, uid);
    if (!assigned.ok) {
      return sendAuthFailure(res, assigned);
    }
    if (data?.jobStatus !== "in_progress") {
      return sendPublicError(res, 400, "Job must be started before you can mark arrived.");
    }

    if (data?.arrivedAt) {
      return res.status(200).json({
        id: jobRef.id,
        ok: true,
        arrivedAt:
          data.arrivedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
      });
    }

    const now = firestore.Timestamp.now();
    await jobRef.update({
      arrivedAt: now,
      updatedAt: now,
    });

    return res.status(200).json({
      id: jobRef.id,
      ok: true,
      arrivedAt: now.toDate().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/arrived] Error:", error);
    return sendPublicError(res, 500, "Internal server error");
  }
}
