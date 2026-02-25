/**
 * POST /api/jobs/start
 * Body: { jobId: string, driverId: string }
 * Update job: jobStatus = "in_progress", startedAt = now, startedBy = driverId.
 * Only allowed if assignedTo === driverId.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";

const JOBS_COLLECTION = "jobs";

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
    const assignedTo = data?.assignedTo;
    if (assignedTo !== driverId) {
      return res.status(403).json({
        error: "Not allowed to start this job. It is assigned to another driver.",
      });
    }

    const now = firestore.Timestamp.now();
    await jobRef.update({
      jobStatus: "in_progress",
      startedAt: now,
      startedBy: driverId,
      updatedAt: now,
    });

    const updated = await jobRef.get();
    const u = updated.data();
    return res.status(200).json({
      id: jobRef.id,
      jobStatus: "in_progress",
      startedAt: u?.startedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      startedBy: driverId,
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/start] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
