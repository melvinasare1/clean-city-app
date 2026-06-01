/**
 * Firestore collection names and helpers.
 *
 * - profiles/  → customers and admins only (never drivers)
 * - drivers/   → all driver data (uid, status, push token, etc.)
 */

import type admin from "firebase-admin";
import {
  type DriverAccountStatus,
  isDriverApproved,
  isDriverRole,
  normalizeDriverStatus,
} from "./driver-account";

export const USERS_COLLECTION = "users";
export const CUSTOMERS_COLLECTION = "customers";
export const DRIVERS_COLLECTION = "drivers";
export const PROFILES_COLLECTION = "profiles";

export type AppRole = "customer" | "driver" | "admin";

export interface DriverDoc {
  uid: string;
  email?: string;
  name?: string;
  phone?: string;
  role: "driver";
  status: DriverAccountStatus;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  /** @deprecated Use status === "approved" */
  isActive?: boolean;
  expoPushToken?: string;
  pushTokenUpdatedAt?: string;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  [key: string]: unknown;
}

/**
 * Derive a single display name from driver data.
 */
export function getDriverDisplayName(
  d: Record<string, unknown> | undefined,
  docId: string
): string {
  if (!d) return docId;
  if (typeof d.name === "string" && d.name) return d.name;
  if (typeof d.displayName === "string" && d.displayName) return d.displayName;
  const first = typeof d.firstName === "string" ? d.firstName.trim() : "";
  const last = typeof d.lastName === "string" ? d.lastName.trim() : "";
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (typeof d.email === "string" && d.email) return d.email;
  return docId;
}

/**
 * Resolve a driver by id from drivers/{uid} only.
 */
export async function getDriverDoc(
  firestore: admin.firestore.Firestore,
  driverId: string
): Promise<
  | { exists: true; isApproved: boolean; status: DriverAccountStatus; data: DriverDoc }
  | { exists: false }
> {
  const driverSnap = await firestore.collection(DRIVERS_COLLECTION).doc(driverId).get();
  if (!driverSnap.exists) {
    return { exists: false };
  }

  const raw = driverSnap.data() as Record<string, unknown> | undefined;
  if (!isDriverRole(raw) && raw?.role != null && raw.role !== "driver") {
    return { exists: false };
  }

  const status = normalizeDriverStatus(raw);
  const approved = isDriverApproved(raw);

  return {
    exists: true,
    isApproved: approved,
    status,
    data: {
      ...(raw as DriverDoc),
      uid: driverId,
      role: "driver",
      status,
    },
  };
}

/**
 * Expo push token for a driver (drivers collection only).
 */
export async function getPushTokenForDriver(
  firestore: admin.firestore.Firestore,
  driverId: string
): Promise<string | null> {
  const snap = await firestore.collection(DRIVERS_COLLECTION).doc(driverId).get();
  if (!snap.exists) return null;
  const token = snap.data()?.expoPushToken;
  return typeof token === "string" ? token : null;
}

/**
 * Expo push token for a customer (profiles; customers collection when migrated).
 */
export function toAdminDriverSummary(
  id: string,
  d: Record<string, unknown>
): { id: string; name: string; status: DriverAccountStatus; isActive: boolean } {
  const status = normalizeDriverStatus(d);
  return {
    id,
    name: getDriverDisplayName(d, id),
    status,
    isActive: status === "approved",
  };
}

export async function getPushTokenForUser(
  firestore: admin.firestore.Firestore,
  userId: string
): Promise<string | null> {
  const customerSnap = await firestore.collection(CUSTOMERS_COLLECTION).doc(userId).get();
  if (customerSnap.exists) {
    const token = customerSnap.data()?.expoPushToken;
    if (typeof token === "string") return token;
  }
  const profileSnap = await firestore.collection(PROFILES_COLLECTION).doc(userId).get();
  if (profileSnap.exists) {
    const token = profileSnap.data()?.expoPushToken;
    if (typeof token === "string") return token;
  }
  return null;
}
