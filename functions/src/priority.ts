import { Timestamp } from "firebase-admin/firestore";

export const DEFAULT_DRIVER_PRIORITY = 100;
export const PRIORITY_ACCEPT_DELTA = 4;
export const PRIORITY_DECLINE_DELTA = -8;
export const PRIORITY_EXPIRE_DELTA = -8;
export const PRIORITY_CANCEL_DELTA = -10;

export function clampPriority(value: unknown): number {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : DEFAULT_DRIVER_PRIORITY;
  return Math.min(100, Math.max(0, n));
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = (value as { toDate?: () => Date }).toDate?.();
    if (maybe instanceof Date && !Number.isNaN(maybe.getTime())) return maybe;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
