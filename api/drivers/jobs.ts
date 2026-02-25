/**
 * GET /api/drivers/jobs?driverId=xxx&date=YYYY-MM-DD
 * Returns all jobs assigned to the driver for that date.
 * Firestore: composite index on (assignedTo, scheduledDate) required.
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
    const driverId = typeof req.query.driverId === "string" ? req.query.driverId.trim() : null;
    const date = typeof req.query.date === "string" ? req.query.date.trim() : null;

    if (!driverId) {
      return res.status(400).json({ error: "Missing required query: driverId" });
    }
    if (!date) {
      return res.status(400).json({ error: "Missing required query: date (YYYY-MM-DD)" });
    }

    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(date);
    if (!dateMatch) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const firestore = getFirestore();
    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");
    const startTs = firestore.Timestamp.fromDate(startOfDay);
    const endTs = firestore.Timestamp.fromDate(endOfDay);

    const snapshot = await firestore
      .collection(JOBS_COLLECTION)
      .where("assignedTo", "==", driverId)
      .where("scheduledDate", ">=", startTs)
      .where("scheduledDate", "<=", endTs)
      .orderBy("scheduledDate", "asc")
      .get();

    const jobs = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        scheduledDate: date,
        location: d.location ?? "",
        windowLabel: d.windowLabel ?? "",
        items: d.items ?? [],
        paymentStatus: d.paymentStatus ?? "pending",
        jobStatus: d.jobStatus ?? "scheduled",
      };
    });

    return res.status(200).json(jobs);
  } catch (error: unknown) {
    console.error("[GET /api/drivers/jobs] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
