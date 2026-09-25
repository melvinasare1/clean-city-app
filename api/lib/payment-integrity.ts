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

export type PublicPaymentStatus = "confirmed" | "processing" | "failed" | "not_found";

export type PublicPaymentType = "one_time" | "subscription" | "store";

export type PublicPaymentStatusResponse = {
  status: PublicPaymentStatus;
  type?: PublicPaymentType;
  amount?: number;
  currency?: string;
  summary?: string;
};

/** Exact browser origins allowed to call verify in status mode. No wildcards. */
export const STATUS_MODE_ALLOWED_ORIGINS = [
  "https://cleancitygh.com",
  "https://www.cleancitygh.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

export function statusModeAllowOrigin(origin: string | undefined | null): string | null {
  if (!origin) return null;
  const value = origin.trim();
  return (STATUS_MODE_ALLOWED_ORIGINS as readonly string[]).includes(value) ? value : null;
}

export type PaymentStatusEvidence = {
  reference: string;
  paymentDocExists: boolean;
  paymentType?: string | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  paymentItems?: unknown;
  paystackFound: boolean;
  paystackStatus?: string | null;
  /** Paystack transaction amount in minor units (pesewas). */
  paystackAmountMinor?: number | null;
  paystackCurrency?: string | null;
  metadataType?: string | null;
  metadataFrequency?: string | null;
  booking?: {
    paymentStatus?: string | null;
    paymentReference?: string | null;
    date?: string | null;
    windowLabel?: string | null;
    items?: unknown;
    type?: string | null;
  } | null;
  subscription?: {
    paymentStatus?: string | null;
    paymentReference?: string | null;
    lastPaymentReference?: string | null;
    collectionFrequency?: string | null;
    items?: unknown;
  } | null;
  order?: {
    status?: string | null;
    paymentStatus?: string | null;
    paymentReference?: string | null;
    items?: unknown;
  } | null;
};

export function mapPublicPaymentType(type: unknown): PublicPaymentType | undefined {
  const value = String(type || "").trim().toLowerCase();
  if (value === "one_time" || value === "one_off") return "one_time";
  if (value === "subscription") return "subscription";
  if (value === "store_order" || value === "store") return "store";
  return undefined;
}

export function resolvePublicPaymentType(
  evidence: PaymentStatusEvidence
): PublicPaymentType | undefined {
  return (
    mapPublicPaymentType(evidence.paymentType) ||
    mapPublicPaymentType(evidence.metadataType) ||
    (evidence.subscription ? "subscription" : undefined) ||
    (evidence.order ? "store" : undefined) ||
    (evidence.booking
      ? evidence.booking.type === "subscription"
        ? "subscription"
        : "one_time"
      : undefined)
  );
}

export function isDomainRecordPaid(
  type: PublicPaymentType,
  evidence: PaymentStatusEvidence
): boolean {
  const reference = evidence.reference.trim();
  if (!reference) return false;
  if (type === "one_time") {
    const booking = evidence.booking;
    return (
      booking?.paymentStatus === "paid" && booking.paymentReference === reference
    );
  }
  if (type === "subscription") {
    const sub = evidence.subscription;
    if (!sub) return false;
    if (sub.lastPaymentReference === reference) return true;
    return sub.paymentStatus === "paid" && sub.paymentReference === reference;
  }
  const order = evidence.order;
  if (!order || order.paymentReference !== reference) return false;
  return order.status === "paid" || order.paymentStatus === "paid";
}

export function resolvePublicPaymentStatus(input: {
  referenceKnown: boolean;
  recordPaid: boolean;
  paystackStatus?: string | null;
}): PublicPaymentStatus {
  if (input.recordPaid) return "confirmed";
  const paystackStatus = String(input.paystackStatus || "").toLowerCase();
  if (
    paystackStatus === "failed" ||
    paystackStatus === "abandoned" ||
    paystackStatus === "reversed"
  ) {
    return "failed";
  }
  if (
    paystackStatus === "success" ||
    paystackStatus === "pending" ||
    paystackStatus === "ongoing" ||
    paystackStatus === "processing" ||
    paystackStatus === "queued"
  ) {
    return "processing";
  }
  if (!input.referenceKnown) return "not_found";
  return "processing";
}

function binCount(items: unknown): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let total = 0;
  let counted = false;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const quantity = Number((item as { quantity?: unknown }).quantity);
    if (Number.isFinite(quantity) && quantity > 0) {
      total += quantity;
      counted = true;
    }
  }
  if (!counted) return items.length;
  return total;
}

