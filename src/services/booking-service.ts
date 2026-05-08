import {
  collection,
  doc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TimeWindowId } from "@/lib/time-windows";
import type {
  Booking,
  BookingBinItem,
  BookingRecurrence,
  BookingType,
  PaymentStatus,
} from "@/types/booking";
import { BOOKINGS_COLLECTION } from "@/lib/constants";
import { setDocAtPath } from "@/lib/utils";
import { rewardReferralIfEligible } from "@/services/referralService";
import { initializePayment, verifyPayment, verifyBookingPaymentWithBackend } from "@/services/payments";

type CreateBookingParams = {
  userId: string;
  userEmail?: string; // Optional: stored for payment processing fallback
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
  userEmail,
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
      ...(userEmail ? { userEmail } : {}), // Store email if provided for payment processing
      date,
      windowId,
      windowLabel,
      location,
      items,
      totalPrice,
      status: "pending",
      type,
      ...(recurrence ? { recurrence } : {}),
      payment: {
        status: "unpaid",
      },
    },
    {
      merge: false,
      addTimestamps: true,
    }
  );

  return bookingId;
};

/**
 * Update a booking with partial fields (e.g. subscriptionId after subscription is created).
 */
export const updateBooking = async (
  bookingId: string,
  updates: Partial<Pick<Booking, "subscriptionId" | "payment">>
): Promise<void> => {
  await setDocAtPath(
    [BOOKINGS_COLLECTION, bookingId],
    updates,
    { merge: true, addTimestamps: true }
  );
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
      userEmail: data.userEmail, // Optional: for payment processing fallback
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
      payment: data.payment ?? { status: "unpaid" },
    };
  });
};

/**
 * Get a single booking by ID.
 */
