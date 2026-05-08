/**
 * GET /api/drivers/:driverId
 * Returns { ok: true, driver: { id, ...data } }.
 * 400 – missing or invalid driverId; 404 – no driver; 405 – not GET.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import { getDriverDoc, getDriverDisplayName } from "../lib/collections";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const driverId =
    (req.query.driverId as string)?.trim() ||
    (req as unknown as { params?: { driverId?: string } }).params?.driverId?.trim();

  if (!driverId) {
    return res.status(400).json({ error: "Missing or invalid driverId" });
  }

  try {
    const firestore = getFirestore();
    const result = await getDriverDoc(firestore, driverId);

    if (!result.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const { data } = result;
    const driver = {
      id: driverId,
      ...data,
      name: getDriverDisplayName(data as Record<string, unknown>, driverId),
      // Normalize timestamps for JSON
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? (data.createdAt as string | undefined),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? (data.updatedAt as string | undefined),
    };

    return res.status(200).json({ ok: true, driver });
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : "Service error";
    if (String(msg).toLowerCase().includes("not initialized")) {
      return res.status(503).json({
        error: "Service unavailable",
        details: "Backend cannot connect to database. Check FIREBASE_SERVICE_ACCOUNT_JSON.",
      });
    }
    console.error("[GET /api/drivers/:driverId] Error:", initErr);
    return res.status(500).json({ error: "Internal server error", details: msg });
  }
}
