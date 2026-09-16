import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "./firebase-admin";
import { getBookingById } from "../paystack/bookings";
import {
  ensureJobForOneTimeBooking,
  findJobIdForBooking,
} from "../paystack/subscription-helpers";
import { isFulfillmentComplete, type PaymentSource } from "./payment-integrity";
import {
  PaymentFulfillmentError,
  executePaidOneTimeFulfillment,
} from "./payment-fulfillment-core";

export { PaymentFulfillmentError };

const PAYMENTS_COLLECTION = "payments";

export async function fulfillPaidOneTimeBooking(
  firestore: Firestore,
  params: {
    bookingId: string;
    source: PaymentSource;
    reference?: string;
    webhookEvent?: string;
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
    Timestamp: typeof Timestamp;
    createJob?: typeof ensureJobForOneTimeBooking;
    getBooking?: typeof getBookingById;
  }
): Promise<{ jobId: string; created: boolean; alreadyFulfilled: boolean }> {
  const loadBooking = params.getBooking ?? getBookingById;
  const createJob = params.createJob ?? ensureJobForOneTimeBooking;

  return executePaidOneTimeFulfillment({
    bookingId: params.bookingId,
    source: params.source,
    reference: params.reference,
    webhookEvent: params.webhookEvent,
    stripeCheckoutSessionId: params.stripeCheckoutSessionId,
    stripePaymentIntentId: params.stripePaymentIntentId,
    loadBooking,
    createJob: async (jobParams) =>
      createJob(firestore, {
        ...jobParams,
        Timestamp: params.Timestamp as any,
      }),
    writeBookingPaid: async ({
      bookingId,
      jobId,
      source,
      reference,
      stripeCheckoutSessionId,
      stripePaymentIntentId,
    }) => {
      await firestore.collection("bookings").doc(bookingId).set(
        {
          payment: {
            status: "paid",
            jobId,
            source,
            fulfillmentStatus: "fulfilled",
            paidAt: FieldValue.serverTimestamp(),
            ...(reference ? { reference } : {}),
            ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
            ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
          },
          status: "confirmed",
        },
        { merge: true }
      );
    },
    writePaymentReconciled: async ({
      reference,
      bookingId,
      jobId,
      source,
      webhookEvent,
      stripeCheckoutSessionId,
      stripePaymentIntentId,
    }) => {
      await firestore.collection(PAYMENTS_COLLECTION).doc(reference).set(
        {
          status: "success",
          bookingId,
          jobId,
          fulfillmentStatus: "fulfilled",
          source,
          ...(source === "paystack" ? { paystackStatus: "success" } : {}),
          ...(source === "stripe"
            ? {
                stripeStatus: "paid",
                ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
                ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
              }
            : {}),
          ...(webhookEvent
            ? { lastWebhookEvent: webhookEvent, webhookProcessed: true }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    },
  });
}

export async function readFulfillmentState(
  firestore: Firestore,
  bookingId: string
): Promise<{ complete: boolean; jobId: string | null }> {
  const booking = await getBookingById(bookingId);
  const jobId = await findJobIdForBooking(firestore, bookingId);
  const payment = (booking?.payment || {}) as Record<string, unknown>;
  let jobBookingId: string | null = null;
  if (jobId) {
    const jobSnap = await firestore.collection("jobs").doc(jobId).get();
    jobBookingId =
      jobSnap.exists && typeof jobSnap.data()?.bookingId === "string"
        ? String(jobSnap.data()?.bookingId)
        : null;
  }
  return {
    jobId,
    complete: isFulfillmentComplete({
      bookingPaymentStatus: typeof payment.status === "string" ? payment.status : null,
      bookingJobId: typeof payment.jobId === "string" ? payment.jobId : null,
      jobId,
      jobBookingId,
      expectedBookingId: bookingId,
    }),
  };
}
