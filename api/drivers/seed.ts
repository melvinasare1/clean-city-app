/**
 * POST /api/drivers/seed
 * Create the initial founder driver when none exist.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { DRIVERS_COLLECTION } from "../lib/collections";
import { requireStaff, sendAuthFailure, sendPublicError } from "../lib/request-auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const staff = await requireStaff(req, "admin_only");
    if (!staff.ok) {
      return sendAuthFailure(res, staff);
    }

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
      return sendPublicError(res, 400, "Missing required field: driverId (uid of founder driver)");
    }

    const now = firestore.Timestamp.now();
    await firestore.collection(DRIVERS_COLLECTION).doc(founderId).set({
      uid: founderId,
      email: email ?? null,
      name: name || "Founder Driver",
      phone: null,
      role: "driver",
      status: "approved",
      priority: 100,
      photoURL: null,
      vehicleType: null,
      vehiclePlate: null,
      serviceProviderName: null,
      paymentMethods: { cash: true, card: true, cashAndCard: true },
      rating: null,
      jobsCompletedCount: 0,
      notificationsEnabled: true,
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
      return sendPublicError(res, 503, "Service unavailable");
    }
    console.error("[POST /api/drivers/seed] Error:", initErr);
    return sendPublicError(res, 500, "Internal server error");
  }
}
