/**
 * GET /api/drivers
 * Returns list of drivers from drivers/ only: { id, name, status, isActive }.
 * isActive is true when status === "approved" (legacy field for admin UI).
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

  try {
    let firestore;
    try {
      firestore = getFirestore();
    } catch (initErr) {
      const msg = initErr instanceof Error ? initErr.message : "Firebase not initialized";
      console.error("[GET /api/drivers] Firebase:", msg);
      return res.status(503).json({
        error: "Service unavailable",
        details: "Backend cannot connect to database. Check FIREBASE_SERVICE_ACCOUNT_JSON.",
      });
    }

    const driversSnap = await firestore.collection(DRIVERS_COLLECTION).get();
    const drivers = driversSnap.docs.map((doc) =>
      toAdminDriverSummary(doc.id, doc.data() as Record<string, unknown>)
    );

    return res.status(200).json(drivers);
  } catch (error: unknown) {
    console.error("[GET /api/drivers] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
