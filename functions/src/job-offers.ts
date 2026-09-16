import { CloudTasksClient } from "@google-cloud/tasks";
import { FieldValue, Timestamp, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import {
  DEFAULT_DRIVER_PRIORITY,
  PRIORITY_ACCEPT_DELTA,
  PRIORITY_CANCEL_DELTA,
  PRIORITY_DECLINE_DELTA,
  PRIORITY_EXPIRE_DELTA,
  clampPriority,
  toDate,
} from "./priority";
import {
  bookingStatusForMissedJob,
  canCompleteJob,
  canMarkJobMissed,
  parseMissedPickupInput,
} from "./job-outcome";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const OFFER_TTL_MS = 10_000;
const TASKS_LOCATION = "europe-west2";
const DEFAULT_QUEUE = "job-offer-expiry";
const REGION = "europe-west2";
const OFFER_ASSIGNMENT_STATUSES = new Set(["assigned", "reassigned"]);
// Kept in sync by hand with DRIVER_COMMISSION_RATE in apps/driver/src/lib/earnings.ts —
// functions/ can't depend on the driver app's workspace packages.
const DRIVER_COMMISSION_RATE = 0.8;
// Kept in sync by hand with CANCEL_REASONS in apps/driver/src/lib/trip-overflow.ts —
// functions/ can't depend on the driver app's workspace packages.
const CANCEL_REASON_CODES = new Set([
  "NO_SPACE",
  "CUSTOMER_UNAVAILABLE",
  "CUSTOMER_REQUESTED",
  "SAFETY_ACCESS",
  "OTHER",
]);

function assertApprovedDriver(data: Record<string, unknown> | undefined): void {
  if (!data) {
    throw new HttpsError("permission-denied", "Not authorized");
  }
  if (data.status === "suspended") {
    throw new HttpsError("permission-denied", "Driver account is suspended");
  }
  const approved = data.status === "approved" || data.isActive === true;
  if (!approved) {
    throw new HttpsError("permission-denied", "Driver account is pending approval");
  }
}

function getProjectId(): string {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId as string;
  } catch {
    return "";
  }
}

function expireJobOfferUrl(project: string, location: string): string {
  return (
    process.env.EXPIRE_JOB_OFFER_URL ||
    `https://${location}-${project}.cloudfunctions.net/expireJobOffer`
  );
}

function tasksClient(): CloudTasksClient {
  return new CloudTasksClient();
}

async function enqueueExpireTask(
  jobId: string,
  driverId: string,
  expiresAt: Timestamp
): Promise<string | null> {
  const project = getProjectId();
  const location = process.env.JOB_OFFER_TASKS_LOCATION || TASKS_LOCATION;
  const queue = process.env.JOB_OFFER_TASKS_QUEUE || DEFAULT_QUEUE;
  const url = expireJobOfferUrl(project, location);
  const serviceAccountEmail =
    process.env.TASKS_INVOKER_SA || `${project}@appspot.gserviceaccount.com`;
  const client = tasksClient();
  const parent = client.queuePath(project, location, queue);
  const taskId = `expire-${jobId}-${expiresAt.toMillis()}`;

  const [task] = await client.createTask({
    parent,
    task: {
      name: client.taskPath(project, location, queue, taskId),
      scheduleTime: {
        seconds: expiresAt.seconds,
        nanos: expiresAt.nanoseconds,
      },
      httpRequest: {
        httpMethod: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify({ jobId, driverId })).toString("base64"),
        oidcToken: {
          serviceAccountEmail,
          audience: url,
        },
      },
    },
  });

  return task.name ?? null;
}

