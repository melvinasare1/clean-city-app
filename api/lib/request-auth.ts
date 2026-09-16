import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAuthHeader } from "./verify-auth";
import { getFirestore } from "./firebase-admin";
import { getDriverDoc } from "./collections";
import {
  adminSecretMatches,
  driverActorFromDoc,
  jobAssignedToCaller,
  publicAuthError,
  staffAccessFromAdminDoc,
  staffMay,
  type StaffAction,
  type StaffRole,
} from "./authorize";

export type AuthOk<T> = { ok: true } & T;
export type AuthFail = { ok: false; status: number; error: string };
export type AuthResult<T> = AuthOk<T> | AuthFail;

export function isAuthFail(result: AuthResult<unknown>): result is AuthFail {
  return result.ok === false;
}

export async function requireAuthenticatedUser(
  req: VercelRequest
): Promise<AuthResult<{ uid: string }>> {
  const uid = await verifyAuthHeader(req);
  if (!uid) {
    const fail = publicAuthError("unauthenticated");
    return { ok: false, ...fail };
  }
  return { ok: true, uid };
}

async function loadStaffData(
  uid: string
): Promise<Record<string, unknown> | undefined> {
  const firestore = getFirestore();
  const primary = await firestore.collection("admins").doc(uid).get();
  if (primary.exists) {
    return primary.data() as Record<string, unknown>;
  }
  const legacy = await firestore.collection("admin_accounts").doc(uid).get();
  if (legacy.exists) {
    return legacy.data() as Record<string, unknown>;
  }
  return undefined;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/**
 * Push sending is privileged: approved admin Firebase session, or
 * server-to-server ADMIN_SECRET. Apps must use Bearer tokens, never the secret.
 */
export async function requirePushSender(
  req: VercelRequest
): Promise<AuthResult<{ uid: string | null; via: "staff" | "admin_secret" }>> {
  if (
    adminSecretMatches(
      headerValue(req.headers["x-admin-secret"]),
      process.env.ADMIN_SECRET
    )
  ) {
    return { ok: true, uid: null, via: "admin_secret" };
  }
  const staff = await requireStaff(req, "admin_only");
  if (isAuthFail(staff)) {
    return staff;
  }
  return { ok: true, uid: staff.uid, via: "staff" };
}

export async function requireStaff(
  req: VercelRequest,
  action: StaffAction = "dispatch"
): Promise<AuthResult<{ uid: string; role: StaffRole }>> {
  const auth = await requireAuthenticatedUser(req);
  if (isAuthFail(auth)) {
    return auth;
  }

  const access = staffAccessFromAdminDoc(await loadStaffData(auth.uid));
  if (!access.allowed) {
    const fail = publicAuthError(access.reason);
    return { ok: false, ...fail };
  }
  if (!staffMay(access.role, action)) {
    return { ok: false, status: 403, error: "Not authorized" };
  }
  return { ok: true, uid: auth.uid, role: access.role };
}

export async function requireApprovedDriver(
  req: VercelRequest
): Promise<AuthResult<{ uid: string }>> {
  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return auth;

  const firestore = getFirestore();
  const driver = await getDriverDoc(firestore, auth.uid);
  if (!driver.exists) {
    const fail = publicAuthError("missing");
    return { ok: false, ...fail };
  }
  const actor = driverActorFromDoc(driver.data as Record<string, unknown>);
  if (!actor.allowed) {
    const fail = publicAuthError(actor.reason);
    return { ok: false, ...fail };
  }
  return { ok: true, uid: auth.uid };
}

export function requireAssignedJob(
  job: Record<string, unknown> | undefined,
  uid: string
): AuthResult<{ uid: string }> {
  if (!jobAssignedToCaller(job, uid)) {
    return { ok: false, status: 403, error: "Not allowed to act on this job" };
  }
  return { ok: true, uid };
}

export function sendAuthFailure(res: VercelResponse, auth: AuthFail): VercelResponse {
  return res.status(auth.status).json({ error: auth.error });
}

export function sendPublicError(
  res: VercelResponse,
  status: number,
  error: string
): VercelResponse {
  return res.status(status).json({ error });
}
