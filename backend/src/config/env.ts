import dotenv from "dotenv";
import path from "path";

// Always load the backend .env file explicitly from the backend root
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const PAYSTACK_SECRET_KEY = required("PAYSTACK_SECRET_KEY");
export const PAYSTACK_PUBLIC_KEY = required("PAYSTACK_PUBLIC_KEY");
export const PORT = process.env.PORT || "4000";

/**
 * URL your Paystack transaction should redirect back to.
 * For web, this could be your Expo web URL + /payment/callback
 * e.g. http://localhost:19006/payment/callback
 */

export const CLIENT_APP_URL =
  process.env.CLIENT_APP_URL || "http://localhost:19006";