async function deleteExpireTask(taskName: unknown): Promise<void> {
  if (typeof taskName !== "string" || !taskName) return;
  try {
    await tasksClient().deleteTask({ name: taskName });
  } catch (error) {
    logger.warn("Could not delete job-offer Cloud Task", {
      taskName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function requireJobId(data: unknown): string {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const jobId = record.jobId;
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw new HttpsError("invalid-argument", "jobId is required.");
  }
  return jobId.trim();
}

async function bumpPriorityInTransaction(
  tx: Transaction,
  driverId: string,
  delta: number
): Promise<void> {
  const driverRef = db.doc(`drivers/${driverId}`);
  const snap = await tx.get(driverRef);
  if (!snap.exists) return;
  const raw = snap.data()?.priority;
  const current =
    typeof raw === "number" && Number.isFinite(raw)
      ? clampPriority(raw)
      : DEFAULT_DRIVER_PRIORITY;
  tx.update(driverRef, {
    priority: clampPriority(current + delta),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function isUnexpired(offerExpiresAt: unknown): boolean {
  const expires = toDate(offerExpiresAt);
  return Boolean(expires && expires.getTime() > Date.now());
}

function isOfferAssignmentStatus(status: unknown): boolean {
  return typeof status === "string" && OFFER_ASSIGNMENT_STATUSES.has(status);
}

// TODO(rollout): once every driver is confirmed on the app build that always sends
// cancelReasonCode, remove the "no code sent at all" fallback below and make it a hard
// invalid-argument like an unrecognized code already is. Kept soft for now so the current
// live app (which calls this with just { jobId }) doesn't break the moment this deploys.
function requireCancelReason(data: unknown): { code: string; note: string | null } {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const code = record.cancelReasonCode;
  if (code === undefined) {
    return { code: "OTHER", note: "Pre-update client (no reason captured)" };
  }
  if (typeof code !== "string" || !CANCEL_REASON_CODES.has(code)) {
    throw new HttpsError("invalid-argument", "A valid cancelReasonCode is required.");
  }
  const noteRaw = record.cancelReasonNote;
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;
  if (code === "OTHER" && !note) {
    throw new HttpsError(
      "invalid-argument",
      "cancelReasonNote is required when cancelReasonCode is OTHER."
    );
  }
  return { code, note };
}

function optionalPhotoUrl(data: unknown): string | null {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const photoUrl = record.photoUrl;
  return typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null;
}

/** Points at the open assignmentHistory doc for the current attempt, if one exists yet. */
function historyRefFor(
  jobRef: DocumentReference,
  job: Record<string, unknown>
): DocumentReference | null {
  const id = job.currentAssignmentId;
  return typeof id === "string" && id ? jobRef.collection("assignmentHistory").doc(id) : null;
}

/**
 * Creates a new assignmentHistory doc for the newly-assigned driver and points
 * jobs/{jobId}.currentAssignmentId at it. If the previous driver's attempt was still
 * open (a direct reassignment without going through cancelAcceptedJob first), closes
 * it out as "reassigned_by_admin" first. Called from onJobAssigned.
 */
export async function recordJobAssignment(
  jobId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  driverChanged: boolean
): Promise<void> {
  const jobRef = db.doc(`jobs/${jobId}`);
  const afterDriverId = (after.assignedTo ?? after.assignedWorkerId) as string;

  if (driverChanged && typeof before.currentAssignmentId === "string") {
    await jobRef
      .collection("assignmentHistory")
      .doc(before.currentAssignmentId)
      .update({
        endedAt: FieldValue.serverTimestamp(),
        outcome: "reassigned_by_admin",
      });
  }

  const historyRef = jobRef.collection("assignmentHistory").doc();
  await historyRef.set({
    driverId: afterDriverId,
    assignedAt: after.assignedAt ?? FieldValue.serverTimestamp(),
    assignedBy: (after.assignedBy as string | undefined) ?? null,
    acceptedAt: null,
    arrivedAt: null,
    jobSheetViewedAt: null,
    pickupConfirmedAt: null,
    pickupPhotoUrl: null,
    endedAt: null,
    outcome: null,
    cancelReasonCode: null,
    cancelReasonNote: null,
  });

  await jobRef.update({ currentAssignmentId: historyRef.id });
}

/**
 * Clamp drivers/{uid}.priority to 0–100 on every write. Missing values become 100.
 */
export const clampDriverPriority = onDocumentWritten(
  { document: "drivers/{uid}", region: REGION },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const current = after.data()?.priority;
    const clamped = clampPriority(current);
    if (current === clamped) return;
    await after.ref.update({ priority: clamped });
  }
);

/**
 * Start the 10s offer window on a newly assigned/reassigned job.
 * Called from onJobAssigned so push + expiry stay on one trigger.
 */
export async function startJobOfferWindow(
  jobId: string,
  driverId: string
): Promise<void> {
  const jobRef = db.doc(`jobs/${jobId}`);
  const snap = await jobRef.get();
  if (!snap.exists) return;
  const job = snap.data() || {};
  if (job.assignedTo !== driverId) return;
  if (!isOfferAssignmentStatus(job.assignmentStatus)) return;

  const expiresAt = Timestamp.fromMillis(Date.now() + OFFER_TTL_MS);
  let taskName: string | null = null;
  try {
    taskName = await enqueueExpireTask(jobId, driverId, expiresAt);
  } catch (error) {
    logger.error("Failed to enqueue job-offer expiry task", {
      jobId,
      driverId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await jobRef.update({
    offerExpiresAt: expiresAt,
    ...(taskName ? { offerTaskName: taskName } : { offerTaskName: FieldValue.delete() }),
  });
}

export const acceptJobOffer = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);
  let taskName: unknown;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    taskName = job.offerTaskName;
    if (job.assignedTo !== uid) {
      throw new HttpsError("permission-denied", "This offer is not assigned to you.");
    }
    if (!isOfferAssignmentStatus(job.assignmentStatus)) {
      throw new HttpsError("failed-precondition", "Offer is no longer available.");
    }
    if (!isUnexpired(job.offerExpiresAt)) {
      throw new HttpsError("deadline-exceeded", "Offer has expired.");
    }

    await bumpPriorityInTransaction(tx, uid, PRIORITY_ACCEPT_DELTA);
    const historyRef = historyRefFor(jobRef, job);
    const alreadyAccepted = Boolean(job.acceptedAt);
    tx.update(jobRef, {
      assignmentStatus: "accepted",
      offerExpiresAt: FieldValue.delete(),
      offerTaskName: FieldValue.delete(),
      ...(alreadyAccepted ? {} : { acceptedAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (historyRef && !alreadyAccepted) {
      tx.update(historyRef, { acceptedAt: FieldValue.serverTimestamp() });
    }
  });

  await deleteExpireTask(taskName);
  return { ok: true };
});

export const declineJobOffer = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);
  let taskName: unknown;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    taskName = job.offerTaskName;
    if (job.assignedTo !== uid) {
      throw new HttpsError("permission-denied", "This offer is not assigned to you.");
    }
    if (!isOfferAssignmentStatus(job.assignmentStatus)) {
      throw new HttpsError("failed-precondition", "Offer is no longer available.");
    }
    if (!isUnexpired(job.offerExpiresAt)) {
      throw new HttpsError("deadline-exceeded", "Offer has expired.");
    }

    await bumpPriorityInTransaction(tx, uid, PRIORITY_DECLINE_DELTA);
    tx.update(jobRef, {
      assignedTo: null,
      assignmentStatus: "unassigned",
      declinedBy: FieldValue.arrayUnion(uid),
      offerExpiresAt: FieldValue.delete(),
      offerTaskName: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await deleteExpireTask(taskName);
  return { ok: true };
});

export const cancelAcceptedJob = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const { code: cancelReasonCode, note: cancelReasonNote } = requireCancelReason(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    if (job.assignedTo !== uid) {
      throw new HttpsError("permission-denied", "This job is not assigned to you.");
    }
    const accepted = job.assignmentStatus === "accepted";
    const inProgress = job.jobStatus === "in_progress";
    if (job.jobStatus === "missed" || job.jobStatus === "completed") {
      throw new HttpsError("failed-precondition", "This job is already closed.");
    }
    if (!accepted && !inProgress) {
      throw new HttpsError("failed-precondition", "Job is not accepted or in progress.");
    }

    await bumpPriorityInTransaction(tx, uid, PRIORITY_CANCEL_DELTA);
    const historyRef = historyRefFor(jobRef, job);
    if (historyRef) {
      tx.update(historyRef, {
        endedAt: FieldValue.serverTimestamp(),
        outcome: "cancelled_by_driver",
        cancelReasonCode,
        cancelReasonNote,
      });
    }
    tx.update(jobRef, {
      assignedTo: null,
      assignmentStatus: "unassigned",
      jobStatus: "scheduled",
      startedAt: FieldValue.delete(),
      startedBy: FieldValue.delete(),
      arrivedAt: FieldValue.delete(),
      pickupConfirmedAt: FieldValue.delete(),
      acceptedAt: FieldValue.delete(),
      jobSheetViewedAt: FieldValue.delete(),
      pickupPhotoUrl: FieldValue.delete(),
      currentAssignmentId: FieldValue.delete(),
      offerExpiresAt: FieldValue.delete(),
      offerTaskName: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

export const completeJob = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    if (job.assignedTo !== uid) {
      throw new HttpsError("permission-denied", "This job is not assigned to you.");
    }
    const completable = canCompleteJob(job.jobStatus);
    if (!completable.ok) {
      throw new HttpsError("failed-precondition", completable.message);
    }

    const driverRef = db.doc(`drivers/${uid}`);
    const driverSnap = await tx.get(driverRef);
    assertApprovedDriver(driverSnap.data());
    const driverName =
      typeof driverSnap.data()?.name === "string" ? (driverSnap.data()?.name as string) : null;

    const historyRef = historyRefFor(jobRef, job);
    if (historyRef) {
      tx.update(historyRef, {
        endedAt: FieldValue.serverTimestamp(),
        outcome: "completed",
      });
    }

    tx.update(jobRef, {
      jobStatus: "completed",
      completedAt: FieldValue.serverTimestamp(),
      completedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(driverRef, {
      jobsCompletedCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const bookingId = typeof job.bookingId === "string" ? job.bookingId : null;
    if (bookingId) {
      tx.update(db.doc(`bookings/${bookingId}`), {
        status: "completed",
        driverId: uid,
        driverName,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const items = Array.isArray(job.items) ? job.items : [];
    const grossAmount = items.reduce((sum: number, item: unknown) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const value = Number(record.totalPrice ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const driverAmount = grossAmount * DRIVER_COMMISSION_RATE;
    const platformAmount = grossAmount - driverAmount;

    const earningsRef = driverRef.collection("earnings").doc();
    tx.set(earningsRef, {
      jobId,
      bookingId,
      grossAmount,
      commissionRate: DRIVER_COMMISSION_RATE,
      driverAmount,
      platformAmount,
      earnedAt: FieldValue.serverTimestamp(),
      customerName: typeof job.customerName === "string" ? job.customerName : null,
      location: typeof job.location === "string" ? job.location : null,
      payoutStatus: "pending",
      payoutBatchId: null,
    });
  });

  return { ok: true };
});

export const markJobMissed = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const parsed = parseMissedPickupInput(request.data);
  if (!parsed.ok) {
    throw new HttpsError("invalid-argument", parsed.message);
  }
  const jobRef = db.doc(`jobs/${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    if (job.assignedTo !== uid) {
      throw new HttpsError("permission-denied", "This job is not assigned to you.");
    }
    const markable = canMarkJobMissed(job.jobStatus);
    if (!markable.ok) {
      throw new HttpsError("failed-precondition", markable.message);
    }

    const driverRef = db.doc(`drivers/${uid}`);
    const driverSnap = await tx.get(driverRef);
    assertApprovedDriver(driverSnap.data());
    const driverName =
      typeof driverSnap.data()?.name === "string" ? (driverSnap.data()?.name as string) : null;

    const recordedAt = Timestamp.now();
    const completionOutcome = {
      type: "missed" as const,
      reason: parsed.reason,
      note: parsed.note,
      recordedAt,
      recordedBy: uid,
      photoUrl: parsed.photoUrl,
    };

    const historyRef = historyRefFor(jobRef, job);
    if (historyRef) {
      tx.update(historyRef, {
        endedAt: recordedAt,
        outcome: "missed",
        completionOutcome,
      });
    }

    tx.update(jobRef, {
      jobStatus: "missed",
      completionOutcome,
      updatedAt: recordedAt,
    });

    const bookingId = typeof job.bookingId === "string" ? job.bookingId : null;
    if (bookingId) {
      tx.update(db.doc(`bookings/${bookingId}`), {
        status: bookingStatusForMissedJob(),
        driverId: uid,
        driverName,
        completionOutcome,
        updatedAt: recordedAt,
      });
    }
  });

  return { ok: true };
});

function assertAssignedInProgress(job: Record<string, unknown>, uid: string): void {
  if (job.assignedTo !== uid) {
    throw new HttpsError("permission-denied", "This job is not assigned to you.");
  }
  if (job.jobStatus !== "in_progress") {
    throw new HttpsError("failed-precondition", "Job must be in progress.");
  }
}

export const markArrived = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    assertAssignedInProgress(job, uid);
    const driverSnap = await tx.get(db.doc(`drivers/${uid}`));
    assertApprovedDriver(driverSnap.data());
    if (job.arrivedAt) {
      return;
    }

    const historyRef = historyRefFor(jobRef, job);
    tx.update(jobRef, {
      arrivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (historyRef) {
      tx.update(historyRef, { arrivedAt: FieldValue.serverTimestamp() });
    }
  });

  return { ok: true };
});

export const logJobSheetViewed = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    assertAssignedInProgress(job, uid);
    if (job.jobSheetViewedAt) {
      return;
    }

    const historyRef = historyRefFor(jobRef, job);
    tx.update(jobRef, {
      jobSheetViewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (historyRef) {
      tx.update(historyRef, { jobSheetViewedAt: FieldValue.serverTimestamp() });
    }
  });

  return { ok: true };
});

export const confirmPickup = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const jobId = requireJobId(request.data);
  // photoUrl is optional here for backward compatibility with clients on the pre-photo
  // build; a follow-up deploy tightens this to required once the app rollout lands.
  const photoUrl = optionalPhotoUrl(request.data);
  const jobRef = db.doc(`jobs/${jobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Job not found.");
    }
    const job = snap.data() || {};
    assertAssignedInProgress(job, uid);
    if (job.pickupConfirmedAt) {
      return;
    }

    const historyRef = historyRefFor(jobRef, job);
    tx.update(jobRef, {
      pickupConfirmedAt: FieldValue.serverTimestamp(),
      ...(photoUrl ? { pickupPhotoUrl: photoUrl } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (historyRef) {
      tx.update(historyRef, {
        pickupConfirmedAt: FieldValue.serverTimestamp(),
        ...(photoUrl ? { pickupPhotoUrl: photoUrl } : {}),
      });
    }
  });

  return { ok: true };
});

async function assertCloudTasksOidc(req: { get: (name: string) => string | undefined }): Promise<void> {
  if (process.env.FUNCTIONS_EMULATOR === "true") return;

  const header = req.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const project = getProjectId();
  const location = process.env.JOB_OFFER_TASKS_LOCATION || TASKS_LOCATION;
  const audience = expireJobOfferUrl(project, location);
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: token, audience });
  const email = ticket.getPayload()?.email || "";
  if (!email.endsWith("gserviceaccount.com")) {
    throw new Error("Caller is not a service account");
  }
}

function parseExpirePayload(body: unknown): { jobId: string; driverId: string } | null {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  if (!data || typeof data !== "object") return null;
  const jobId = (data as { jobId?: unknown }).jobId;
  const driverId = (data as { driverId?: unknown }).driverId;
  if (typeof jobId !== "string" || typeof driverId !== "string") return null;
  return { jobId, driverId };
}

/**
 * Cloud Tasks target. Not for clients — requires OIDC from a service account.
 */
export const expireJobOffer = onRequest(
  { region: REGION, invoker: "private", cors: false },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
      }
      await assertCloudTasksOidc(req);
      const payload = parseExpirePayload(req.body);
      if (!payload) {
        res.status(400).json({ error: "jobId and driverId are required" });
        return;
      }

      const jobRef = db.doc(`jobs/${payload.jobId}`);
      let acted = false;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        if (!snap.exists) return;
        const job = snap.data() || {};
        if (!isOfferAssignmentStatus(job.assignmentStatus)) return;
        if (job.assignedTo !== payload.driverId) return;
        const expires = toDate(job.offerExpiresAt);
        if (!expires || expires.getTime() > Date.now()) return;

        await bumpPriorityInTransaction(tx, payload.driverId, PRIORITY_EXPIRE_DELTA);
        tx.update(jobRef, {
          assignedTo: null,
          assignmentStatus: "unassigned",
          declinedBy: FieldValue.arrayUnion(payload.driverId),
          offerExpiresAt: FieldValue.delete(),
          offerTaskName: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        acted = true;
      });

      res.status(200).json({ ok: true, expired: acted });
    } catch (error) {
      logger.error("expireJobOffer failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof Error ? error.message : String(error);
      const unauthorized =
        /unauthorized|bearer|token|audience|service account/i.test(message);
      res.status(unauthorized ? 401 : 500).json({
        error: unauthorized ? "Unauthorized" : "Internal error",
      });
    }
  }
);
