/**
 * Pure helpers for missed pickup / completion guards.
 * Kept in sync by hand with functions/src/job-outcome.ts and
 * MISSED_REASON_* in packages/shared-types/src/index.ts.
 */

export const MISSED_REASON_CODES = [
  "BIN_NOT_AVAILABLE",
  "CUSTOMER_UNAVAILABLE",
  "INACCESSIBLE_ADDRESS",
  "EXCESS_WASTE",
  "ACCESS_SAFETY",
  "OTHER",
] as const;

export type MissedReasonCode = (typeof MISSED_REASON_CODES)[number];

const MISSED_REASON_SET = new Set<string>(MISSED_REASON_CODES);
const NOTE_MAX_LENGTH = 280;

export type ParseMissedPickupResult =
  | {
      ok: true;
      reason: MissedReasonCode;
      note: string | null;
      photoUrl: string | null;
    }
  | { ok: false; message: string };

export type JobCompletableResult = { ok: true } | { ok: false; message: string };

export function isMissedReasonCode(value: unknown): value is MissedReasonCode {
  return typeof value === "string" && MISSED_REASON_SET.has(value);
}

export function isClosedJobStatus(status: unknown): boolean {
  return status === "completed" || status === "missed" || status === "cancelled";
}

export function canCompleteJob(jobStatus: unknown): JobCompletableResult {
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

export function canMarkJobMissed(jobStatus: unknown): JobCompletableResult {
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

export function parseMissedPickupInput(data: unknown): ParseMissedPickupResult {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const reason = record.reason ?? record.missedReasonCode;
  if (!isMissedReasonCode(reason)) {
    return { ok: false, message: "A valid missed pickup reason is required." };
  }

  const noteRaw = record.note ?? record.missedReasonNote;
  const note =
    typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, NOTE_MAX_LENGTH) : null;
  if (reason === "OTHER" && !note) {
    return { ok: false, message: "A short note is required when the reason is Other." };
  }

  const photoRaw = record.photoUrl;
  const photoUrl = typeof photoRaw === "string" && photoRaw.trim() ? photoRaw.trim() : null;

  return { ok: true, reason, note, photoUrl };
}

export function bookingStatusForMissedJob(): "missed" {
  return "missed";
}

export function serializeCompletionOutcome(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type !== "missed") return null;
  const recordedAt = record.recordedAt as { toDate?: () => Date } | string | null | undefined;
  const recordedAtIso =
    recordedAt && typeof recordedAt === "object" && typeof recordedAt.toDate === "function"
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
