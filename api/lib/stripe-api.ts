import { STRIPE_CURRENCY, type StripeApi, type StripeCheckoutSessionLike } from "./stripe-checkout";

const STRIPE_API = "https://api.stripe.com/v1";

function stripeSecret(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return key;
}

function formBody(params: Record<string, string>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }
  return body.toString();
}

async function stripeRequest(
  path: string,
  init: { method: string; body?: string; idempotencyKey?: string }
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecret()}`,
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
    throw new Error(`Invalid response from Stripe: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  }
  return data;
}

export const liveStripeApi: StripeApi = {
  async createCheckoutSession(params, idempotencyKey) {
    return stripeRequest("/checkout/sessions", {
      method: "POST",
      body: formBody({
        ...params,
        currency: params.currency || STRIPE_CURRENCY,
      }),
      idempotencyKey,
    }) as Promise<StripeCheckoutSessionLike>;
  },
  async retrieveCheckoutSession(id) {
    return stripeRequest(
      `/checkout/sessions/${encodeURIComponent(id)}`,
      { method: "GET" }
    ) as Promise<StripeCheckoutSessionLike>;
  },
};
