/**
 * POST /api/jobs/assign
 * Body: { jobId: string, driverId: string, adminId: string }
 * Assigns or reassigns a job to a driver. Returns updated job.
 * Validates driver exists in drivers collection (or profiles fallback) and isActive === true.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { getDriverDoc } from "../lib/collections";

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
    const adminId = typeof body.adminId === "string" ? body.adminId.trim() : null;

    if (!jobId) {
      return res.status(400).json({ error: "Missing required field: jobId" });
    }
    if (!driverId) {
      return res.status(400).json({ error: "Missing required field: driverId" });
    }
    if (!adminId) {
      return res.status(400).json({ error: "Missing required field: adminId" });
    }

    const firestore = getFirestore();
    const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return res.status(404).json({ error: "Job not found" });
    }

    const driver = await getDriverDoc(firestore, driverId);
    if (!driver.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }
    if (!driver.isActive) {
      return res.status(400).json({
        error: "Job cannot be assigned to an inactive driver.",
      });
    }

    const jobData = jobSnap.data();
    if (jobData?.jobStatus === "completed") {
      return res.status(400).json({
        error: "Cannot assign or reassign a completed job.",
      });
    }
    const currentStatus = jobData?.assignmentStatus ?? "unassigned";
    const assignmentStatus =
      currentStatus === "unassigned" ? "assigned" : "reassigned";

    const now = firestore.Timestamp.now();
    await jobRef.update({
      assignedTo: driverId,
      assignedAt: now,
      assignedBy: adminId,
      assignmentStatus,
      updatedAt: now,
    });

    const updated = await jobRef.get();
    const u = updated.data()!;
    const scheduledDate = (u.scheduledDate as { toDate?: () => Date })?.toDate?.();
    const scheduledDateStr = scheduledDate
      ? scheduledDate.toISOString().slice(0, 10)
      : "";
    const assignedAt = (u.assignedAt as { toDate?: () => Date })?.toDate?.();

    return res.status(200).json({
      id: jobRef.id,
      scheduledDate: scheduledDateStr,
      location: u.location ?? "",
      windowLabel: u.windowLabel ?? "",
      windowId: u.windowId ?? "",
      items: u.items ?? [],
      paymentStatus: u.paymentStatus ?? "pending",
      jobStatus: u.jobStatus ?? "scheduled",
      assignmentStatus: u.assignmentStatus,
      assignedTo: u.assignedTo,
      assignedAt: assignedAt ? assignedAt.toISOString() : null,
      assignedBy: u.assignedBy ?? null,
      addressSnapshot: u.addressSnapshot ?? { addressLine1: "", area: "", phoneNumber: "" },
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/assign] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
