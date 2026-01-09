// src/services/payments.ts

import { getApiBaseUrl } from "@/lib/apiBase";

export type PaymentStatus = "success" | "failed" | "abandoned" | "pending";

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

  const response = await fetch(
    `${API_BASE_URL}/api/paystack/verify?reference=${encodeURIComponent(
      reference
    )}`
  );

  const data = await response.json();

  if (!response.ok) {
    console.log("Verify payment error:", data);
    throw new Error(data?.error || "Failed to verify payment");
  }

  return data as VerifyPaymentResponse;
}
