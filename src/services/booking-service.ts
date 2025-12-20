// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - native-only module types
import firestore from "@react-native-firebase/firestore";
import type { TimeWindowId } from "@/lib/time-windows";
import type {
  Booking,
  BookingBinItem,
  BookingRecurrence,
  BookingType,
} from "@/types/booking";
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
  const newDocRef = firestore().collection(BOOKINGS_COLLECTION).doc();
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
  const snapshot = await firestore()
    .collection(BOOKINGS_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("date", "asc")
    .orderBy("windowId", "asc")
    .get();

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
