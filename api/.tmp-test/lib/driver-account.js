"use strict";
/**
 * Driver account status helpers (server).
 * Legacy `isActive: true|false` maps to approved|pending.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDriverStatus = normalizeDriverStatus;
exports.isDriverApproved = isDriverApproved;
exports.isDriverRole = isDriverRole;
function normalizeDriverStatus(data) {
    const status = data?.status;
    if (status === "suspended")
        return "suspended";
    if (status === "approved" || data?.isActive === true)
        return "approved";
    if (status === "pending" || data?.isActive === false)
        return "pending";
    return "pending";
}
function isDriverApproved(data) {
    return normalizeDriverStatus(data) === "approved";
}
function isDriverRole(data) {
    return data?.role === "driver";
}
