/**
 * GET /api/drivers
 * Returns list of drivers: { id, name, isActive }.
 * Reads from drivers collection first; falls back to profiles (role == 'driver') for backward compatibility.
 * Used by admin panel for assignment dropdown (filter to isActive === true on client).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { DRIVERS_COLLECTION, PROFILES_COLLECTION, getDriverDisplayName } from "../lib/collections";

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

    // Drivers collection first; merge with profiles (role === driver) for backward compatibility
    const driversSnap = await firestore.collection(DRIVERS_COLLECTION).get();
    const profileDriversSnap = await firestore
      .collection(PROFILES_COLLECTION)
      .where("role", "==", "driver")
      .get();

    const byId = new Map<string, { id: string; name: string; isActive: boolean }>();
    for (const doc of driversSnap.docs) {
      const d = doc.data();
      byId.set(doc.id, {
        id: doc.id,
        name: getDriverDisplayName(d, doc.id),
        isActive: d.isActive !== false,
      });
    }
    for (const doc of profileDriversSnap.docs) {
      if (!byId.has(doc.id)) {
        const d = doc.data();
        byId.set(doc.id, {
          id: doc.id,
          name: getDriverDisplayName(d, doc.id),
          isActive: d.isActive !== false,
        });
      }
    }

    const drivers = Array.from(byId.values());

    return res.status(200).json(drivers);
  } catch (error: unknown) {
    console.error("[GET /api/drivers] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
