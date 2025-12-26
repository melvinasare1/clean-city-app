import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  type Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TimeWindowId } from "@/lib/time-windows";
import type {
  Booking,
  BookingBinItem,
  BookingRecurrence,
  BookingType,
} from "@/types/booking";
import { BOOKINGS_COLLECTION } from "@/lib/constants";
import { setDocAtPath } from "@/lib/utils";

type CreateBookingParams = {
  userId: string;
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  items: BookingBinItem[];
  totalPrice: number;
  type?: BookingType;
  recurrence?: BookingRecurrence;
};

export const createBooking = async ({
  userId,
  date,
  windowId,
  windowLabel,
  location,
  items,
  totalPrice,
  type = "one_off",
  recurrence,
}: CreateBookingParams): Promise<string> => {
  const bookingsRef = collection(db, BOOKINGS_COLLECTION);
  const newDocRef = doc(bookingsRef);
  const bookingId = newDocRef.id;

  await setDocAtPath(
    [BOOKINGS_COLLECTION, bookingId],
    {
      userId,
      date,
      windowId,
      windowLabel,
      location,
      items,
      totalPrice,
      status: "pending",
      type,
      ...(recurrence ? { recurrence } : {}),
    },
    {
      merge: false,
      addTimestamps: true,
    }
  );

  return bookingId;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const bookingsRef = collection(db, BOOKINGS_COLLECTION);
  const q = query(
    bookingsRef,
    where("userId", "==", userId),
    orderBy("date", "asc"),
    orderBy("windowId", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Partial<Omit<Booking, "id">>;
    return {
      id: docSnap.id,
      userId: data.userId ?? "",
      date: data.date ?? "",
      windowId: data.windowId as TimeWindowId,
      windowLabel: data.windowLabel ?? "",
      location: data.location ?? "",
      items: data.items ?? [],
      totalPrice: data.totalPrice ?? 0,
      status: (data.status ?? "pending") as Booking["status"],
      createdAt: (data.createdAt as Booking["createdAt"]) ?? null,
      type: (data.type ?? "one_off") as BookingType,
      recurrence: data.recurrence as BookingRecurrence | undefined,
    };
  });
};
