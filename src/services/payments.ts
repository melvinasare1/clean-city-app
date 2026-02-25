// src/services/payments.ts

import { getApiBaseUrl } from "@/lib/apiBase";
import type {
  CancelSubscriptionRequest,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  GetSubscriptionPaymentUrlRequest,
  GetSubscriptionPaymentUrlResponse,
  InitializePaymentRequest,
  InitializePaymentResponse,
  VerifyBookingPaymentResponse,
  VerifyPaymentResponse,
} from "@/types/payments.types";

export type {
  CancelSubscriptionRequest,
  CollectionFrequency,
  CreateSubscriptionRequest,
  CreateSubscriptionResponse,
  GetSubscriptionPaymentUrlRequest,
  GetSubscriptionPaymentUrlResponse,
  InitializePaymentRequest,
  InitializePaymentResponse,
  PaymentItemSnapshot,
  PaymentStatus,
  PaymentType,
  VerifyBookingPaymentRequest,
  VerifyBookingPaymentResponse,
  VerifyPaymentResponse,
} from "@/types/payments.types";

/**
 * Calls your backend: POST /api/paystack/initialize
 * Sends body with required paymentType and type-specific fields (e.g. one_time + bookingId).
 * Returns { ok: true, authorizationUrl, reference } from backend.
 */
export async function initializePayment(
  body: InitializePaymentRequest
): Promise<InitializePaymentResponse> {
  const API_BASE_URL = getApiBaseUrl();
  console.log("API_BASE_URL:", API_BASE_URL);
  const url = `${API_BASE_URL}/api/paystack/initialize`;
  console.log("Initializing payment via URL:", url);
  console.log("Initializing payment with body:", body);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Read as text first to see exactly what's returned
  const text = await response.text();
  console.log("[Paystack Init] status:", response.status);
  console.log("[Paystack Init] raw:", text.slice(0, 300));

  // Parse JSON with error handling
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error("[Paystack Init] ❌ Failed to parse JSON:", e);
    throw new Error(`Init returned non-JSON: ${text.slice(0, 120)}`);
  }

  console.log("[Paystack Init] parsed:", json);

  if (!response.ok || json?.ok === false) {
    console.error("[Paystack Init] ❌ Error response:", json);
    throw new Error(json?.error || `Init failed (status ${response.status})`);
  }

  // ✅ Backend contract: { ok: true, authorizationUrl, reference }
  const authorizationUrl = json.authorizationUrl;
  const reference = json.reference;

  if (!authorizationUrl) {
    console.error("[Paystack Init] ❌ Missing authorizationUrl in response");
    console.error("[Paystack Init] Full data structure:", JSON.stringify(json, null, 2));
    throw new Error("No authorization URL returned from payment provider");
  }

  if (!reference) {
    console.error("[Paystack Init] ❌ Missing reference in response");
    console.error("[Paystack Init] Full data structure:", JSON.stringify(json, null, 2));
    throw new Error("No reference returned from payment provider");
  }

  console.log("[Paystack Init] ✅ authorizationUrl found:", authorizationUrl);
  console.log("[Paystack Init] ✅ reference found:", reference);

  const result: InitializePaymentResponse = {
    ok: json.ok,
    authorizationUrl,
    reference,
  };

  console.log("Initialize payment response:", result);
  return result;
}

/**
 * Calls your backend: GET /api/paystack/verify?reference=...
 * Returns normalized status + amount + currency.
 */
export async function verifyPayment(
  reference: string
): Promise<VerifyPaymentResponse> {
  const API_BASE_URL = getApiBaseUrl();
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/paystack/verify?reference=${encodeURIComponent(
        reference
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("Verify payment error:", data);
      throw new Error(data?.error || data?.message || "Failed to verify payment");
    }

    return data as VerifyPaymentResponse;
  } catch (error: any) {
    console.error("Paystack verify request failed:", error);
    throw new Error(error?.message || "Network error during payment verification");
  }
}

/**
 * Verify payment by Paystack reference (e.g. for subscription payments).
 * Calls POST /api/paystack/verify with reference.
 * Returns { ok: boolean, paid: boolean }.
 */
export async function verifyPaymentByReference(
  reference: string
): Promise<VerifyBookingPaymentResponse> {
  const base = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  const url = `${base}/api/paystack/verify`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Verify returned non-JSON: ${text.slice(0, 120)}`);
  }
  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Verify failed (status ${res.status})`);
  }
  const paid = json?.status === "success";
  return { ok: true, paid, status: json?.status, message: json?.message };
}

/**
 * Verify booking payment status with the separate Paystack backend.
 * Calls POST /api/paystack/verify with bookingId.
 * Returns { ok: boolean, paid: boolean }
 */
