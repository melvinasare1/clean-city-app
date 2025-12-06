import express from "express";
import cors from "cors";
import { PORT } from "./config/env";
import { paymentsRouter, paystackWebhookHandler } from "./payments/payments.routes";

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

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});


