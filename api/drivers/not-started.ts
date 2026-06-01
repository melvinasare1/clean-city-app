/**
 * GET /api/drivers/not-started
 * Drivers who haven't started a shift on ?date=YYYY-MM-DD.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { DRIVERS_COLLECTION, toAdminDriverSummary } from "../lib/collections";

const DRIVER_SHIFTS_COLLECTION = "driverShifts";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dateParam = typeof req.query.date === "string" ? req.query.date.trim() : null;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);

  try {
    const firestore = getFirestore();

    const driversSnap = await firestore.collection(DRIVERS_COLLECTION).get();
    const byId = new Map(
      driversSnap.docs.map((doc) => [
        doc.id,
        toAdminDriverSummary(doc.id, doc.data() as Record<string, unknown>),
      ])
    );

    const driverIds = Array.from(byId.keys());
    const startedIds = new Set<string>();

    await Promise.all(
      driverIds.map(async (driverId) => {
        const docId = `${driverId}_${date}`;
        const shiftRef = firestore.collection(DRIVER_SHIFTS_COLLECTION).doc(docId);
        const snap = await shiftRef.get();
        const d = snap.data();
        if (d?.shiftStartedAt) {
          startedIds.add(driverId);
        }
      })
    );

    const notStarted = driverIds
      .filter((id) => !startedIds.has(id))
      .map((id) => byId.get(id)!)
      .filter(Boolean);

    return res.status(200).json(notStarted);
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : "Service error";
    if (String(msg).toLowerCase().includes("not initialized")) {
      return res.status(503).json({
        error: "Service unavailable",
        details: "Backend cannot connect to database. Check FIREBASE_SERVICE_ACCOUNT_JSON.",
      });
    }
    console.error("[GET /api/drivers/not-started] Error:", initErr);
    return res.status(500).json({ error: "Internal server error", details: msg });
  }
}