export async function verifyBookingPaymentWithBackend(
  bookingId: string
): Promise<VerifyBookingPaymentResponse> {
  const id =
    bookingId != null && bookingId !== "" ? String(bookingId).trim() : "";
  if (!id) {
    throw new Error("bookingId is required to verify payment");
  }

  const base = getApiBaseUrl().replace(/\/+$/, "");
  const url = `${base}/api/paystack/verify`;
  const payload = { bookingId: id };

  console.log("=".repeat(60));
  console.log("[Verify] 📍 PAYMENT VERIFICATION REQUEST");
  console.log("[Verify] Base URL:", base);
  console.log("[Verify] Full URL:", url);
  console.log("[Verify] Request body:", payload);
  console.log("=".repeat(60));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Read as text first to see exactly what's returned
    const text = await res.text();
    
    // 👇 THIS WILL TELL US EXACTLY WHAT IS COMING BACK
    console.log("[Verify] status:", res.status);
    console.log("[Verify] raw:", text.slice(0, 200));

    // If backend returns non-JSON, don't crash the app
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("[Verify] ❌ Failed to parse JSON:", e);
      throw new Error(`Verify returned non-JSON (status ${res.status}): ${text.slice(0, 120)}`);
    }

    console.log("[Verify] Parsed JSON:", json);

    if (!res.ok || json?.ok === false) {
      console.error("[Verify] ❌ Error response:", json);
      throw new Error(json?.error || json?.message || `Verify failed (status ${res.status})`);
    }

    console.log("[Verify] ✅ Success - paid:", json?.paid);
    return json as VerifyBookingPaymentResponse; // { ok:true, paid:true/false, ... }
  } catch (error: any) {
    console.error("[Verify] ❌ Request failed:", error);
    throw error; // Re-throw to preserve the original error message
  }
}

// --- Subscription (MoMo only, internal recurring) ---

/**
 * Returns the cancel-subscription endpoint URL.
 * Uses EXPO_PUBLIC_API_CANCEL_SUBSCRIPTION_URL when set, otherwise falls back to EXPO_PUBLIC_API_URL + path.
 */
function getCancelSubscriptionUrl(): string {
  const cancelUrl = process.env.EXPO_PUBLIC_API_CANCEL_SUBSCRIPTION_URL?.trim();
  if (cancelUrl) {
    return cancelUrl.replace(/\/+$/, "");
  }
  return `${getApiBaseUrl()}/api/paystack/cancel-subscription`;
}

/**
 * Calls POST /api/paystack/initialize with paymentType: "subscription_renewal" and subscriptionId.
 * Returns authorizationUrl for existing subscription payment (MoMo).
 */
export async function getSubscriptionPaymentUrl(
  body: GetSubscriptionPaymentUrlRequest
): Promise<GetSubscriptionPaymentUrlResponse> {
  const subscriptionId =
    body.subscriptionId != null && body.subscriptionId !== ""
      ? String(body.subscriptionId).trim()
      : "";
  if (!subscriptionId) {
    throw new Error("subscriptionId is required to get subscription payment URL");
  }

  const base = getApiBaseUrl();
  const url = `${base.replace(/\/+$/, "")}/api/paystack/initialize`;
  const payload: InitializePaymentRequest = { paymentType: "subscription_renewal", subscriptionId };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Subscription payment URL returned non-JSON: ${text.slice(0, 120)}`);
  }

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || json?.message || `Get subscription payment URL failed (status ${response.status})`);
  }

  const authorizationUrl = json.authorizationUrl;
  if (!authorizationUrl) {
    throw new Error("Backend did not return authorizationUrl for subscription payment");
  }

  return { authorizationUrl };
}

/**
 * Calls POST /api/paystack/initialize with paymentType: "subscription_initial" and subscription params.
 * Backend creates subscription doc and returns MoMo payment link (channels: ["mobile_money"]).
 */
export async function createSubscription(
  body: CreateSubscriptionRequest
): Promise<CreateSubscriptionResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/+$/, "")}/api/paystack/initialize`;
  const payload: InitializePaymentRequest = { ...body, paymentType: "subscription_initial" };
  if (__DEV__) {
    console.log("[createSubscription] POST", url);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === "Network request failed" || (e?.name === "TypeError" && msg?.toLowerCase().includes("network"))) {
      throw new Error(
        "Cannot reach the server. Check your internet connection and that EXPO_PUBLIC_API_URL is correct (" +
          (base || "not set") +
          ")."
      );
    }
    throw e;
  }

  const text = await response.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Create subscription returned non-JSON: ${text.slice(0, 120)}`);
  }

  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || json?.message || `Create subscription failed (status ${response.status})`);
  }

  const authorizationUrl = json.authorizationUrl;
  const reference = json.reference;

  if (!authorizationUrl || !reference) {
    throw new Error("Backend did not return authorizationUrl and reference");
  }

  return {
    authorizationUrl,
    reference,
    subscriptionId: json.subscriptionId,
  };
}

/**
 * Calls backend: POST /api/paystack/cancel-subscription
 * Uses EXPO_PUBLIC_API_CANCEL_SUBSCRIPTION_URL when set.
 * Sends subscriptionId as a string (Firestore subscription document id).
 */
export async function cancelSubscription(
  body: CancelSubscriptionRequest
): Promise<{ ok: boolean; message?: string }> {
  const url = getCancelSubscriptionUrl();
  const subscriptionId =
    body.subscriptionId != null ? String(body.subscriptionId).trim() : "";
  if (!subscriptionId) {
    throw new Error("subscriptionId is required to cancel subscription");
  }
  // Send both keys so backend accepts whichever it expects
  const payload = {
    subscriptionId,
    subscriptionCode: subscriptionId,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Cancel subscription returned non-JSON: ${text.slice(0, 120)}`);
  }

  if (!response.ok) {
    throw new Error(json?.error || json?.message || `Cancel subscription failed (status ${response.status})`);
  }

  return { ok: json.ok !== false, message: json?.message };
}
