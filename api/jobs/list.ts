/**
 * GET /api/jobs/list
 * Query params: date (YYYY-MM-DD), assignmentStatus, driverId, windowId.
 * Date-based queries; do not fetch all jobs at once. At least date is recommended.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore, admin } from "../lib/firebase-admin";

const JOBS_COLLECTION = "jobs";

function jobDocToResponse(
  doc: { id: string; data: () => Record<string, unknown> | undefined }
): Record<string, unknown> {
  const d = doc.data()!;
  const scheduledDate = d.scheduledDate as { toDate?: () => Date } | undefined;
  const scheduledDateStr = scheduledDate?.toDate
    ? scheduledDate.toDate().toISOString().slice(0, 10)
    : "";
  return {
    id: doc.id,
    scheduledDate: scheduledDateStr,
    location: d.location ?? "",
    windowLabel: d.windowLabel ?? "",
    windowId: d.windowId ?? "",
    items: d.items ?? [],
    paymentStatus: d.paymentStatus ?? "pending",
    jobStatus: d.jobStatus ?? "scheduled",
    assignmentStatus: d.assignmentStatus ?? "unassigned",
    assignedTo: d.assignedTo ?? null,
    assignedAt:
      (d.assignedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ?? null,
    assignedBy: d.assignedBy ?? null,
    addressSnapshot: d.addressSnapshot ?? { addressLine1: "", area: "", phoneNumber: "" },
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const date = typeof req.query.date === "string" ? req.query.date.trim() : null;
    const assignmentStatus =
      typeof req.query.assignmentStatus === "string" ? req.query.assignmentStatus.trim() : null;
    const driverId = typeof req.query.driverId === "string" ? req.query.driverId.trim() : null;
    const windowId = typeof req.query.windowId === "string" ? req.query.windowId.trim() : null;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Query param date (YYYY-MM-DD) is required for date-based queries.",
      });
    }

    const validStatuses = ["unassigned", "assigned", "accepted", "reassigned"];
    if (assignmentStatus && !validStatuses.includes(assignmentStatus)) {
      return res.status(400).json({
        error: "Invalid assignmentStatus. Use one of: unassigned, assigned, accepted, reassigned",
      });
    }

    const firestore = getFirestore();
    let query: admin.firestore.Query = firestore.collection(JOBS_COLLECTION);

    if (assignmentStatus) {
      query = query.where("assignmentStatus", "==", assignmentStatus);
    }
    if (driverId) {
      query = query.where("assignedTo", "==", driverId);
    }
    if (windowId) {
      query = query.where("windowId", "==", windowId);
    }
    if (date) {
      const startOfDay = new Date(date + "T00:00:00.000Z");
      const endOfDay = new Date(date + "T23:59:59.999Z");
      query = query
        .where("scheduledDate", ">=", firestore.Timestamp.fromDate(startOfDay))
        .where("scheduledDate", "<=", firestore.Timestamp.fromDate(endOfDay));
    }

    query = query.orderBy("scheduledDate", "asc");

    const snapshot = await query.get();
    const jobs = snapshot.docs.map((doc) => jobDocToResponse(doc));

    return res.status(200).json(jobs);
  } catch (error: unknown) {
    console.error("[GET /api/jobs/list] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
