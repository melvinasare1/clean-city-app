import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAuthHeader } from "./verify-auth";
import { getFirestore } from "./firebase-admin";
import { getDriverDoc } from "./collections";
import {
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

export async function requireStaff(
  req: VercelRequest,
  action: StaffAction = "dispatch"
): Promise<AuthResult<{ uid: string; role: StaffRole }>> {
  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return auth;

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
