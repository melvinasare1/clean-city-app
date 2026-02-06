import admin from "firebase-admin";
import type { BookingData } from "./bookings.repository";

/**
 * Get user email from Firebase Auth by userId.
 * Falls back to booking.userEmail if Firebase Auth email is not available.
 */
export async function getUserEmail(userId: string, booking?: BookingData): Promise<string | null> {
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
