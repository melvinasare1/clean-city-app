import { firestore } from "../config/firebaseAdmin";

const BOOKINGS_COLLECTION = "bookings";

export interface BookingData {
  id: string;
  userId: string;
  userEmail?: string; // Optional: some bookings may store email directly
  totalPrice: number;
  payment: {
    status: string;
    reference?: string;
  };
  [key: string]: any;
}

/**
 * Get a booking by ID from Firestore.
 */
export async function getBookingById(bookingId: string): Promise<BookingData | null> {
  const docRef = firestore.collection(BOOKINGS_COLLECTION).doc(bookingId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
  } as BookingData;
}
