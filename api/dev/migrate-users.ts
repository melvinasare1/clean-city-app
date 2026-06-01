/**
 * POST /api/dev/migrate-users
 *
 * One-time migration: copy user documents from the source collection (users or profiles)
 * into customers/ and drivers/ by role. Does NOT delete or modify source documents.
 * Does NOT overwrite existing customer/driver documents.
 *
 * Blocked when NODE_ENV === "production".
 *
 * Body: none (optional: { sourceCollection?: "users" | "profiles" } to override env)
 * Returns: { ok: true, migrated: number } or { ok: false, error: string }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "../lib/firebase-admin";
import {
  USERS_COLLECTION,
  CUSTOMERS_COLLECTION,
  DRIVERS_COLLECTION,
} from "../lib/collections";

/** Fields to copy from user doc into customers/{uid} */
const CUSTOMER_FIELDS = [
  "email",
  "phone",
  "location",
  "referralCode",
  "referredBy",
  "creditBalance",
  "referralRewarded",
  "name",
  "displayName",
  "expoPushToken",
] as const;

/** Fields to copy from user doc into drivers/{uid} */
const DRIVER_FIELDS = [
  "email",
  "name",
  "displayName",
  "phone",
  "expoPushToken",
] as const;

function pick<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) {
      out[k] = obj[k];
    }
  }
  return out;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      ok: false,
      error: "Migration is disabled in production.",
    });
  }

  try {
    const firestore = getFirestore();
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const sourceCollection =
      (typeof body.sourceCollection === "string" && body.sourceCollection.trim()) ||
      process.env.MIGRATE_USERS_SOURCE?.trim() ||
      USERS_COLLECTION;

    if (sourceCollection !== "users" && sourceCollection !== "profiles") {
      return res.status(400).json({
        ok: false,
        error: "sourceCollection must be 'users' or 'profiles'",
      });
    }

    const snapshot = await firestore.collection(sourceCollection).get();
    const now = firestore.Timestamp.now();
    let migrated = 0;

    for (const docSnap of snapshot.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const role = data?.role;

      if (role === "customer") {
        const customersRef = firestore.collection(CUSTOMERS_COLLECTION).doc(uid);
        const existing = await customersRef.get();
        if (existing.exists) continue;

        const customerData = {
          userId: uid,
          ...pick(data, CUSTOMER_FIELDS as unknown as string[]),
          createdAt: data.createdAt ?? now,
          updatedAt: now,
        };
        await customersRef.set(customerData);
        migrated++;
      } else if (role === "driver") {
        const driversRef = firestore.collection(DRIVERS_COLLECTION).doc(uid);
        const existing = await driversRef.get();
        if (existing.exists) continue;

        const legacyActive = data.isActive !== false;
        const status =
          data.status === "approved" || data.status === "pending" || data.status === "suspended"
            ? data.status
            : legacyActive
              ? "approved"
              : "pending";
        const driverData = {
          uid,
          role: "driver",
          status,
          ...pick(data, DRIVER_FIELDS as unknown as string[]),
          createdAt: data.createdAt ?? now,
          updatedAt: now,
        };
        await driversRef.set(driverData);
        migrated++;
      }
      // admins / other roles: no document in customers or drivers
    }

    return res.status(200).json({ ok: true, migrated });
  } catch (error: unknown) {
    console.error("[POST /api/dev/migrate-users] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ ok: false, error: message });
  }
}
