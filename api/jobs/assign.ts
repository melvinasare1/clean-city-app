/**
 * POST /api/jobs/assign
 * Body: { jobId: string, driverId: string }
 * Assigns or reassigns a job to a driver. Caller identity comes from the
 * Firebase ID token; assignedBy is the authenticated staff UID.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { getDriverDoc } from "../lib/collections";
import { parsePickupCoordinates } from "../lib/geocode-address";
import { requireStaff, sendAuthFailure, sendPublicError } from "../lib/request-auth";

const JOBS_COLLECTION = "jobs";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const staff = await requireStaff(req, "dispatch");
    if (!staff.ok) {
      return sendAuthFailure(res, staff);
    }

    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : null;
    const driverId = typeof body.driverId === "string" ? body.driverId.trim() : null;

    if (!jobId) {
      return sendPublicError(res, 400, "Missing required field: jobId");
    }
    if (!driverId) {
      return sendPublicError(res, 400, "Missing required field: driverId");
    }

    const firestore = getFirestore();
    const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return sendPublicError(res, 404, "Job not found");
    }

    const driver = await getDriverDoc(firestore, driverId);
    if (!driver.exists) {
      return sendPublicError(res, 404, "Driver not found");
    }
    if (!driver.isApproved) {
      return sendPublicError(res, 400, "Job cannot be assigned to a driver who is not approved.");
    }

    const jobData = jobSnap.data();
    if (jobData?.jobStatus === "completed") {
      return sendPublicError(res, 400, "Cannot assign or reassign a completed job.");
    }
    if (jobData?.jobStatus === "missed") {
      return sendPublicError(
        res,
        400,
        "Cannot assign or reassign a missed job until it is explicitly rescheduled."
      );
    }
    const currentStatus = jobData?.assignmentStatus ?? "unassigned";
    const assignmentStatus =
      currentStatus === "unassigned" ? "assigned" : "reassigned";

    const now = firestore.Timestamp.now();
    await jobRef.update({
      assignedTo: driverId,
      assignedAt: now,
      assignedBy: staff.uid,
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
      pickup: parsePickupCoordinates(u.pickup),
    });
  } catch (error: unknown) {
    console.error("[POST /api/jobs/assign] Error:", error);
    return sendPublicError(res, 500, "Internal server error");
  }
}