function binPhrase(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  const rounded = Math.round(count);
  return rounded === 1 ? "1 bin" : `${rounded} bins`;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatCollectionDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const date = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function collectionCadence(frequency: unknown): string | null {
  const value = String(frequency || "").trim().toLowerCase();
  if (value === "weekly") return "Weekly collection";
  if (value === "biweekly" || value === "bi-weekly") return "Every two weeks";
  if (value === "monthly") return "Monthly collection";
  return null;
}

function clipLabel(value: unknown, max = 40): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max).trim() : trimmed;
}

export function buildPublicPaymentSummary(
  type: PublicPaymentType,
  evidence: PaymentStatusEvidence
): string | undefined {
  const parts: string[] = [];
  if (type === "one_time") {
    const windowLabel = clipLabel(evidence.booking?.windowLabel);
    const date = formatCollectionDate(evidence.booking?.date);
    const bins = binPhrase(binCount(evidence.booking?.items ?? evidence.paymentItems));
    if (windowLabel) parts.push(windowLabel);
    if (date) parts.push(date);
    if (bins) parts.push(bins);
  } else if (type === "subscription") {
    const cadence = collectionCadence(
      evidence.subscription?.collectionFrequency || evidence.metadataFrequency
    );
    const bins = binPhrase(
      binCount(evidence.subscription?.items ?? evidence.paymentItems)
    );
    if (cadence) parts.push(cadence);
    if (bins) parts.push(bins);
  } else {
    const count = binCount(evidence.order?.items ?? evidence.paymentItems);
    if (count === 1) parts.push("1 item");
    else if (count != null && count > 1) parts.push(`${Math.round(count)} items`);
    else parts.push("Store order");
  }
  const summary = parts.join(" · ");
  return summary || undefined;
}

function majorAmount(evidence: PaymentStatusEvidence): number | undefined {
  const fromDoc = evidence.paymentAmount;
  if (typeof fromDoc === "number" && Number.isFinite(fromDoc) && fromDoc > 0) {
    return Math.round(fromDoc * 100) / 100;
  }
  const minor = evidence.paystackAmountMinor;
  if (typeof minor === "number" && Number.isFinite(minor) && minor > 0) {
    return Math.round(minor) / 100;
  }
  return undefined;
}

/**
 * Read-only payment status for the public callback page.
 * Confirmed only when the booking, subscription, or order is marked paid for this reference.
 * Paystack success before that write is processing. This function does not create jobs.
 */
export function assemblePublicPaymentStatus(
  evidence: PaymentStatusEvidence
): PublicPaymentStatusResponse {
  const type = resolvePublicPaymentType(evidence);
  const referenceKnown = evidence.paymentDocExists || evidence.paystackFound;
  const recordPaid = type ? isDomainRecordPaid(type, evidence) : false;
  const status = resolvePublicPaymentStatus({
    referenceKnown,
    recordPaid,
    paystackStatus: evidence.paystackStatus,
  });
  if (status === "not_found") return { status };

  const amount = majorAmount(evidence);
  const currency =
    clipLabel(evidence.paymentCurrency, 8) ||
    clipLabel(evidence.paystackCurrency, 8) ||
    (amount != null ? "GHS" : undefined);
  const summary = type ? buildPublicPaymentSummary(type, evidence) : undefined;
  return {
    status,
    ...(type ? { type } : {}),
    ...(amount != null ? { amount } : {}),
    ...(currency ? { currency } : {}),
    ...(summary ? { summary } : {}),
  };
}

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
