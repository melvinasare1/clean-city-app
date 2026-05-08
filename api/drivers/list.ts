/**
 * GET /api/drivers/list
 * List drivers. Active only by default; ?all=1 for all.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { DRIVERS_COLLECTION, PROFILES_COLLECTION, getDriverDisplayName } from "../lib/collections";

function toDriver(
  id: string,
  d: Record<string, unknown>
): { id: string; name: string; isActive: boolean } {
  return {
    id,
    name: getDriverDisplayName(d, id),
    isActive: d.isActive !== false,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const all = req.query.all === "1" || req.query.all === "true";

  try {
    const firestore = getFirestore();

    const byId = new Map<string, { id: string; name: string; isActive: boolean }>();

    const driversSnap = await firestore.collection(DRIVERS_COLLECTION).get();
    for (const doc of driversSnap.docs) {
      byId.set(doc.id, toDriver(doc.id, doc.data()));
    }

    const profileDriversSnap = await firestore
      .collection(PROFILES_COLLECTION)
      .where("role", "==", "driver")
      .get();
    for (const doc of profileDriversSnap.docs) {
      if (!byId.has(doc.id)) {
        byId.set(doc.id, toDriver(doc.id, doc.data()));
      }
    }

    let drivers = Array.from(byId.values());
    if (!all) {
      drivers = drivers.filter((d) => d.isActive);
    }

    return res.status(200).json(drivers);
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : "Service error";
    if (String(msg).toLowerCase().includes("not initialized")) {
      return res.status(503).json({
        error: "Service unavailable",
        details: "Backend cannot connect to database. Check FIREBASE_SERVICE_ACCOUNT_JSON.",
      });
    }
    console.error("[GET /api/drivers/list] Error:", initErr);
    return res.status(500).json({ error: "Internal server error", details: msg });
  }
}
