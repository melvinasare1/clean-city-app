import express, { Request, Response, Router } from "express";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
  handlePaystackWebhookEvent,
} from "./paystack.service";
import type {
  InitializeTransactionBody,
  InitializeTransactionResponse,
} from "./paystack.types";

export const paymentsRouter = Router();

paymentsRouter.post("/initialize", async (req, res) => {
  try {
    const { email, metadata } = req.body;
    const amount = Number(req.body.amount);

    if (!email || Number.isNaN(amount)) {
      return res.status(400).json({
        error: "email and amount are required (amount must be a valid number)",
      });
    }

    const result = await initializePaystackTransaction({
      email,
      amount,
      metadata,
    });

    return res.status(201).json(result);
  } catch (error: any) {
    console.error("Error initializing Paystack transaction:", error?.message);
    return res.status(500).json({
      error: "Failed to initialize transaction",
      details: error?.message,
    });
  }
});


/**
 * GET /api/payments/verify?reference=...
 */
paymentsRouter.get("/verify", async (req: Request, res: Response) => {
  try {
    const reference = req.query.reference as string | undefined;
    if (!reference) {
      return res
        .status(400)
        .json({ error: "reference query param is required" });
    }

    const result = await verifyPaystackTransaction(reference);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error verifying Paystack transaction:", error?.message);
    return res.status(500).json({
      error: "Failed to verify transaction",
      details: error?.message,
    });
  }
});

/**
 * Webhook: POST /api/payments/webhook
 * Note: this handler expects raw body (configured in index.ts).
 */
export const paystackWebhookHandler = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-paystack-signature"] as
      | string
      | undefined;

    const rawBody = req.body as Buffer;
    const event = verifyPaystackWebhookSignature(rawBody, signature);

    if (!event) {
      return res.status(400).json({ error: "Invalid signature or payload" });
    }

    await handlePaystackWebhookEvent(event);

    return res.sendStatus(200);
  } catch (error: any) {
    console.error("Error handling Paystack webhook:", error?.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};


