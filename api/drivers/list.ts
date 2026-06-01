/**
 * GET /api/drivers/list
 * List drivers from drivers/ only. Active (approved) by default; ?all=1 for all.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { DRIVERS_COLLECTION, toAdminDriverSummary } from "../lib/collections";

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

    const driversSnap = await firestore.collection(DRIVERS_COLLECTION).get();
    let drivers = driversSnap.docs.map((doc) =>
      toAdminDriverSummary(doc.id, doc.data() as Record<string, unknown>)
    );

    if (!all) {
      drivers = drivers.filter((d) => d.status === "approved");
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
