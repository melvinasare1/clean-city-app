/**
 * GET /api/jobs/single?jobId=xxx&driverId=xxx
 * Returns one job by id. Validates that assignedTo === driverId (or returns 403).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";

const JOBS_COLLECTION = "jobs";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const jobId = typeof req.query.jobId === "string" ? req.query.jobId.trim() : null;
    const driverId = typeof req.query.driverId === "string" ? req.query.driverId.trim() : null;

    if (!jobId) {
      return res.status(400).json({ error: "Missing required query: jobId" });
    }
    if (!driverId) {
      return res.status(400).json({ error: "Missing required query: driverId" });
    }

    const firestore = getFirestore();
    const doc = await firestore.collection(JOBS_COLLECTION).doc(jobId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const d = doc.data()!;
    if (d.assignedTo !== driverId) {
      return res.status(403).json({ error: "Not allowed to view this job." });
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
      addressSnapshot: d.addressSnapshot ?? { addressLine1: "", area: "", phoneNumber: "" },
    });
  } catch (error: unknown) {
    console.error("[GET /api/jobs/single] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
