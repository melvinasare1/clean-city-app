// src/services/payments.ts

// TODO: Move this base URL to a config/env (e.g. EXPO_PUBLIC_API_BASE_URL)
const API_BASE_URL = "http://localhost:4000"; // or your deployed backend URL

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
 * Calls your backend: POST /api/payments/initialize
 * Returns Paystack authorization_url, access_code, reference.
 */
export async function initializePayment(
  body: InitializePaymentRequest
): Promise<InitializePaymentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Initialize payment error:", data);
    throw new Error(data?.error || "Failed to initialize payment");
  }

  return data as InitializePaymentResponse;
}

/**
 * Calls your backend: GET /api/payments/verify?reference=...
 * Returns normalized status + amount + currency.
 */
export async function verifyPayment(
  reference: string
): Promise<VerifyPaymentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/payments/verify?reference=${encodeURIComponent(
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

