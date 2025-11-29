import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase/firebase-config";
import type { TimeWindowId } from "@/lib/time-windows";
import type { Booking, BookingBinItem } from "@/types/booking";
import { BOOKINGS_COLLECTION } from "@/lib/constants"; // whatever you use
import { setDocAtPath } from "@/lib/utils";

type CreateBookingParams = {
  userId: string;
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  items: BookingBinItem[];
  totalPrice: number;
};

export const createBooking = async ({
  userId,
  date,
  windowId,
  windowLabel,
  location,
  items,
  totalPrice,
}: CreateBookingParams): Promise<string> => {
  const newDocRef = doc(collection(db, BOOKINGS_COLLECTION));
  const bookingId = newDocRef.id;

  console.log(bookingId);
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
    },
    {
      merge: false,
      addTimestamps: true,
    }
  );

  return bookingId;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const bookingsQuery = query(
    collection(db, BOOKINGS_COLLECTION),
    where("userId", "==", userId),
    orderBy("date", "asc"),
    orderBy("windowId", "asc")
  );

  const snapshot = await getDocs(bookingsQuery);

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
    };
  });
};
