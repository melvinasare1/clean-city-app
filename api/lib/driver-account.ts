/**
 * Driver account status helpers (server).
 * Legacy `isActive: true|false` maps to approved|pending.
 */

export type DriverAccountStatus = "pending" | "approved" | "suspended";

export function normalizeDriverStatus(
  data: Record<string, unknown> | undefined
): DriverAccountStatus {
  const status = data?.status;
  if (status === "suspended") return "suspended";
  if (status === "approved" || data?.isActive === true) return "approved";
  if (status === "pending" || data?.isActive === false) return "pending";
  return "pending";
}

export function isDriverApproved(data: Record<string, unknown> | undefined): boolean {
  return normalizeDriverStatus(data) === "approved";
}

export function isDriverRole(data: Record<string, unknown> | undefined): boolean {
  return data?.role === "driver";
}
