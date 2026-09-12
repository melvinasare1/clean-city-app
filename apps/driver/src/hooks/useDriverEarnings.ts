import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  auth,
  collection,
  db,
  onSnapshot,
  query,
  where,
} from '@platform/shared-firebase';
import {
  DRIVER_SHIFT_SESSIONS_COLLECTION,
  totalOnlineMsForDay,
  type DriverShiftSessionRecord,
} from '@/lib/driver-shift-session';
import { endOfDay, startOfDay } from '@/lib/earnings-period';

export type EarningsJob = {
  id: string;
  occurredAt: Date;
  dateLabel: string;
  timeLabel: string;
  bookingIdLabel: string;
  routeLabel: string;
  fare: number;
};

export type DriverEarnings = {
  totalEarnings: number;
  jobsCompleted: number;
  onlineTimeMs: number;
  averageEarnings: number;
  averageEarningsPerHour: number;
  jobs: EarningsJob[];
  loading: boolean;
  isDemo: boolean;
};

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function demoOccurredAt(hours: number, minutes: number, daysAgo = 0): Date {
  const next = new Date();
  next.setDate(next.getDate() - daysAgo);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

const DEMO_JOBS: EarningsJob[] = [
  {
    id: '2847',
    occurredAt: demoOccurredAt(18, 24),
    dateLabel: formatDateLabel(demoOccurredAt(18, 24)),
    timeLabel: '18:24',
    bookingIdLabel: '#2847',
    routeLabel: 'Accra → East Legon',
    fare: 12.5,
  },
  {
    id: '2843',
    occurredAt: demoOccurredAt(16, 3),
    dateLabel: formatDateLabel(demoOccurredAt(16, 3)),
    timeLabel: '16:03',
    bookingIdLabel: '#2843',
    routeLabel: 'Tema → Ashaiman',
    fare: 18,
  },
  {
    id: '2839',
    occurredAt: demoOccurredAt(13, 17),
    dateLabel: formatDateLabel(demoOccurredAt(13, 17)),
    timeLabel: '13:17',
    bookingIdLabel: '#2839',
    routeLabel: 'Accra → Madina',
    fare: 15.75,
  },
  {
    id: '2831',
    occurredAt: demoOccurredAt(11, 2),
    dateLabel: formatDateLabel(demoOccurredAt(11, 2)),
    timeLabel: '11:02',
    bookingIdLabel: '#2831',
    routeLabel: 'Spintex → Airport City',
    fare: 21.4,
  },
  {
    id: '2827',
    occurredAt: demoOccurredAt(9, 46),
    dateLabel: formatDateLabel(demoOccurredAt(9, 46)),
    timeLabel: '09:46',
    bookingIdLabel: '#2827',
    routeLabel: 'Kasoa → Amasaman',
    fare: 16.2,
  },
];

const DEMO_ONLINE_TIME_MS = (8 * 60 + 42) * 60 * 1000;

const DEMO_EARNINGS: Omit<DriverEarnings, 'loading'> = {
  totalEarnings: DEMO_JOBS.reduce((sum, job) => sum + job.fare, 0),
  jobsCompleted: DEMO_JOBS.length,
  onlineTimeMs: DEMO_ONLINE_TIME_MS,
  averageEarnings: 16.77,
  averageEarningsPerHour: 9.64,
  jobs: DEMO_JOBS,
  isDemo: true,
};

type BookingDoc = {
  scheduledDate?: unknown;
  totalPrice?: number;
  amountPaid?: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  address?: string;
  location?: string;
};

type SessionDoc = {
  startedAt?: unknown;
  endedAt?: unknown;
};

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

function formatTimeLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatBookingIdLabel(id: string): string {
  const shortId = id.length > 4 ? id.slice(-4) : id;
  return `#${shortId}`;
}

function routeLabelFromBooking(data: BookingDoc): string {
  const pickup = typeof data.pickupAddress === 'string' ? data.pickupAddress.trim() : '';
  const dropoff = typeof data.dropoffAddress === 'string' ? data.dropoffAddress.trim() : '';
  if (pickup && dropoff) return `${pickup} → ${dropoff}`;

  const address = typeof data.address === 'string' ? data.address.trim() : '';
  if (address) return address;
  if (pickup) return pickup;
  if (dropoff) return dropoff;

  const location = typeof data.location === 'string' ? data.location.trim() : '';
  return location;
}

function fareFromBooking(data: BookingDoc): number {
  const raw = data.totalPrice ?? data.amountPaid ?? 0;
  const fare = Number(raw);
  return Number.isFinite(fare) ? fare : 0;
}

function mapBookingDocs(
  docs: Array<{ id: string; data: () => BookingDoc }>
): EarningsJob[] {
  return docs
    .map((snap) => {
      const data = snap.data();
      const scheduled = toDate(data.scheduledDate) ?? new Date(0);
      return {
        id: snap.id,
        occurredAt: scheduled,
        dateLabel: formatDateLabel(scheduled),
        timeLabel: formatTimeLabel(scheduled),
        bookingIdLabel: formatBookingIdLabel(snap.id),
        routeLabel: routeLabelFromBooking(data),
        fare: fareFromBooking(data),
      };
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

/**
 * Completed-job earnings and summed shift-session time.
 * Pass only `date` for a single local day, or `rangeEnd` for week/month windows.
 * Multiple online periods (e.g. 3 × 3 hours) add together.
 */
export function useDriverEarnings(
  driverId: string,
  date: Date,
  rangeEnd: Date = date
): DriverEarnings {
  const [jobs, setJobs] = useState<EarningsJob[]>([]);
  const [sessions, setSessions] = useState<DriverShiftSessionRecord[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [bookingsReady, setBookingsReady] = useState(false);
  const [sessionsReady, setSessionsReady] = useState(false);

  const dayStart = useMemo(() => startOfDay(date), [date]);
  const dayEnd = useMemo(() => endOfDay(rangeEnd), [rangeEnd]);

  const hasOpenSession = sessions.some((session) => session.endedAt === null);

  useEffect(() => {
    if (!hasOpenSession) return;
    const timer = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [hasOpenSession]);

  useEffect(() => {
    const uid = auth.currentUser?.uid || driverId;
    if (!uid) {
      setJobs([]);
      setSessions([]);
      setBookingsReady(true);
      setSessionsReady(true);
      return;
    }

    setBookingsReady(false);
    setSessionsReady(false);

    const startMs = dayStart.getTime();
    const endMs = dayEnd.getTime();

    // Equality-only constraints so rules can prove driverId == auth.uid.
    // Date windows are applied in memory (range filters + OR rules get denied).
    const bookingsUnsub = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('driverId', '==', uid),
        where('status', '==', 'completed')
      ),
      (snapshot) => {
        const mapped = mapBookingDocs(snapshot.docs).filter((job) => {
          const at = job.occurredAt.getTime();
          return at >= startMs && at <= endMs;
        });
        setJobs(mapped);
        setBookingsReady(true);
      },
      (error) => {
        console.error('[useDriverEarnings] bookings query failed', error);
        setJobs([]);
        setBookingsReady(true);
      }
    );

    const sessionsUnsub = onSnapshot(
      query(
        collection(db, DRIVER_SHIFT_SESSIONS_COLLECTION),
        where('driverId', '==', uid)
      ),
      (snapshot) => {
        const nextSessions: DriverShiftSessionRecord[] = [];
        for (const sessionDoc of snapshot.docs) {
          const data = sessionDoc.data() as SessionDoc;
          const startedAt = toDate(data.startedAt);
          if (!startedAt) continue;
          nextSessions.push({
            startedAt,
            endedAt: toDate(data.endedAt),
          });
        }
        setSessions(nextSessions);
        setNowMs(Date.now());
        setSessionsReady(true);
      },
      (error) => {
        console.error('[useDriverEarnings] shift sessions query failed', error);
        setSessions([]);
        setSessionsReady(true);
      }
    );

    return () => {
      bookingsUnsub();
      sessionsUnsub();
    };
  }, [dayEnd, dayStart, driverId]);

  const onlineTimeMs = useMemo(
    () => totalOnlineMsForDay(sessions, dayStart, dayEnd, new Date(nowMs)),
    [dayEnd, dayStart, nowMs, sessions]
  );

  return useMemo(() => {
    const loading = !bookingsReady || !sessionsReady;
    if (__DEV__ && bookingsReady && jobs.length === 0) {
      return { ...DEMO_EARNINGS, loading: false };
    }

    const totalEarnings = jobs.reduce((sum, job) => sum + job.fare, 0);
    const jobsCompleted = jobs.length;
    const hoursOnline = onlineTimeMs / 3_600_000;
    return {
      totalEarnings,
      jobsCompleted,
      onlineTimeMs,
      averageEarnings: jobsCompleted === 0 ? 0 : totalEarnings / jobsCompleted,
      averageEarningsPerHour: hoursOnline > 0 ? totalEarnings / hoursOnline : 0,
      jobs,
      loading,
      isDemo: false,
    };
  }, [bookingsReady, jobs, onlineTimeMs, sessionsReady]);
}
