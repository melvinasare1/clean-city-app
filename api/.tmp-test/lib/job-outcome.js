"use strict";
/**
 * Pure helpers for missed pickup / completion guards.
 * Kept in sync by hand with functions/src/job-outcome.ts and
 * MISSED_REASON_* in packages/shared-types/src/index.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MISSED_REASON_CODES = void 0;
exports.isMissedReasonCode = isMissedReasonCode;
exports.isClosedJobStatus = isClosedJobStatus;
exports.canCompleteJob = canCompleteJob;
exports.canMarkJobMissed = canMarkJobMissed;
exports.parseMissedPickupInput = parseMissedPickupInput;
exports.bookingStatusForMissedJob = bookingStatusForMissedJob;
exports.serializeCompletionOutcome = serializeCompletionOutcome;
exports.MISSED_REASON_CODES = [
    "BIN_NOT_AVAILABLE",
    "CUSTOMER_UNAVAILABLE",
    "INACCESSIBLE_ADDRESS",
    "EXCESS_WASTE",
    "ACCESS_SAFETY",
    "OTHER",
];
const MISSED_REASON_SET = new Set(exports.MISSED_REASON_CODES);
const NOTE_MAX_LENGTH = 280;
function isMissedReasonCode(value) {
    return typeof value === "string" && MISSED_REASON_SET.has(value);
}
function isClosedJobStatus(status) {
    return status === "completed" || status === "missed" || status === "cancelled";
}
function canCompleteJob(jobStatus) {
    if (jobStatus === "completed") {
        return { ok: false, message: "Job is already completed." };
    }
    if (jobStatus === "missed") {
        return {
            ok: false,
            message: "This job was marked missed and cannot be completed.",
        };
    }
    if (jobStatus === "cancelled") {
        return { ok: false, message: "This job was cancelled and cannot be completed." };
    }
    if (jobStatus !== "in_progress") {
        return { ok: false, message: "Job must be started before it can be completed." };
    }
    return { ok: true };
}
function canMarkJobMissed(jobStatus) {
    if (jobStatus === "missed") {
        return { ok: false, message: "Job is already marked missed." };
    }
    if (jobStatus === "completed") {
        return { ok: false, message: "Completed jobs cannot be marked missed." };
    }
    if (jobStatus === "cancelled") {
        return { ok: false, message: "Cancelled jobs cannot be marked missed." };
    }
    if (jobStatus !== "in_progress") {
        return {
            ok: false,
            message: "Job must be started before it can be marked missed.",
        };
    }
    return { ok: true };
}
function parseMissedPickupInput(data) {
    const record = data && typeof data === "object" ? data : {};
    const reason = record.reason ?? record.missedReasonCode;
    if (!isMissedReasonCode(reason)) {
        return { ok: false, message: "A valid missed pickup reason is required." };
    }
    const noteRaw = record.note ?? record.missedReasonNote;
    const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, NOTE_MAX_LENGTH) : null;
    if (reason === "OTHER" && !note) {
        return { ok: false, message: "A short note is required when the reason is Other." };
    }
    const photoRaw = record.photoUrl;
    const photoUrl = typeof photoRaw === "string" && photoRaw.trim() ? photoRaw.trim() : null;
    return { ok: true, reason, note, photoUrl };
}
function bookingStatusForMissedJob() {
    return "missed";
}
function serializeCompletionOutcome(value) {
    if (!value || typeof value !== "object")
        return null;
    const record = value;
    if (record.type !== "missed")
        return null;
    const recordedAt = record.recordedAt;
    const recordedAtIso = recordedAt && typeof recordedAt === "object" && typeof recordedAt.toDate === "function"
        ? recordedAt.toDate().toISOString()
        : typeof recordedAt === "string"
            ? recordedAt
            : null;
    return {
        type: "missed",
        reason: typeof record.reason === "string" ? record.reason : null,
        note: typeof record.note === "string" ? record.note : record.note ?? null,
        recordedAt: recordedAtIso,
        recordedBy: typeof record.recordedBy === "string" ? record.recordedBy : null,
        photoUrl: typeof record.photoUrl === "string" ? record.photoUrl : null,
    };
}
