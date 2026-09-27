/**
 * Base URL of the public website (payment callback pages live under /payment/*).
 * Single fallback for every handler so Paystack/Stripe never redirect to localhost.
 */
export const CLIENT_APP_URL = (
  process.env.CLIENT_APP_URL || "https://www.cleancitygh.com"
).replace(/\/+$/, "");
