import axios from "axios";
import crypto from "crypto";
import { PAYSTACK_SECRET_KEY, CLIENT_APP_URL } from "../config/env";
import {
  InitializeTransactionBody,
  InitializeTransactionResponse,
  VerifyTransactionResult,
  TransactionStatus,
} from "./paystack.types";
import { upsertTransactionFromPaystack } from "./transactions.repository";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Initialize a Paystack transaction.
 * Converts amount to kobo and sends metadata + callback_url.
 */
export async function initializePaystackTransaction(
  body: InitializeTransactionBody
): Promise<InitializeTransactionResponse> {
  const { email, amount, metadata } = body;

  const amountInKobo = Math.round(amount * 100);

  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email,
      amount: amountInKobo,
      metadata,
      callback_url: `${CLIENT_APP_URL}/payment/success`,
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = response.data;
  if (!data.status) {
    throw new Error(
      data.message || "Failed to initialize Paystack transaction"
    );
  }

  const authData = data.data;

  return {
    authorization_url: authData.authorization_url,
    access_code: authData.access_code,
    reference: authData.reference,
  };
}

/**
 * Verify a Paystack transaction and persist it to Firestore.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<VerifyTransactionResult> {
  const response = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const data = response.data;
  const paystackData = data.data;

  const status = (paystackData.status || "failed") as TransactionStatus;

  await upsertTransactionFromPaystack(data, status);

  return {
    status,
    reference: paystackData.reference,
    amount: paystackData.amount / 100,
    currency: paystackData.currency,
    statusMessage: paystackData.gateway_response,
    metadata: paystackData.metadata,
    rawPaystack: data,
  };
}

/**
 * Verify Paystack webhook signature and return the parsed event.
 */
export function verifyPaystackWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): any | null {
  if (!signatureHeader) return null;

  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  if (hash !== signatureHeader) {
    return null;
  }

  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Handle webhook event (e.g. charge.success) and upsert transaction.
 */
export async function handlePaystackWebhookEvent(event: any): Promise<void> {
  const eventName: string | undefined = event?.event;
  if (!eventName) return;

  switch (eventName) {
    case "charge.success":
    case "charge.failed":
    case "charge.abandoned":
      await upsertTransactionFromPaystack(event, event.data?.status);
      break;
    default:
      break;
  }
}
