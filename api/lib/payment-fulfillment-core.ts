import type { JobAddressSnapshot, JobItemSnapshot } from "../paystack/payment-and-job-types";
import {
  shouldCreateOneTimeJob,
  type PaymentSource,
} from "./payment-integrity";

export class PaymentFulfillmentError extends Error {
  retry: boolean;
  constructor(message: string, retry = true) {
    super(message);
    this.name = "PaymentFulfillmentError";
    this.retry = retry;
  }
}

export type BookingLike = {
  userId: string;
  type?: string;
  items?: unknown;
  location?: unknown;
  metadata?: unknown;
  addressLine1?: unknown;
  area?: unknown;
  phoneNumber?: unknown;
  date?: unknown;
  windowId?: unknown;
  windowLabel?: unknown;
};

export type CreateJobResult = { jobId: string; created: boolean };

function jobItemsFromBooking(booking: BookingLike): JobItemSnapshot[] {
  const items = booking.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((i: any, idx: number) => ({
      id:
        i?.id ??
        (i?.type ? String(i.type).replace(/\s+/g, "_").toUpperCase() : `ITEM_${idx}`),
      type: String(i?.type ?? ""),
      quantity: Number(i?.quantity) ?? 0,
      unitPrice: Number(i?.unitPrice) ?? 0,
      totalPrice: Number(i?.totalPrice) ?? 0,
    }))
    .filter((i) => i.type);
}

function addressFromBooking(booking: BookingLike): {
  location: string;
  addressSnapshot: JobAddressSnapshot;
  windowId: string;
  windowLabel: string;
  scheduledDate: Date;
} {
  const loc = booking.location != null ? String(booking.location) : "";
  const meta =
    booking.metadata && typeof booking.metadata === "object"
      ? (booking.metadata as Record<string, unknown>)
      : {};
  const addressSnapshot: JobAddressSnapshot = {
    addressLine1: String(meta.addressLine1 ?? booking.addressLine1 ?? loc ?? ""),
    area: String(meta.area ?? booking.area ?? ""),
    phoneNumber: String(meta.phoneNumber ?? booking.phoneNumber ?? ""),
  };
  const bookingDate = booking.date;
  let scheduledDate = new Date();
  if (typeof bookingDate === "string") scheduledDate = new Date(bookingDate);
  else if (bookingDate instanceof Date) scheduledDate = bookingDate;
  return {
    location: loc,
    addressSnapshot,
    windowId: String(booking.windowId ?? "morning"),
    windowLabel: String(booking.windowLabel ?? ""),
    scheduledDate,
  };
}

export async function executePaidOneTimeFulfillment(input: {
  bookingId: string;
  source: PaymentSource;
  reference?: string;
  webhookEvent?: string;
  loadBooking: (bookingId: string) => Promise<BookingLike | null>;
  createJob: (params: {
    bookingId: string;
    userId: string;
    scheduledDate: Date;
    items: JobItemSnapshot[];
    location: string;
    addressSnapshot: JobAddressSnapshot;
    windowId: string;
    windowLabel: string;
    paymentReference?: string;
    paymentMethod?: string;
  }) => Promise<CreateJobResult>;
  writeBookingPaid: (params: {
    bookingId: string;
    jobId: string;
    source: PaymentSource;
    reference?: string;
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
  }) => Promise<void>;
  writePaymentReconciled?: (params: {
    reference: string;
    bookingId: string;
    jobId: string;
    source: PaymentSource;
    webhookEvent?: string;
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
  }) => Promise<void>;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
}): Promise<{ jobId: string; created: boolean; alreadyFulfilled: boolean }> {
  const booking = await input.loadBooking(input.bookingId);
  if (!booking) {
    throw new PaymentFulfillmentError(`Booking ${input.bookingId} not found`, false);
  }

  if (
    !shouldCreateOneTimeJob({
      verifiedPaid: true,
      bookingType: booking.type,
    })
  ) {
    return { jobId: "", created: false, alreadyFulfilled: true };
  }

  const snapshot = addressFromBooking(booking);
  let created = false;
  let jobId: string;
  try {
    const result = await input.createJob({
      bookingId: input.bookingId,
      userId: booking.userId,
      scheduledDate: snapshot.scheduledDate,
      items: jobItemsFromBooking(booking),
      location: snapshot.location,
      addressSnapshot: snapshot.addressSnapshot,
      windowId: snapshot.windowId,
      windowLabel: snapshot.windowLabel,
      paymentReference: input.reference,
      paymentMethod: input.source === "stripe" ? "card" : "momo",
    });
    jobId = result.jobId;
    created = result.created;
  } catch (err: any) {
    throw new PaymentFulfillmentError(
      err?.message || `Failed to create job for booking ${input.bookingId}`,
      true
    );
  }

  if (!jobId) {
    throw new PaymentFulfillmentError(
      `Job id missing after fulfillment for booking ${input.bookingId}`,
      true
    );
  }

  try {
    await input.writeBookingPaid({
      bookingId: input.bookingId,
      jobId,
      source: input.source,
      reference: input.reference,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
    });
  } catch (err: any) {
    throw new PaymentFulfillmentError(
      err?.message || `Failed to mark booking ${input.bookingId} paid after job ${jobId}`,
      true
    );
  }

  if (input.reference && input.writePaymentReconciled) {
    try {
      await input.writePaymentReconciled({
        reference: input.reference,
        bookingId: input.bookingId,
        jobId,
        source: input.source,
        webhookEvent: input.webhookEvent,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
      });
    } catch (err: any) {
      throw new PaymentFulfillmentError(
        err?.message || `Failed to persist payment ${input.reference} reconciliation fields`,
        true
      );
    }
  }

  return { jobId, created, alreadyFulfilled: !created };
}
