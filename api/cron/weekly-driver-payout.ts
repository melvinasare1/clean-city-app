/**
 * Weekly driver payout ledger — computes what's owed, moves no money.
 * Invoked by Vercel Cron every Monday; secure with CRON_SECRET
 * (Authorization: Bearer <CRON_SECRET>). Unlike the daily subscription-billing
 * job, this does NOT fail open when CRON_SECRET is unset — it handles money
 * figures, so an unauthenticated call is always rejected.
 *
 * Groups all pending drivers/{uid}/earnings entries by driver (via a
 * collection-group query), creates a payoutBatches/{weekOf}_{driverId}
 * summary doc per driver, and marks those entries as included in that batch.
 * The actual payout is issued manually through Paystack's own dashboard
 * using these totals — no Transfers API integration here.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

function mondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const firestore = getFirestore();
  const weekOf = mondayOfWeek(new Date());
  const now = firestore.Timestamp.now();
  const results: { batches: number; drivers: string[]; errors: string[] } = {
    batches: 0,
    drivers: [],
    errors: [],
  };

  try {
    const pendingSnap = await firestore
      .collectionGroup("earnings")
      .where("payoutStatus", "==", "pending")
      .get();

    const byDriver = new Map<string, typeof pendingSnap.docs>();
    for (const doc of pendingSnap.docs) {
      const driverId = doc.ref.parent.parent?.id;
      if (!driverId) continue;
      const list = byDriver.get(driverId) ?? [];
      list.push(doc);
      byDriver.set(driverId, list);
    }

    for (const [driverId, docs] of byDriver) {
      try {
        const totalAmount = docs.reduce(
          (sum, doc) => sum + Number(doc.data().driverAmount ?? 0),
          0
        );
        const batchId = `${weekOf}_${driverId}`;
        const batchRef = firestore.collection("payoutBatches").doc(batchId);

        const batch = firestore.batch();
        batch.set(batchRef, {
          driverId,
          weekOf,
          totalAmount,
          jobCount: docs.length,
          entryIds: docs.map((doc) => doc.id),
          status: "pending_manual_payout",
          createdAt: now,
        });
        for (const doc of docs) {
          batch.update(doc.ref, {
            payoutStatus: "included_in_batch",
            payoutBatchId: batchId,
          });
        }
        await batch.commit();

        results.batches += 1;
        results.drivers.push(driverId);
      } catch (error) {
        results.errors.push(
          `${driverId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return res.status(200).json({ weekOf, ...results });
  } catch (error: unknown) {
    console.error("[weekly-driver-payout] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
