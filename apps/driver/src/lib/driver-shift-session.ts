import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@platform/shared-firebase';
import { Timestamp } from 'firebase/firestore';

export const DRIVER_SHIFT_SESSIONS_COLLECTION = 'driverShiftSessions';

export type DriverShiftSessionRecord = {
  startedAt: Date;
  endedAt: Date | null;
};

const openSessionByDriver = new Map<string, string>();

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = (value as { toDate?: () => Date }).toDate?.();
    if (maybe instanceof Date && !Number.isNaN(maybe.getTime())) return maybe;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function overlappingSessionMs(
  startedAt: Date,
  endedAt: Date | null,
  dayStart: Date,
  dayEnd: Date,
  now: Date = new Date()
): number {
  const sessionEnd = endedAt ?? now;
  const clipStart = Math.max(startedAt.getTime(), dayStart.getTime());
  const clipEnd = Math.min(sessionEnd.getTime(), dayEnd.getTime());
  return Math.max(0, clipEnd - clipStart);
}

export function totalOnlineMsForDay(
  sessions: DriverShiftSessionRecord[],
  dayStart: Date,
  dayEnd: Date,
  now: Date = new Date()
): number {
  return sessions.reduce((sum, session) => {
    if (session.endedAt && session.endedAt.getTime() < dayStart.getTime()) return sum;
    if (session.startedAt.getTime() > dayEnd.getTime()) return sum;
    return sum + overlappingSessionMs(session.startedAt, session.endedAt, dayStart, dayEnd, now);
  }, 0);
}

async function findOpenSessionIds(driverId: string): Promise<string[]> {
  const openSessions = await getDocs(
    query(
      collection(db, DRIVER_SHIFT_SESSIONS_COLLECTION),
      where('driverId', '==', driverId),
      where('endedAt', '==', null),
      limit(10)
    )
  );
  return openSessions.docs.map((sessionDoc) => sessionDoc.id);
}

/**
 * Starts a new online session, or reuses an already-open one so overlapping
 * Go Online taps do not double-count.
 */
export async function startDriverShiftSession(driverId: string): Promise<string | null> {
  if (!driverId) return null;

  const openIds = await findOpenSessionIds(driverId);
  if (openIds.length > 0) {
    const sessionId = openIds[0];
    openSessionByDriver.set(driverId, sessionId);
    return sessionId;
  }

  const sessionRef = await addDoc(collection(db, DRIVER_SHIFT_SESSIONS_COLLECTION), {
    driverId,
    startedAt: serverTimestamp(),
    endedAt: null,
    durationMs: null,
  });
  openSessionByDriver.set(driverId, sessionRef.id);
  return sessionRef.id;
}

export async function endOpenDriverShiftSessions(
  driverId: string,
  endedAt: Date = new Date()
): Promise<void> {
  if (!driverId) return;

  const knownId = openSessionByDriver.get(driverId);
  const sessionIds = Array.from(new Set([...(knownId ? [knownId] : []), ...(await findOpenSessionIds(driverId))]));
  const endedAtMs = endedAt.getTime();

  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const sessionRef = doc(db, DRIVER_SHIFT_SESSIONS_COLLECTION, sessionId);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) return;
      if (snap.data()?.endedAt) return;

      const started = toDate(snap.data()?.startedAt);
      const durationMs = started ? Math.max(0, endedAtMs - started.getTime()) : 0;
      await updateDoc(sessionRef, {
        endedAt: Timestamp.fromDate(endedAt),
        durationMs,
      });
    })
  );

  openSessionByDriver.delete(driverId);
}
