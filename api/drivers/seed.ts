/**
 * POST /api/drivers/seed
 * Create the initial founder driver when none exist.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { DRIVERS_COLLECTION } from "../lib/collections";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const firestore = getFirestore();

    const driversSnap = await firestore.collection(DRIVERS_COLLECTION).limit(1).get();
    if (!driversSnap.empty) {
      return res.status(200).json({
        ok: true,
        message: "Drivers already exist; no seed created",
      });
    }

    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const founderId = typeof body.driverId === "string" ? body.driverId.trim() : null;
    const email = typeof body.email === "string" ? body.email.trim() : null;
    const name = typeof body.name === "string" ? body.name.trim() : "Founder Driver";

    if (!founderId) {
      return res.status(400).json({ error: "Missing required field: driverId (uid of founder driver)" });
    }

    const now = firestore.Timestamp.now();
    await firestore.collection(DRIVERS_COLLECTION).doc(founderId).set({
      uid: founderId,
      email: email ?? null,
      name: name || "Founder Driver",
      phone: null,
      role: "driver",
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({
      ok: true,
      message: "Founder driver created",
      driver: { id: founderId, name: name || "Founder Driver", status: "approved", isActive: true },
    });
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : "Service error";
    if (String(msg).toLowerCase().includes("not initialized")) {
      return res.status(503).json({
        error: "Service unavailable",
        details: "Backend cannot connect to database. Check FIREBASE_SERVICE_ACCOUNT_JSON.",
      });
    }
    console.error("[POST /api/drivers/seed] Error:", initErr);
    return res.status(500).json({ error: "Internal server error", details: msg });
  }
}
