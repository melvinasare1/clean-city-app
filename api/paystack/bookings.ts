import admin from "firebase-admin";

const BOOKINGS_COLLECTION = "bookings";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      console.error("Failed to parse Firebase service account JSON:", error);
    }
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not configured - Firebase features unavailable");
  }
}

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
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized");
  }

  const firestore = admin.firestore();
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

/**
 * Get user email from Firebase Auth by userId.
 * Falls back to booking.userEmail if Firebase Auth email is not available.
 */
export async function getUserEmail(userId: string, booking?: BookingData): Promise<string | null> {
  if (!admin.apps.length) {
    console.error("Firebase Admin not initialized");
    // If we have a booking with userEmail, use that as fallback
    if (booking?.userEmail) {
      console.log(`Using booking.userEmail as fallback: ${booking.userEmail}`);
      return booking.userEmail;
    }
    return null;
  }

  try {
    console.log(`Fetching email from Firebase Auth for userId: ${userId}`);
    const userRecord = await admin.auth().getUser(userId);
    
    if (userRecord.email) {
      console.log(`Found email in Firebase Auth: ${userRecord.email}`);
      return userRecord.email;
    }
    
    // No email in Firebase Auth, try booking fallback
    if (booking?.userEmail) {
      console.log(`Firebase Auth has no email, using booking.userEmail: ${booking.userEmail}`);
      return booking.userEmail;
    }
    
    console.warn(`No email found for userId ${userId} in Firebase Auth or booking`);
    return null;
  } catch (error) {
    console.error(`Error fetching user from Firebase Auth for userId ${userId}:`, error);
    
    // Try booking fallback on error
    if (booking?.userEmail) {
      console.log(`Firebase Auth error, using booking.userEmail: ${booking.userEmail}`);
      return booking.userEmail;
    }
    
    return null;
  }
}

export interface SubscriptionData {
  id: string;
  userId: string;
  email?: string;
  amount?: number;
  collectionDayOfWeek?: string;
  [key: string]: any;
}

/**
 * Get a subscription by ID from Firestore.
 */
export async function getSubscriptionById(
  subscriptionId: string
): Promise<SubscriptionData | null> {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized");
  }
  const firestore = admin.firestore();
  const docRef = firestore.collection(SUBSCRIPTIONS_COLLECTION).doc(subscriptionId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  return { id: snapshot.id, ...data } as SubscriptionData;
}
