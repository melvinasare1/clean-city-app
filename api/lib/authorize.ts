/**
 * Pure authorization decisions for operational APIs.
 * Callers still must verify the Firebase ID token and load Firestore docs.
 */

export type StaffRole = "admin" | "assistant";

export type StaffAccess =
  | { allowed: true; role: StaffRole; reason: "ok" }
  | {
      allowed: false;
      role: StaffRole | null;
      reason: "missing" | "unapproved" | "invalid_role";
    };

export type DriverActor =
  | { allowed: true; status: "approved"; reason: "ok" }
  | {
      allowed: false;
      status: "pending" | "suspended" | "unknown" | null;
      reason: "missing" | "pending" | "suspended" | "not_driver";
    };

export type StaffAction = "dispatch" | "admin_only";

export function staffAccessFromAdminDoc(
  data: Record<string, unknown> | undefined | null
): StaffAccess {
  if (!data) {
    return { allowed: false, role: null, reason: "missing" };
  }
  const role = data.role;
  if (role !== "admin" && role !== "assistant") {
    return { allowed: false, role: null, reason: "invalid_role" };
  }
  if (data.isApproved !== true) {
    return { allowed: false, role, reason: "unapproved" };
  }
  return { allowed: true, role, reason: "ok" };
}

export function staffMay(role: StaffRole, action: StaffAction): boolean {
  if (action === "dispatch") {
    return role === "admin" || role === "assistant";
  }
  return role === "admin";
}

export function driverActorFromDoc(
  data: Record<string, unknown> | undefined | null
): DriverActor {
  if (!data) {
    return { allowed: false, status: null, reason: "missing" };
  }
  if (data.role != null && data.role !== "driver") {
    return { allowed: false, status: null, reason: "not_driver" };
  }
  const status = data.status;
  if (status === "suspended") {
    return { allowed: false, status: "suspended", reason: "suspended" };
  }
  if (status === "approved" || data.isActive === true) {
    return { allowed: true, status: "approved", reason: "ok" };
  }
  if (status === "pending" || data.isActive === false) {
    return { allowed: false, status: "pending", reason: "pending" };
  }
  return { allowed: false, status: "unknown", reason: "pending" };
}

export function jobAssignedToCaller(
  job: Record<string, unknown> | undefined | null,
  uid: string
): boolean {
  return Boolean(job) && job?.assignedTo === uid;
}

/**
 * App UI must use admins/{uid}, never profiles.role, for staff privilege.
 */
export function appStaffAccess(input: {
  profileRole?: string | null;
  adminDoc?: Record<string, unknown> | null;
}): StaffAccess {
  void input.profileRole;
  return staffAccessFromAdminDoc(input.adminDoc);
}

export function publicAuthError(reason: StaffAccess["reason"] | DriverActor["reason"] | "unauthenticated"): {
  status: 401 | 403;
  error: string;
} {
  if (reason === "unauthenticated") {
    return { status: 401, error: "Sign in required" };
  }
  if (reason === "unapproved") {
    return { status: 403, error: "Staff account is not approved" };
  }
  if (reason === "pending") {
    return { status: 403, error: "Driver account is pending approval" };
  }
  if (reason === "suspended") {
    return { status: 403, error: "Driver account is suspended" };
  }
  if (reason === "missing" || reason === "invalid_role" || reason === "not_driver") {
    return { status: 403, error: "Not authorized" };
  }
  return { status: 403, error: "Not authorized" };
}
