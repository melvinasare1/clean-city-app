"use strict";
/**
 * Subscription billing: MoMo only, internal recurring, calendar monthly.
 * No Paystack plans or subscription_code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.timestampToDate = timestampToDate;
exports.dateToFirestoreTimestamp = dateToFirestoreTimestamp;
/** For date math we use Date; Firestore uses Timestamp */
function timestampToDate(ts) {
    if (!ts || typeof ts.toDate === "function") {
        try {
            return ts?.toDate?.() ?? null;
        }
        catch {
            return null;
        }
    }
    const s = ts._seconds;
    if (typeof s !== "number")
        return null;
    return new Date(s * 1000);
}
function dateToFirestoreTimestamp(date) {
    const ms = date.getTime();
    return {
        _seconds: Math.floor(ms / 1000),
        _nanoseconds: (ms % 1000) * 1000000,
    };
}
