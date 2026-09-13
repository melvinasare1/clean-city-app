/**
 * Mapbox does not support custom usage emails (e.g. 20k Directions requests).
 * This script is the project alert: query any available analytics endpoints,
 * compare against 20,000, and exit 1 when the threshold is crossed.
 *
 *   node scripts/check-mapbox-directions-usage.js
 *
 * Optional: MAPBOX_SECRET_TOKEN (sk.*) for Analytics API on paid plans.
 * Public pk tokens cannot read account statistics.
 */
const fs = require("fs");
const path = require("path");

const ALERT_THRESHOLD = 20_000;
const FREE_ALLOWANCE = 100_000;

function loadEnvFiles() {
  const files = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "apps", "driver", ".env"),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (
        !key.startsWith("MAPBOX") &&
        key !== "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN"
      ) {
        continue;
      }
      if (!key || process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function tokenUsername(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json);
    return typeof payload.u === "string" ? payload.u : null;
  } catch {
    return null;
  }
}

function monthPeriodUtc(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const iso = (d) => d.toISOString().slice(0, 10);
  return `${iso(start)},${iso(end)}`;
}

function extractCount(payload) {
  if (payload == null) return null;
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "object") {
    for (const key of [
      "directions",
      "Directions",
      "navigation.directions",
      "requests",
      "count",
      "total",
      "quantity",
    ]) {
      const value = payload[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    if (Array.isArray(payload.stats)) {
      let sum = 0;
      let found = false;
      for (const row of payload.stats) {
        const service = String(row.service || row.product || row.resource || "");
        if (!/direction/i.test(service)) continue;
        const n = Number(row.requests ?? row.count ?? row.quantity ?? row.value);
        if (!Number.isFinite(n)) continue;
        sum += n;
        found = true;
      }
      if (found) return sum;
    }
  }
  return null;
}

async function tryEndpoint(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text: text.slice(0, 300) };
}

async function main() {
  loadEnvFiles();
  const publicToken =
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    "";
  const secretToken = process.env.MAPBOX_SECRET_TOKEN || "";
  const token = secretToken || publicToken;
  const username = tokenUsername(publicToken) || tokenUsername(secretToken);
  const period = monthPeriodUtc();

  console.log("Mapbox Directions usage check");
  console.log(`threshold=${ALERT_THRESHOLD} (20% of ${FREE_ALLOWANCE} free requests)`);
  console.log(`period_utc=${period}`);
  console.log(`username=${username || "(unknown)"}`);
  console.log(
    "dashboard=https://console.mapbox.com/account/statistics/"
  );
  console.log(
    "note=Mapbox has no configurable 20k email alert; this script is the project alert."
  );

  if (!token) {
    console.error("No Mapbox token found.");
    process.exit(2);
  }

  const endpoints = [];
  if (username) {
    endpoints.push(
      `https://api.mapbox.com/analytics/v1/api/${username}?period=${period}&access_token=${encodeURIComponent(token)}`,
      `https://api.mapbox.com/analytics/v1/directions/${username}?period=${period}&access_token=${encodeURIComponent(token)}`,
      `https://api.mapbox.com/analytics/v1/accounts/${username}?period=${period}&access_token=${encodeURIComponent(token)}`
    );
  }

  let count = null;
  const attempts = [];
  for (const url of endpoints) {
    const redacted = url.replace(/access_token=[^&]+/, "access_token=REDACTED");
    try {
      const result = await tryEndpoint(url, token);
      attempts.push({ url: redacted, status: result.status });
      const extracted = extractCount(result.json);
      if (extracted != null) {
        count = extracted;
        break;
      }
    } catch (error) {
      attempts.push({
        url: redacted,
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const attempt of attempts) {
    console.log(`probe status=${attempt.status} ${attempt.url}`);
  }

  if (count == null) {
    console.log("monthly_directions_requests=unavailable");
    console.log(
      "reason=Mapbox Statistics are dashboard-only on this plan (no public usage API)."
    );
    process.exit(0);
  }

  console.log(`monthly_directions_requests=${count}`);
  if (count >= ALERT_THRESHOLD) {
    console.error(
      `ALERT: Directions usage ${count} is at or above ${ALERT_THRESHOLD}.`
    );
    process.exit(1);
  }
  console.log("alert=ok (below threshold)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
