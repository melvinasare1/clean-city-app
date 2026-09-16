/**
 * Pure payment → job integrity rules.
 * Job creation must follow verified Paystack evidence or an explicit admin/free path.
 */

export type PaymentSource = "paystack" | "stripe" | "admin" | "free";

export type FulfillmentStatus = "pending" | "fulfilled" | "failed";

export type WebhookProcessResult =
  | { ok: true; duplicate: boolean; jobId?: string }
  | { ok: false; retry: boolean; error: string };

export function oneTimeJobDocId(bookingId: string): string {
  return `one_time_${bookingId}`;
}

export function isSuccessfulPaystackStatus(status: unknown): boolean {
  return String(status || "").toLowerCase() === "success";
}

export function isChargeSuccessEvent(eventName: unknown): boolean {
  return eventName === "charge.success";
}

export function isSuccessfulStripePaymentStatus(status: unknown): boolean {
  return String(status || "").toLowerCase() === "paid";
}

export function isStripeFulfillmentEvent(eventName: unknown): boolean {
  return (
    eventName === "checkout.session.completed" ||
    eventName === "checkout.session.async_payment_succeeded"
  );
}

/**
 * Bind a Paystack transaction to a booking using server-side evidence only.
 * Client-supplied bookingId is accepted only when it matches metadata or the payments doc.
 */
export function resolveEvidenceBookingId(input: {
  clientBookingId?: string | null;
  metadataBookingId?: string | null;
  paymentDocBookingId?: string | null;
  referenceLoadedFromBookingId?: string | null;
}): { bookingId: string } | { error: string } {
  const client = trimId(input.clientBookingId);
  const fromMeta = trimId(input.metadataBookingId);
  const fromPayment = trimId(input.paymentDocBookingId);
  const fromStoredRef = trimId(input.referenceLoadedFromBookingId);
  const evidence = fromMeta || fromPayment || fromStoredRef;
  if (!evidence) {
    return {
      error:
        "No server-side bookingId on this transaction. Client bookingId is not sufficient.",
    };
  }
  if (client && client !== evidence) {
    return {
      error: "Payment reference does not belong to the requested booking.",
    };
  }
  return { bookingId: evidence };
}

export function shouldCreateOneTimeJob(input: {
  verifiedPaid: boolean;
  bookingType?: string | null;
}): boolean {
  if (!input.verifiedPaid) return false;
  const type = String(input.bookingType || "one_time");
  return type !== "subscription";
}

export function isFulfillmentComplete(input: {
  bookingPaymentStatus?: string | null;
  bookingJobId?: string | null;
  jobId?: string | null;
  jobBookingId?: string | null;
  expectedBookingId: string;
}): boolean {
  if (input.bookingPaymentStatus !== "paid") return false;
  if (!input.jobId || !input.bookingJobId) return false;
  if (input.jobId !== input.bookingJobId) return false;
  if (input.jobBookingId !== input.expectedBookingId) return false;
  return true;
}

export function webhookHttpStatus(result: WebhookProcessResult): number {
  if ("retry" in result && result.ok === false) {
    return result.retry ? 500 : 400;
  }
  return 200;
}

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
