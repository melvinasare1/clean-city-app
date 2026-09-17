"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthFail = isAuthFail;
exports.requireAuthenticatedUser = requireAuthenticatedUser;
exports.requirePushSender = requirePushSender;
exports.requireStaff = requireStaff;
exports.requireApprovedDriver = requireApprovedDriver;
exports.requireAssignedJob = requireAssignedJob;
exports.sendAuthFailure = sendAuthFailure;
exports.sendPublicError = sendPublicError;
const verify_auth_1 = require("./verify-auth");
const firebase_admin_1 = require("./firebase-admin");
const collections_1 = require("./collections");
const authorize_1 = require("./authorize");
function isAuthFail(result) {
    return result.ok === false;
}
async function requireAuthenticatedUser(req) {
    const uid = await (0, verify_auth_1.verifyAuthHeader)(req);
    if (!uid) {
        const fail = (0, authorize_1.publicAuthError)("unauthenticated");
        return { ok: false, ...fail };
    }
    return { ok: true, uid };
}
async function loadStaffData(uid) {
    const firestore = (0, firebase_admin_1.getFirestore)();
    const primary = await firestore.collection("admins").doc(uid).get();
    if (primary.exists) {
        return primary.data();
    }
    const legacy = await firestore.collection("admin_accounts").doc(uid).get();
    if (legacy.exists) {
        return legacy.data();
    }
    return undefined;
}
function headerValue(value) {
    if (typeof value === "string")
        return value;
    if (Array.isArray(value) && typeof value[0] === "string")
        return value[0];
    return undefined;
}
/**
 * Push sending is privileged: approved admin Firebase session, or
 * server-to-server ADMIN_SECRET. Apps must use Bearer tokens, never the secret.
 */
async function requirePushSender(req) {
    if ((0, authorize_1.adminSecretMatches)(headerValue(req.headers["x-admin-secret"]), process.env.ADMIN_SECRET)) {
        return { ok: true, uid: null, via: "admin_secret" };
    }
    const staff = await requireStaff(req, "admin_only");
    if (isAuthFail(staff)) {
        return staff;
    }
    return { ok: true, uid: staff.uid, via: "staff" };
}
async function requireStaff(req, action = "dispatch") {
    const auth = await requireAuthenticatedUser(req);
    if (isAuthFail(auth)) {
        return auth;
    }
    const access = (0, authorize_1.staffAccessFromAdminDoc)(await loadStaffData(auth.uid));
    if (!access.allowed) {
        const fail = (0, authorize_1.publicAuthError)(access.reason);
        return { ok: false, ...fail };
    }
    if (!(0, authorize_1.staffMay)(access.role, action)) {
        return { ok: false, status: 403, error: "Not authorized" };
    }
    return { ok: true, uid: auth.uid, role: access.role };
}
async function requireApprovedDriver(req) {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.ok)
        return auth;
    const firestore = (0, firebase_admin_1.getFirestore)();
    const driver = await (0, collections_1.getDriverDoc)(firestore, auth.uid);
    if (!driver.exists) {
        const fail = (0, authorize_1.publicAuthError)("missing");
        return { ok: false, ...fail };
    }
    const actor = (0, authorize_1.driverActorFromDoc)(driver.data);
    if (!actor.allowed) {
        const fail = (0, authorize_1.publicAuthError)(actor.reason);
        return { ok: false, ...fail };
    }
    return { ok: true, uid: auth.uid };
}
function requireAssignedJob(job, uid) {
    if (!(0, authorize_1.jobAssignedToCaller)(job, uid)) {
        return { ok: false, status: 403, error: "Not allowed to act on this job" };
    }
    return { ok: true, uid };
}
function sendAuthFailure(res, auth) {
    return res.status(auth.status).json({ error: auth.error });
}
function sendPublicError(res, status, error) {
    return res.status(status).json({ error });
}
