import express from "express";
import cors from "cors";
import { PORT } from "./config/env";
import {
  paymentsRouter,
  paystackWebhookHandler,
} from "./payments/payments.routes";

const app = express();

// CORS to allow your Expo app to call the API
app.use(
  cors({
    origin: "*", // tighten this in production
  })
);

// Webhook route: MUST use raw body for signature verification
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhookHandler
);

// Other routes can use JSON body parser
app.use(express.json());

// Mount payments router (initialize, verify)
app.use("/api/payments", paymentsRouter);

// Simple healthcheck
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Simple success page for Paystack redirect: /payment/success?reference=...
app.get("/payment/success", (req, res) => {
  const reference = req.query.reference as string | undefined;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Payment successful</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f5f5f5;
        margin: 0;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        background: #ffffff;
        padding: 24px 28px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        max-width: 420px;
        text-align: center;
      }
      .title {
        font-size: 22px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #2E7D32;
      }
      .message {
        font-size: 15px;
        color: #555;
        margin-bottom: 16px;
      }
      .reference {
        font-family: monospace;
        font-size: 13px;
        color: #888;
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">Payment successful</div>
      <div class="message">
        Thank you. Your payment ${
          reference
            ? `with reference <span class="reference">${reference}</span>`
            : ""
        } has been received.
        You can now return to the Clean City app.
      </div>
    </div>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