export const getBookingById = async (bookingId: string): Promise<Booking | null> => {
  const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
  const snapshot = await getDoc(bookingRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Partial<Omit<Booking, "id">>;
  return {
    id: snapshot.id,
    userId: data.userId ?? "",
    userEmail: data.userEmail, // Optional: for payment processing fallback
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
    payment: data.payment ?? { status: "unpaid" },
  };
};

/**
 * Initialize payment for an existing booking.
 * Simplified: sends only bookingId to backend.
 * Backend looks up booking details, user email, and initializes Paystack.
 * Updates Firestore with reference and returns authorization URL.
 * 
 * IMPORTANT: This function stores the BACKEND-RETURNED Paystack reference in Firestore,
 * not a locally-generated reference. This ensures verification always succeeds.
 */
export const initiatePaymentForBooking = async (
  bookingId: string
): Promise<{ authorizationUrl: string; reference: string }> => {
  console.log("=".repeat(60));
  console.log("[Payment Init] 🚀 Starting payment initialization");
  console.log("[Payment Init] Booking ID:", bookingId);
  
  // Fetch the booking locally to check status
  const booking = await getBookingById(bookingId);

  if (!booking) {
    console.error("[Payment Init] ❌ Booking not found:", bookingId);
    throw new Error("Booking not found");
  }

  console.log("[Payment Init] Current payment status:", booking.payment.status);
  console.log("[Payment Init] Current payment reference:", booking.payment.reference || "(none)");

  // If already paid, don't allow re-initialization
  if (booking.payment.status === "paid") {
    console.error("[Payment Init] ❌ Booking already paid");
    throw new Error("Booking is already paid ✅");
  }

  // Call backend to initialize Paystack payment (simplified: only bookingId)
  const bookingIdStr =
    bookingId != null && bookingId !== "" ? String(bookingId).trim() : "";
  if (!bookingIdStr) {
    throw new Error("bookingId is required to initialize payment");
  }
  console.log("[Payment Init] 📞 Calling backend initialize endpoint...");

  let paymentInit;
  try {
    paymentInit = await initializePayment({
      paymentType: "one_time",
      bookingId: bookingIdStr,
    });
  } catch (error: any) {
    console.error("[Payment Init] ❌ Backend initialize failed:", error.message);
    throw new Error(`Failed to initialize payment: ${error.message}`);
  }

  // Validate backend response
  if (!paymentInit.authorizationUrl) {
    console.error("[Payment Init] ❌ Missing authorizationUrl in response");
    throw new Error("Payment provider did not return authorization URL");
  }

  if (!paymentInit.reference) {
    console.error("[Payment Init] ❌ Missing reference in response");
    throw new Error("Payment provider did not return payment reference");
  }

  const backendReference = paymentInit.reference;
  const authorizationUrl = paymentInit.authorizationUrl;

  console.log("[Payment Init] ✅ Backend returned reference:", backendReference);
  console.log("[Payment Init] ✅ Backend returned authorizationUrl:", authorizationUrl);

  // Handle reference history for retries
  const oldReference = booking.payment.reference;
  const oldStatus = booking.payment.status;
  const referenceHistory = booking.payment.referenceHistory || [];
  
  // If there's an old reference and it's different from the new one, archive it
  // Only archive if the previous status wasn't "paid" (avoid archiving successful payments)
  const shouldArchiveOldReference = 
    oldReference && 
    oldReference !== backendReference && 
    oldStatus !== ("paid" as PaymentStatus) &&
    !referenceHistory.includes(oldReference);

  if (shouldArchiveOldReference) {
    referenceHistory.push(oldReference);
    console.log("[Payment Init] 📝 Archived old reference to history:", oldReference);
  }

  // Update Firestore with backend-returned reference BEFORE opening payment URL
  console.log("[Payment Init] 💾 Updating Firestore with backend reference...");
  
  try {
    // Build payment update object - only include referenceHistory if it has entries
    const paymentUpdate: any = {
      status: "initiated",
      reference: backendReference, // ⭐ Store the backend reference, NOT a local one
      authorizationUrl: authorizationUrl,
      amount: booking.totalPrice,
      initiatedAt: serverTimestamp(),
    };

    // Only add referenceHistory if it has entries (avoid undefined)
    if (referenceHistory.length > 0) {
      paymentUpdate.referenceHistory = referenceHistory;
    }

    await setDocAtPath(
      [BOOKINGS_COLLECTION, bookingId],
      {
        payment: paymentUpdate,
      },
      {
        merge: true,
        addTimestamps: false,
      }
    );
    
    console.log("[Payment Init] ✅ Firestore updated successfully");
    console.log("[Payment Init] Saved reference:", backendReference);
    console.log("[Payment Init] Reference history:", referenceHistory.length > 0 ? referenceHistory : "(empty)");
  } catch (error: any) {
    console.error("[Payment Init] ❌ Firestore update failed:", error.message);
    throw new Error("Failed to save payment details to database");
  }

  console.log("[Payment Init] ✅ Payment initialization complete");
  console.log("=".repeat(60));

  return {
    authorizationUrl,
    reference: backendReference,
  };
};

/**
 * Mark a booking as paid after successful payment verification.
 */
export const markBookingAsPaid = async (
  bookingId: string,
  paymentReference?: string
): Promise<void> => {
  await setDocAtPath(
    [BOOKINGS_COLLECTION, bookingId],
    {
      payment: {
        status: "paid",
        ...(paymentReference != null && paymentReference !== ""
          ? { reference: paymentReference }
          : {}),
      },
    },
    {
      merge: true,
      addTimestamps: false,
    }
  );
};

/**
 * Verify payment status for a booking using the separate Paystack backend.
 * If payment is confirmed as paid:
 * - Updates Firestore: payment.status = "paid", payment.paidAt = serverTimestamp()
 * - Optionally sets booking.status = "confirmed"
 * Returns true if payment is verified as successful, false otherwise.
 * 
 * @param bookingId - The booking ID to verify
 * @param throwOnError - If true, throws errors instead of returning false (default: false)
 */
export const verifyBookingPayment = async (
  bookingId: string,
  throwOnError: boolean = false
): Promise<boolean> => {
  try {
    console.log(`[Verify Booking] Starting verification for booking ${bookingId}`);
    
    const booking = await getBookingById(bookingId);
    
    if (!booking) {
      const error = new Error("Booking not found");
      if (throwOnError) throw error;
      console.warn("[Verify Booking] Booking not found:", bookingId);
      return false;
    }

    console.log(`[Verify Booking] Current payment status: ${booking.payment.status}`);

    // If already marked as paid, no need to verify
    if (booking.payment.status === "paid") {
      console.log("[Verify Booking] Already marked as paid");
      return true;
    }

    try {
      // Verify payment with separate backend (only needs bookingId)
      const verifyResult = await verifyBookingPaymentWithBackend(bookingId);
      
      console.log(`[Verify Booking] Backend response - ok: ${verifyResult.ok}, paid: ${verifyResult.paid}`);
      
      if (verifyResult.ok && verifyResult.paid === true) {
        console.log(`[Verify Booking] Payment confirmed as paid, updating Firestore...`);
        
        // Update Firestore booking document
        try {
          await setDocAtPath(
            [BOOKINGS_COLLECTION, bookingId],
            {
              payment: {
                status: "paid",
                paidAt: serverTimestamp(),
                ...(verifyResult.reference != null && verifyResult.reference !== ""
                  ? { reference: verifyResult.reference }
                  : {}),
              },
              // Optionally update booking status
              status: "confirmed",
            },
            {
              merge: true,
              addTimestamps: false,
            }
          );
          console.log(`[Verify Booking] ✅ Booking ${bookingId} marked as paid in Firestore`);
          return true;
        } catch (firestoreError: any) {
          console.error("[Verify Booking] ❌ Failed to update Firestore:", firestoreError);
          if (throwOnError) {
            throw new Error("Failed to update booking payment status in database");
          }
          return false;
        }
      }
      
      console.log(`[Verify Booking] Payment not confirmed as paid`);
      return false;
    } catch (verifyError: any) {
      // Payment verification failed (network error, API error, etc.)
      console.error(`[Verify Booking] ❌ Verification failed:`, verifyError.message);
      
      if (throwOnError) {
        throw verifyError;
      }
      
      // Return false instead of throwing - allow app to continue
      return false;
    }
  } catch (error: any) {
    console.error("[Verify Booking] ❌ Error in verifyBookingPayment:", error);
    if (throwOnError) {
      throw error;
    }
    return false;
  }
};

/**
 * Called after a booking has been successfully paid for.
 * Updates booking payment status and triggers referral rewards (if eligible).
 */
export const handleBookingPaymentSuccess = async (
  bookingId: string,
  referredUserId: string | null | undefined,
  paymentReference?: string
): Promise<void> => {
  await markBookingAsPaid(bookingId, paymentReference);

  // Trigger referral rewards if eligible
  if (referredUserId) {
    try {
      await rewardReferralIfEligible(referredUserId);
    } catch (error) {
      console.error(
        "Failed to reward referral after booking payment success:",
        error
      );
    }
  }
};

/**
 * Delete a booking. Only allows deletion if booking is NOT paid.
 * Safety check: Verifies payment.status !== "paid" before deletion.
 * 
 * @param bookingId - The booking ID to delete
 * @throws Error if booking is paid or not found
 */
export const deleteBooking = async (bookingId: string): Promise<void> => {
  console.log(`[Delete Booking] Starting deletion for booking ${bookingId}`);
  
  // Fetch the booking first to verify it exists and is not paid
  const booking = await getBookingById(bookingId);
  
  if (!booking) {
    console.error("[Delete Booking] ❌ Booking not found:", bookingId);
    throw new Error("Booking not found");
  }
  
  // Safety check: Only allow deletion if NOT paid
  if (booking.payment.status === "paid") {
    console.error("[Delete Booking] ❌ Cannot delete paid booking:", bookingId);
    throw new Error("Paid bookings cannot be deleted");
  }
  
  // Additional safety: Only allow deletion for explicit unpaid/initiated statuses
  const allowedStatuses: PaymentStatus[] = ["unpaid", "initiated"];
  if (!allowedStatuses.includes(booking.payment.status)) {
    console.error("[Delete Booking] ❌ Invalid payment status for deletion:", booking.payment.status);
    throw new Error("This booking cannot be deleted");
  }
  
  console.log(`[Delete Booking] Payment status: ${booking.payment.status} - deletion allowed`);
  
  // Delete the booking from Firestore
  try {
    const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
    await deleteDoc(bookingRef);
    console.log(`[Delete Booking] ✅ Booking ${bookingId} deleted successfully`);
  } catch (error: any) {
    console.error("[Delete Booking] ❌ Failed to delete booking:", error);
    throw new Error("Failed to delete booking. Please try again.");
  }
};

