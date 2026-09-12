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

export type EarningsJob = {
  id: string;
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
  jobs: EarningsJob[];
  loading: boolean;
  isDemo: boolean;
};

const DEMO_JOBS: EarningsJob[] = [
  {
    id: '1048',
    timeLabel: '09:14',
    bookingIdLabel: '#1048',
    routeLabel: 'Camden → Islington',
    fare: 18.5,
  },
  {
    id: '1051',
    timeLabel: '10:37',
    bookingIdLabel: '#1051',
    routeLabel: 'Shoreditch → Hackney',
    fare: 24,
  },
  {
    id: '1057',
    timeLabel: '12:08',
    bookingIdLabel: '#1057',
    routeLabel: 'Soho → Bloomsbury',
    fare: 16.75,
  },
  {
    id: '1064',
    timeLabel: '14:22',
    bookingIdLabel: '#1064',
    routeLabel: 'Brixton → Clapham',
    fare: 31.2,
  },
  {
    id: '1070',
    timeLabel: '16:10',
    bookingIdLabel: '#1070',
    routeLabel: 'Wembley → Harrow',
    fare: 19.95,
  },
  {
    id: '1074',
    timeLabel: '17:45',
    bookingIdLabel: '#1074',
    routeLabel: 'Ealing → Acton',
    fare: 18,
  },
];

const DEMO_EARNINGS: Omit<DriverEarnings, 'loading' | 'onlineTimeMs'> = {
  totalEarnings: 128.4,
  jobsCompleted: 6,
  averageEarnings: 22.53,
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

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

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
        timeLabel: formatTimeLabel(scheduled),
        bookingIdLabel: formatBookingIdLabel(snap.id),
        routeLabel: routeLabelFromBooking(data),
        fare: fareFromBooking(data),
        sortMs: scheduled.getTime(),
      };
    })
    .sort((a, b) => a.sortMs - b.sortMs)
    .map(({ sortMs: _sortMs, ...job }) => job);
}

/**
 * Completed-job earnings and summed shift-session time for one calendar day.
 * Multiple online periods (e.g. 3 × 3 hours) add together.
 */
export function useDriverEarnings(driverId: string, date: Date): DriverEarnings {
  const [jobs, setJobs] = useState<EarningsJob[]>([]);
  const [sessions, setSessions] = useState<DriverShiftSessionRecord[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [bookingsReady, setBookingsReady] = useState(false);
  const [sessionsReady, setSessionsReady] = useState(false);

  const dayStart = useMemo(() => startOfDay(date), [date]);
  const dayEnd = useMemo(() => endOfDay(date), [date]);

  const hasOpenSession = sessions.some((session) => session.endedAt === null);

  useEffect(() => {
    if (!hasOpenSession) return;
    const timer = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [hasOpenSession]);

  useEffect(() => {
    const uid = driverId || auth.currentUser?.uid || '';
    if (!uid) {
      setJobs([]);
      setSessions([]);
      setBookingsReady(true);
      setSessionsReady(true);
      return;
    }

    setBookingsReady(false);
    setSessionsReady(false);

    const startTs = Timestamp.fromDate(dayStart);
    const endTs = Timestamp.fromDate(dayEnd);

    const bookingsUnsub = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('driverId', '==', uid),
        where('status', '==', 'completed'),
        where('scheduledDate', '>=', startTs),
        where('scheduledDate', '<=', endTs)
      ),
      (snapshot) => {
        setJobs(mapBookingDocs(snapshot.docs));
        setBookingsReady(true);
      },
      (error) => {
        console.error('[useDriverEarnings] bookings query failed', error);
        setJobs([]);
        setBookingsReady(true);
      }
    );

    // Query by driverId only so the constraint matches Firestore rules
    // (`resource.data.driverId == request.auth.uid`). Day overlap is applied client-side.
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
      return { ...DEMO_EARNINGS, onlineTimeMs, loading: false };
    }

    const totalEarnings = jobs.reduce((sum, job) => sum + job.fare, 0);
    const jobsCompleted = jobs.length;
    return {
      totalEarnings,
      jobsCompleted,
      onlineTimeMs,
      averageEarnings: jobsCompleted === 0 ? 0 : totalEarnings / jobsCompleted,
      jobs,
      loading,
      isDemo: false,
    };
  }, [bookingsReady, jobs, onlineTimeMs, sessionsReady]);
}
