/**
 * Driver dashboard API client. Job/shift writes go through backend.
 * Driver profile reads use drivers/{uid} only (never profiles).
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocAtPath } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/apiBase";
import {
  type DriverAccountStatus,
  isDriverApprovedStatus,
  normalizeDriverStatus,
} from "@/lib/driver-account";

const getBase = () => getApiBaseUrl();

export interface RegisterDriverInput {
  userId: string;
  email: string;
  name?: string;
  phone?: string;
}

/** Driver approval state for UI gating. Backend enforces on job endpoints. */
export interface DriverStatus {
  status: DriverAccountStatus;
  isApproved: boolean;
}

/**
 * Fetch driver status from Firestore drivers/{uid} only.
 */
export async function getDriverStatus(uid: string): Promise<DriverStatus | null> {
  try {
    const driverSnap = await getDoc(doc(db, "drivers", uid));
    if (!driverSnap.exists()) {
      return null;
    }
    const data = driverSnap.data() as Record<string, unknown>;
    if (data?.role !== "driver") {
      return null;
    }
    const status = normalizeDriverStatus(data);
    return {
      status,
      isApproved: isDriverApprovedStatus(status),
    };
  } catch (err) {
    console.error("[getDriverStatus] drivers read failed:", err);
    return null;
  }
}

/**
 * Create drivers/{uid} on driver signup. Does not touch profiles.
 */
export async function registerDriverAccount(input: RegisterDriverInput): Promise<void> {
  const { userId, email, name, phone } = input;
  if (!userId) {
    throw new Error("You must be signed in to register as a driver.");
  }
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error("An email address is required to register as a driver.");
  }

  const driverRef = doc(db, "drivers", userId);
  const existing = await getDoc(driverRef);
  if (existing.exists()) {
    return;
  }

  await setDocAtPath(
    ["drivers", userId],
    {
      uid: userId,
      email: trimmedEmail,
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      role: "driver",
      status: "pending",
    },
    { merge: true, addTimestamps: true }
  );
}

export interface DriverJob {
  id: string;
  scheduledDate: string;
  location: string;
  windowLabel: string;
  items: Array<{ id: string; type: string; quantity: number; unitPrice: number; totalPrice: number }>;
  paymentStatus: string;
  jobStatus: string;
}

export interface DriverShift {
  id: string;
  driverId: string;
  date: string;
  shiftStartedAt: string | null;
  shiftEndedAt: string | null;
  totalJobsCompleted: number;
}

/**
 * GET /api/jobs/single?jobId=xxx&driverId=xxx
 */
export async function getJobSingle(
  jobId: string,
  driverId: string
): Promise<DriverJob & { addressSnapshot?: { addressLine1: string; area: string; phoneNumber: string } }> {
  const base = getBase();
  const params = new URLSearchParams({ jobId, driverId });
  const res = await fetch(`${base}/api/jobs/single?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to fetch job");
  }
  return res.json();
}

/**
 * GET /api/drivers/jobs?driverId=xxx&date=YYYY-MM-DD
 */
export async function getDriverJobs(
  driverId: string,
  date: string
): Promise<DriverJob[]> {
  const base = getBase();
  const params = new URLSearchParams({ driverId, date });
  const res = await fetch(`${base}/api/drivers/jobs?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to fetch jobs");
  }
  return res.json();
}

/**
 * POST /api/drivers/start-shift
 */
export async function startShift(driverId: string): Promise<DriverShift> {
  const base = getBase();
  const res = await fetch(`${base}/api/drivers/start-shift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to start shift");
  }
  return res.json();
}

/**
 * POST /api/drivers/end-shift
 */
export async function endShift(driverId: string): Promise<DriverShift> {
  const base = getBase();
  const res = await fetch(`${base}/api/drivers/end-shift`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to end shift");
  }
  return res.json();
}

/**
 * POST /api/jobs/start
 */
export async function startJob(
  jobId: string,
  driverId: string
): Promise<{ id: string; jobStatus: string; startedAt: string; startedBy: string }> {
  const base = getBase();
  const res = await fetch(`${base}/api/jobs/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, driverId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to start job");
  }
  return res.json();
}

/**
 * POST /api/jobs/complete
 */
export async function completeJob(
  jobId: string,
  driverId: string
): Promise<{ id: string; jobStatus: string; completedAt: string; completedBy: string }> {
  const base = getBase();
  const res = await fetch(`${base}/api/jobs/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, driverId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to complete job");
  }
  return res.json();
}
