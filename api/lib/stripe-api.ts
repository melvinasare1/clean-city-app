import type { StripeApi, StripeCheckoutSessionLike } from "./stripe-checkout";

const STRIPE_API = "https://api.stripe.com/v1";
/** Pin a current API version so Checkout params like origin_context are recognized. */
const STRIPE_API_VERSION = "2025-08-27.basil";

function stripeSecret(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return key;
}

export function stripeKeyMode(): "live" | "test" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unknown";
}

export class StripeRequestError extends Error {
  type?: string;
  code?: string;
  param?: string;
  requestId?: string;
  status: number;
  docUrl?: string;

  constructor(
    message: string,
    extra: {
      type?: string;
      code?: string;
      param?: string;
      requestId?: string;
      status: number;
      docUrl?: string;
    }
  ) {
    super(message);
    this.name = "StripeRequestError";
    this.type = extra.type;
    this.code = extra.code;
    this.param = extra.param;
    this.requestId = extra.requestId;
    this.status = extra.status;
    this.docUrl = extra.docUrl;
  }
}

function formBody(params: Record<string, string>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") body.append(key, value);
  }
  return body.toString();
}

export function publicStripeError(error: unknown): {
  type?: string;
  code?: string;
  param?: string;
  message: string;
  request_id?: string;
} {
  if (error instanceof StripeRequestError) {
    return {
      type: error.type,
      code: error.code,
      param: error.param,
      message: error.message,
      request_id: error.requestId,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Unknown Stripe error" };
}

async function stripeRequest(
  path: string,
  init: { method: string; body?: string; idempotencyKey?: string }
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecret()}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (init.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (init.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: init.method,
    headers,
    body: init.body,
  });
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new StripeRequestError(
      `Invalid response from Stripe: ${text.slice(0, 200)}`,
      { status: response.status, requestId: response.headers.get("request-id") || undefined }
    );
  }
  if (!response.ok) {
    const err = data?.error || {};
    throw new StripeRequestError(err.message || `Stripe request failed (${response.status})`, {
      type: err.type,
      code: err.code,
      param: err.param,
      requestId: err.request_id || response.headers.get("request-id") || undefined,
      status: response.status,
      docUrl: err.doc_url,
    });
  }
  return data;
}

export async function retrieveStripeAccount(): Promise<{
  id?: string;
  country?: string;
  default_currency?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  type?: string;
  card_payments?: string;
}> {
  const account = await stripeRequest("/account", { method: "GET" });
  return {
    id: account.id,
    country: account.country,
    default_currency: account.default_currency,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    type: account.type,
    card_payments: account.capabilities?.card_payments,
  };
}

export async function retrieveStripeSubscription(id: string): Promise<any> {
  return stripeRequest(`/subscriptions/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function retrieveStripeInvoice(id: string): Promise<any> {
  return stripeRequest(`/invoices/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function cancelStripeSubscription(id: string): Promise<any> {
  return stripeRequest(`/subscriptions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const liveStripeApi: StripeApi & {
  retrieveSubscription: typeof retrieveStripeSubscription;
  retrieveInvoice: typeof retrieveStripeInvoice;
  cancelSubscription: typeof cancelStripeSubscription;
} = {
  async createCheckoutSession(params, idempotencyKey) {
    return stripeRequest("/checkout/sessions", {
      method: "POST",
      body: formBody(params),
      idempotencyKey,
    }) as Promise<StripeCheckoutSessionLike>;
  },
  async retrieveCheckoutSession(id) {
    const query = new URLSearchParams();
    query.append("expand[]", "line_items.data.price");
    query.append("expand[]", "subscription");
    return stripeRequest(
      `/checkout/sessions/${encodeURIComponent(id)}?${query.toString()}`,
      { method: "GET" }
    ) as Promise<StripeCheckoutSessionLike>;
  },
  retrieveSubscription: retrieveStripeSubscription,
  retrieveInvoice: retrieveStripeInvoice,
  cancelSubscription: cancelStripeSubscription,
};
