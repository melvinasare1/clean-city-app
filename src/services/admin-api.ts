/**
 * Admin panel API client. All writes go through backend; no direct Firestore.
 */
import { getApiBaseUrl } from "@/lib/apiBase";

const getBase = () => getApiBaseUrl();

export interface AdminDriver {
  id: string;
  name: string;
  isActive: boolean;
}

export type AssignmentStatus = "unassigned" | "assigned" | "accepted" | "reassigned";

export interface AdminJob {
  id: string;
  scheduledDate: string;
  location: string;
  windowLabel: string;
  windowId: string;
  paymentStatus: string;
  jobStatus: string;
  assignmentStatus: AssignmentStatus;
  assignedTo: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  items?: Array<{ id: string; type: string; quantity: number; unitPrice: number; totalPrice: number }>;
  addressSnapshot?: { addressLine1: string; area: string; phoneNumber: string };
}

/**
 * GET /api/drivers
 */
export async function getDrivers(): Promise<AdminDriver[]> {
  const base = getBase();
  const res = await fetch(`${base}/api/drivers`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to fetch drivers");
  }
  return res.json();
}

/**
 * GET /api/jobs/list?date=YYYY-MM-DD&assignmentStatus=&driverId=&windowId=
 * Date is required.
 */
export async function getJobsList(params: {
  date: string;
  assignmentStatus?: string;
  driverId?: string;
  windowId?: string;
}): Promise<AdminJob[]> {
  const base = getBase();
  const search = new URLSearchParams();
  search.set("date", params.date);
  if (params.assignmentStatus) search.set("assignmentStatus", params.assignmentStatus);
  if (params.driverId) search.set("driverId", params.driverId);
  if (params.windowId) search.set("windowId", params.windowId);
  const res = await fetch(`${base}/api/jobs/list?${search.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to fetch jobs");
  }
  return res.json();
}

/**
 * POST /api/jobs/assign
 */
export async function assignJob(params: {
  jobId: string;
  driverId: string;
  adminId: string;
}): Promise<AdminJob> {
  const base = getBase();
  const res = await fetch(`${base}/api/jobs/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || "Failed to assign job");
  }
  return res.json();
}
