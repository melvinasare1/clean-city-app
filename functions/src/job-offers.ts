import { CloudTasksClient } from "@google-cloud/tasks";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import {
  PRIORITY_ACCEPT_DELTA,
  PRIORITY_CANCEL_DELTA,
  PRIORITY_DECLINE_DELTA,
  PRIORITY_EXPIRE_DELTA,
  clampPriority,
  toDate,
} from "./priority";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const OFFER_TTL_MS = 10_000;
const TASKS_LOCATION = "europe-west2";
const DEFAULT_QUEUE = "job-offer-expiry";
const REGION = "europe-west2";

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
  bookingId: string,
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
  const taskId = `expire-${bookingId}-${expiresAt.toMillis()}`;

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
        body: Buffer.from(JSON.stringify({ bookingId, driverId })).toString("base64"),
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

function requireBookingId(data: unknown): string {
  const bookingId =
    data && typeof data === "object" && "bookingId" in data
      ? (data as { bookingId?: unknown }).bookingId
      : undefined;
  if (typeof bookingId !== "string" || !bookingId.trim()) {
    throw new HttpsError("invalid-argument", "bookingId is required.");
  }
  return bookingId.trim();
}

async function bumpPriorityInTransaction(
  tx: Transaction,
  driverId: string,
  delta: number
): Promise<void> {
  const driverRef = db.doc(`drivers/${driverId}`);
  const snap = await tx.get(driverRef);
  if (!snap.exists) return;
  const next = clampPriority(clampPriority(snap.data()?.priority) + delta);
  tx.update(driverRef, {
    priority: next,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function isUnexpired(offerExpiresAt: unknown): boolean {
  const expires = toDate(offerExpiresAt);
  return Boolean(expires && expires.getTime() > Date.now());
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
 * When a booking is newly assigned to a driver, start a 10s offer window
 * and enqueue expireJobOffer for that instant.
 */
export const onBookingAssigned = onDocumentUpdated(
  { document: "bookings/{bookingId}", region: REGION },
  async (event) => {
    const change = event.data;
    const before = change?.before.data();
    const after = change?.after.data();
    const bookingId = event.params.bookingId;
    if (!change || !before || !after) return;

    const afterDriverId =
      typeof after.driverId === "string" && after.driverId ? after.driverId : "";
    const beforeDriverId =
      typeof before.driverId === "string" && before.driverId ? before.driverId : "";
    const driverNewlySet = Boolean(afterDriverId) && afterDriverId !== beforeDriverId;
    if (!driverNewlySet || after.status !== "assigned") return;

    const expiresAt = Timestamp.fromMillis(Date.now() + OFFER_TTL_MS);
    let taskName: string | null = null;
    try {
      taskName = await enqueueExpireTask(bookingId, afterDriverId, expiresAt);
    } catch (error) {
      logger.error("Failed to enqueue job-offer expiry task", {
        bookingId,
        driverId: afterDriverId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await change.after.ref.update({
      offerExpiresAt: expiresAt,
      ...(taskName ? { offerTaskName: taskName } : { offerTaskName: FieldValue.delete() }),
    });
  }
);

export const acceptJobOffer = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const bookingId = requireBookingId(request.data);
  const bookingRef = db.doc(`bookings/${bookingId}`);
  let taskName: unknown;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = snap.data() || {};
    taskName = booking.offerTaskName;
    if (booking.driverId !== uid) {
      throw new HttpsError("permission-denied", "This offer is not assigned to you.");
    }
    if (booking.status !== "assigned") {
      throw new HttpsError("failed-precondition", "Offer is no longer available.");
    }
    if (!isUnexpired(booking.offerExpiresAt)) {
      throw new HttpsError("deadline-exceeded", "Offer has expired.");
    }

    await bumpPriorityInTransaction(tx, uid, PRIORITY_ACCEPT_DELTA);
    tx.update(bookingRef, {
      status: "in_progress",
      offerExpiresAt: FieldValue.delete(),
      offerTaskName: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await deleteExpireTask(taskName);
  return { ok: true };
});

export const declineJobOffer = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const bookingId = requireBookingId(request.data);
  const bookingRef = db.doc(`bookings/${bookingId}`);
  let taskName: unknown;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = snap.data() || {};
    taskName = booking.offerTaskName;
    if (booking.driverId !== uid) {
      throw new HttpsError("permission-denied", "This offer is not assigned to you.");
    }
    if (booking.status !== "assigned") {
      throw new HttpsError("failed-precondition", "Offer is no longer available.");
    }
    if (!isUnexpired(booking.offerExpiresAt)) {
      throw new HttpsError("deadline-exceeded", "Offer has expired.");
    }

    await bumpPriorityInTransaction(tx, uid, PRIORITY_DECLINE_DELTA);
    tx.update(bookingRef, {
      driverId: null,
      driverName: null,
      status: "pending",
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
  const bookingId = requireBookingId(request.data);
  const bookingRef = db.doc(`bookings/${bookingId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = snap.data() || {};
    if (booking.driverId !== uid) {
      throw new HttpsError("permission-denied", "This job is not assigned to you.");
    }
    if (booking.status !== "in_progress") {
      throw new HttpsError("failed-precondition", "Job is not in progress.");
    }

    await bumpPriorityInTransaction(tx, uid, PRIORITY_CANCEL_DELTA);
    tx.update(bookingRef, {
      driverId: null,
      driverName: null,
      status: "pending",
      offerExpiresAt: FieldValue.delete(),
      offerTaskName: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

export const completeBooking = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = request.auth.uid;
  const bookingId = requireBookingId(request.data);
  const bookingRef = db.doc(`bookings/${bookingId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Booking not found.");
    }
    const booking = snap.data() || {};
    if (booking.driverId !== uid) {
      throw new HttpsError("permission-denied", "This job is not assigned to you.");
    }
    if (booking.status !== "in_progress") {
      throw new HttpsError("failed-precondition", "Job is not in progress.");
    }

    tx.update(bookingRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
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

function parseExpirePayload(body: unknown): { bookingId: string; driverId: string } | null {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  if (!data || typeof data !== "object") return null;
  const bookingId = (data as { bookingId?: unknown }).bookingId;
  const driverId = (data as { driverId?: unknown }).driverId;
  if (typeof bookingId !== "string" || typeof driverId !== "string") return null;
  return { bookingId, driverId };
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
        res.status(400).json({ error: "bookingId and driverId are required" });
        return;
      }

      const bookingRef = db.doc(`bookings/${payload.bookingId}`);
      let acted = false;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists) return;
        const booking = snap.data() || {};
        if (booking.status !== "assigned") return;
        if (booking.driverId !== payload.driverId) return;
        const expires = toDate(booking.offerExpiresAt);
        if (!expires || expires.getTime() > Date.now()) return;

        await bumpPriorityInTransaction(tx, payload.driverId, PRIORITY_EXPIRE_DELTA);
        tx.update(bookingRef, {
          driverId: null,
          driverName: null,
          status: "pending",
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
