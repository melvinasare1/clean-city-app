/**
 * Firebase Cloud Functions Gen 2 for CleanCityApp
 * Sends push notifications via Expo Push Service when Firestore documents change
 * 
 * Requirements:
 * - Node.js 20
 * - Region: europe-west2 (London)
 * - Memory: 256MiB
 * - Timeout: 60s
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Set global options for all functions
setGlobalOptions({
  region: "europe-west2", // London
  memory: "256MiB",
  timeoutSeconds: 60,
});

// Expo Push Service endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Interface for Expo push notification message
 */
interface ExpoPushMessage {
  to: string;
  sound?: "default";
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Interface for Expo push response
 */
interface ExpoPushResponse {
  data: Array<{
    status: "ok" | "error";
    id?: string;
    message?: string;
  }>;
}

/**
 * Send push notification via Expo Push Service
 * Fails silently - does not throw errors
 * 
 * @param message - Push notification message
 * @returns Promise resolving to success status
 */
async function sendExpoPush(message: ExpoPushMessage): Promise<boolean> {
  try {
    const token = message.to;

    // Validate token format
    if (
      !token ||
      (!token.startsWith("ExponentPushToken[") &&
        !token.startsWith("ExpoPushToken["))
    ) {
      logger.warn("Invalid Expo push token format", { token: token?.substring(0, 20) });
      return false;
    }

    // Prepare message
    const payload = {
      to: token,
      sound: message.sound || "default",
      title: message.title,
      body: message.body,
      data: message.data || {},
    };

    // Send to Expo Push Service
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Expo Push Service error", {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200), // Limit log size
      });
      return false;
    }

    const result = (await response.json()) as ExpoPushResponse;

    // Check for errors in response
    if (result.data && result.data.length > 0) {
      const receipt = result.data[0];
      if (receipt.status === "error") {
        logger.warn("Expo push notification failed", {
          message: receipt.message,
        });
        return false;
      }
      logger.info("Push notification sent successfully", {
        receiptId: receipt.id,
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error("Error sending Expo push notification", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Expo push token for a driver (drivers/{uid} only).
 */
async function getDriverPushToken(driverId: string): Promise<string | null> {
  try {
    const driverDoc = await db.doc(`drivers/${driverId}`).get();
    if (!driverDoc.exists) {
      logger.warn("Driver document not found", { driverId });
      return null;
    }
    const token = driverDoc.data()?.expoPushToken;
    if (!token || typeof token !== "string") {
      logger.warn("No Expo push token found for driver", { driverId });
      return null;
    }
    return token;
  } catch (error) {
    logger.error("Error fetching push token for driver", {
      driverId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Expo push token for a customer (profiles/{uid}).
 */
async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.doc(`profiles/${userId}`).get();

    if (!userDoc.exists) {
      logger.warn("User document not found", { userId });
      return null;
    }

    const userData = userDoc.data();

    const preferences = userData?.notificationPreferences;
    if (preferences?.enabled === false) {
      logger.info("Notifications disabled for user", { userId });
      return null;
    }

    const token = userData?.expoPushToken;

    if (!token || typeof token !== "string") {
      logger.warn("No Expo push token found for user", { userId });
      return null;
    }

    return token;
  } catch (error) {
    logger.error("Error fetching push token for user", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Trigger: Job Assigned
 * Fires when jobs.assignedTo changes from null/empty to a driver UID
 * or changes to a different driver UID.
 */
export const onJobAssigned = onDocumentUpdated(
  "jobs/{jobId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const jobId = event.params.jobId;

    if (!before || !after) {
      logger.warn("Missing before/after data", { jobId });
      return;
    }

    const beforeDriverId = before?.assignedTo ?? before?.assignedWorkerId;
    const afterDriverId = after?.assignedTo ?? after?.assignedWorkerId;

    const wasUnassigned =
      !beforeDriverId || beforeDriverId === null || beforeDriverId === "";
    const isNowAssigned =
      afterDriverId && afterDriverId !== null && afterDriverId !== "";

    const driverChanged =
      beforeDriverId &&
      afterDriverId &&
      beforeDriverId !== afterDriverId;

    if ((wasUnassigned && isNowAssigned) || driverChanged) {
      logger.info("Job assigned to driver", {
        jobId,
        driverId: afterDriverId,
        wasUnassigned,
        driverChanged,
      });

      const token = await getDriverPushToken(afterDriverId as string);

      if (!token) {
        logger.warn("No push token found for driver, skipping notification", {
          driverId: afterDriverId,
          jobId,
        });
        return;
      }

      // Send push notification
      const success = await sendExpoPush({
        to: token,
        title: "New job assigned",
        body: "You've been assigned a new rubbish collection job.",
        data: {
          type: "job_assigned",
          jobId: jobId,
        },
      });

      if (success) {
        logger.info("Push notification sent to driver", {
          driverId: afterDriverId,
          jobId,
        });
      } else {
        logger.error("Failed to send push notification to driver", {
          driverId: afterDriverId,
          jobId,
        });
      }
    } else {
      logger.debug("Job update did not trigger assignment", {
        jobId,
        beforeDriverId,
        afterDriverId,
      });
    }
  }
);

/**
 * Trigger: Booking Confirmed
 * Fires when a booking's status changes to "confirmed"
 * 
 * Sends push notification to the customer
 */
export const onBookingConfirmed = onDocumentUpdated(
  "bookings/{bookingId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const bookingId = event.params.bookingId;

    if (!before || !after) {
      logger.warn("Missing before/after data", { bookingId });
      return;
    }

    const beforeStatus = before?.status;
    const afterStatus = after?.status;

    // Check if status changed to "confirmed"
    if (beforeStatus !== "confirmed" && afterStatus === "confirmed") {
      logger.info("Booking confirmed", { bookingId });

      // Get customer ID
      const customerId = after?.customerId;

      if (!customerId) {
        logger.warn("No customerId found for booking, skipping notification", {
          bookingId,
        });
        return;
      }

      // Get customer's push token
      const token = await getUserPushToken(customerId as string);

      if (!token) {
        logger.warn("No push token found for customer, skipping notification", {
          customerId,
          bookingId,
        });
        return;
      }

      // Send push notification
      const success = await sendExpoPush({
        to: token,
        title: "Booking confirmed",
        body: "Your rubbish collection booking has been confirmed.",
        data: {
          type: "booking_confirmed",
          bookingId: bookingId,
        },
      });

      if (success) {
        logger.info("Push notification sent to customer", {
          customerId,
          bookingId,
        });
      } else {
        logger.error("Failed to send push notification to customer", {
          customerId,
          bookingId,
        });
      }
    } else {
      logger.debug("Booking status change did not trigger confirmation", {
        bookingId,
        beforeStatus,
        afterStatus,
      });
    }
  }
);
