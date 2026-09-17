"use strict";
/**
 * Firestore collection names and helpers.
 *
 * - profiles/  → customers and admins only (never drivers)
 * - drivers/   → all driver data (uid, status, push token, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILES_COLLECTION = exports.DRIVERS_COLLECTION = exports.CUSTOMERS_COLLECTION = exports.USERS_COLLECTION = void 0;
exports.getDriverDisplayName = getDriverDisplayName;
exports.getDriverDoc = getDriverDoc;
exports.getPushTokenForDriver = getPushTokenForDriver;
exports.toAdminDriverSummary = toAdminDriverSummary;
exports.getPushTokenForUser = getPushTokenForUser;
const driver_account_1 = require("./driver-account");
exports.USERS_COLLECTION = "users";
exports.CUSTOMERS_COLLECTION = "customers";
exports.DRIVERS_COLLECTION = "drivers";
exports.PROFILES_COLLECTION = "profiles";
/**
 * Derive a single display name from driver data.
 */
function getDriverDisplayName(d, docId) {
    if (!d)
        return docId;
    if (typeof d.name === "string" && d.name)
        return d.name;
    if (typeof d.displayName === "string" && d.displayName)
        return d.displayName;
    const first = typeof d.firstName === "string" ? d.firstName.trim() : "";
    const last = typeof d.lastName === "string" ? d.lastName.trim() : "";
    if (first || last)
        return [first, last].filter(Boolean).join(" ");
    if (typeof d.email === "string" && d.email)
        return d.email;
    return docId;
}
/**
 * Resolve a driver by id from drivers/{uid} only.
 */
async function getDriverDoc(firestore, driverId) {
    const driverSnap = await firestore.collection(exports.DRIVERS_COLLECTION).doc(driverId).get();
    if (!driverSnap.exists) {
        return { exists: false };
    }
    const raw = driverSnap.data();
    if (!(0, driver_account_1.isDriverRole)(raw) && raw?.role != null && raw.role !== "driver") {
        return { exists: false };
    }
    const status = (0, driver_account_1.normalizeDriverStatus)(raw);
    const approved = (0, driver_account_1.isDriverApproved)(raw);
    return {
        exists: true,
        isApproved: approved,
        status,
        data: {
            ...raw,
            uid: driverId,
            role: "driver",
            status,
        },
    };
}
/**
 * Expo push token for a driver (drivers collection only).
 */
async function getPushTokenForDriver(firestore, driverId) {
    const snap = await firestore.collection(exports.DRIVERS_COLLECTION).doc(driverId).get();
    if (!snap.exists)
        return null;
    const token = snap.data()?.expoPushToken;
    return typeof token === "string" ? token : null;
}
/**
 * Expo push token for a customer (profiles; customers collection when migrated).
 */
function toAdminDriverSummary(id, d) {
    const status = (0, driver_account_1.normalizeDriverStatus)(d);
    return {
        id,
        name: getDriverDisplayName(d, id),
        status,
        isActive: status === "approved",
    };
}
async function getPushTokenForUser(firestore, userId) {
    const customerSnap = await firestore.collection(exports.CUSTOMERS_COLLECTION).doc(userId).get();
    if (customerSnap.exists) {
        const token = customerSnap.data()?.expoPushToken;
        if (typeof token === "string")
            return token;
    }
    const profileSnap = await firestore.collection(exports.PROFILES_COLLECTION).doc(userId).get();
    if (profileSnap.exists) {
        const token = profileSnap.data()?.expoPushToken;
        if (typeof token === "string")
            return token;
    }
    return null;
}
