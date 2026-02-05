// src/services/payments.ts

import { getApiBaseUrl } from "@/lib/apiBase";

export type PaymentStatus = "success" | "failed" | "abandoned" | "pending";

export interface VerifyBookingPaymentRequest {
  bookingId: string;
  reference: string;
}

export interface VerifyBookingPaymentResponse {
  ok: boolean;
  paid: boolean;
  status?: string;
  message?: string;
}

export interface InitializePaymentRequest {
  email: string;
  amount: number; // in app currency units (e.g. GHS)
  metadata?: Record<string, any>;
}

export interface InitializePaymentResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface VerifyPaymentResponse {
  status: PaymentStatus;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

/**
 * Calls your backend: POST /api/paystack/initialize
 * Returns Paystack authorization_url, access_code, reference.
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

  const data = await response.json();
  console.log("Initialize payment response:", data);

  if (!response.ok || !data) {
    console.log("Initialize payment error:", data);
    throw new Error(
      data?.error || data?.message || "Failed to initialize payment"
    );
  }

  // Support both normalized and raw Paystack-shaped responses
  const authData = data.authorization_url ? data : data.data;

  if (!authData?.authorization_url) {
    console.log("Initialize payment missing authorization_url:", data);
    throw new Error("No authorization URL returned from payment provider");
  }

  const normalized: InitializePaymentResponse = {
    authorization_url: authData.authorization_url,
    access_code: authData.access_code,
    reference: authData.reference,
  };

  console.log("Initialize payment normalized response:", normalized);
  return normalized;
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
 * Verify booking payment status with the separate Paystack backend.
 * Calls POST /api/paystack/verify with bookingId.
 * Returns { ok: boolean, paid: boolean }
 */
export async function verifyBookingPaymentWithBackend(
  bookingId: string
): Promise<VerifyBookingPaymentResponse> {
  const base = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  const url = `${base}/api/paystack/verify`;
  
  console.log("=".repeat(60));
  console.log("[Verify] 📍 PAYMENT VERIFICATION REQUEST");
  console.log("[Verify] Base URL:", base);
  console.log("[Verify] Full URL:", url);
  console.log("[Verify] Expected path: /api/paystack/verify");
  console.log("[Verify] Request body:", { bookingId });
  console.log("=".repeat(60));
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bookingId }),
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
