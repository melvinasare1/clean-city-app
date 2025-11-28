import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firebase-config';
import { TIME_WINDOWS, TimeWindowId } from '@/lib/time-windows';

const BOOKINGS_COLLECTION = 'bookings';

export type BookingStatus = 'pending' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  userId: string;
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  status: BookingStatus;
  createdAt: Timestamp | null;
}

type CreateBookingParams = {
  userId: string;
  date: string;
  windowId: TimeWindowId;
  location: string;
};

export const createBooking = async ({
  userId,
  date,
  windowId,
  location,
}: CreateBookingParams): Promise<string> => {
  const windowConfig = TIME_WINDOWS.find((window) => window.id === windowId);
  if (!windowConfig) {
    throw new Error(`Invalid time window: ${windowId}`);
  }

  const docRef = await addDoc(collection(db, BOOKINGS_COLLECTION), {
    userId,
    date,
    windowId,
    windowLabel: windowConfig.label,
    location,
    status: 'pending' as BookingStatus,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const bookingsQuery = query(
    collection(db, BOOKINGS_COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(bookingsQuery);
  const windowOrder = TIME_WINDOWS.map((window) => window.id);

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId as string,
        date: data.date as string,
        windowId: data.windowId as TimeWindowId,
        windowLabel: data.windowLabel as string,
        location: data.location as string,
        status: data.status as BookingStatus,
        createdAt: (data.createdAt as Timestamp) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.date === b.date) {
        return (
          windowOrder.indexOf(a.windowId) - windowOrder.indexOf(b.windowId)
        );
      }
      return a.date.localeCompare(b.date);
    });
};

