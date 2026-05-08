/**
 * Firestore collection names and helpers for the separated identity/role model.
 *
 * Target structure:
 * - users/     → identity only (uid, email, role, createdAt, updatedAt)
 * - customers/ → customer-specific data (userId = uid)
 * - drivers/   → driver-specific data (userId = uid, isActive)
 *
 * Backward compatibility: driver/customer lookups try the new collection first,
 * then fall back to profiles (existing mixed collection) until migration is complete.
 */

import type admin from "firebase-admin";

export const USERS_COLLECTION = "users";
export const CUSTOMERS_COLLECTION = "customers";
export const DRIVERS_COLLECTION = "drivers";
/** Legacy mixed collection; used as fallback until migration is run. */
export const PROFILES_COLLECTION = "profiles";

export type AppRole = "customer" | "driver" | "admin";

export interface DriverDoc {
  userId: string;
  email?: string;
  name?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  phone?: string;
  phoneNumber?: string;
  expoPushToken?: string;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
  [key: string]: unknown;
}

/**
 * Derive a single display name from driver data (supports name, displayName, firstName+lastName, email, id).
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
 * Resolve a driver by id: check drivers collection first, then profiles (backward compat).
 * Returns null if not found or not a driver / inactive.
 */
export async function getDriverDoc(
  firestore: admin.firestore.Firestore,
  driverId: string
): Promise<{ exists: true; isActive: boolean; data: DriverDoc } | { exists: false }> {
  const driverSnap = await firestore.collection(DRIVERS_COLLECTION).doc(driverId).get();
  if (driverSnap.exists) {
    const data = driverSnap.data() as DriverDoc | undefined;
    const isActive = data?.isActive !== false;
    return { exists: true, isActive, data: { ...data, userId: driverId, isActive } };
  }
  // Fallback: legacy profiles (role === "driver")
  const profileSnap = await firestore.collection(PROFILES_COLLECTION).doc(driverId).get();
  if (profileSnap.exists) {
    const data = profileSnap.data();
    if (data?.role !== "driver") return { exists: false };
    const isActive = data.isActive !== false;
    return {
      exists: true,
      isActive,
      data: {
        userId: driverId,
        email: data.email,
        name: data.name,
        displayName: data.displayName,
        isActive,
        phone: data.phone,
        expoPushToken: data.expoPushToken,
        ...data,
      },
    };
  }
  return { exists: false };
}

/**
 * Get Expo push token for a user (customer). Tries customers collection first, then profiles.
 */
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
