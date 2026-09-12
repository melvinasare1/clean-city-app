/**
 * Backfill jobs.pickup = { lat, lng } when missing.
 * Geocodes each distinct address once via Mapbox Geocoding v6 (permanent)
 * and reuses that result for every job that shares the same address string.
 *
 *   node scripts/backfill-job-pickup-coordinates.js
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS,
 * or service-account.json at the repo root.
 * Mapbox: MAPBOX_ACCESS_TOKEN or EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
 * (also loaded from repo-root .env / apps/driver/.env if present).
 */

const fs = require("fs");
const path = require("path");
const {
  addressQueryFromJob,
  geocodeAddressToPickup,
  parsePickupCoordinates,
} = require("./lib/geocode-address");

const BATCH_LIMIT = 400;
const GEOCODE_GAP_MS = 80;

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
      if (!key.startsWith("MAPBOX") && key !== "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN") continue;
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

function loadFirebaseAdmin() {
  const candidates = [
    "firebase-admin",
    path.join(__dirname, "..", "functions", "node_modules", "firebase-admin"),
  ];
  for (const mod of candidates) {
    try {
      return require(mod);
    } catch {
      // try next path
    }
  }
  console.error(
    "firebase-admin not found. Install dependencies:\n" +
      "  cd functions && npm install"
  );
  process.exit(1);
}

function initAdmin(admin) {
  if (admin.apps.length) return;

  const credCandidates = [
    path.join(__dirname, "..", "service-account.json"),
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].filter(Boolean);

  for (const credPath of credCandidates) {
    if (!fs.existsSync(credPath)) continue;
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(jsonEnv)),
    });
    return;
  }

  throw new Error(
    "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS, or place service-account.json at the repo root."
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnvFiles();
  const token =
    process.env.MAPBOX_ACCESS_TOKEN || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || token.includes("${")) {
    throw new Error(
      "Mapbox token missing. Set MAPBOX_ACCESS_TOKEN or EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN."
    );
  }

  const admin = loadFirebaseAdmin();
  initAdmin(admin);
  const db = admin.firestore();

  const snap = await db.collection("jobs").get();
  const cache = new Map();
  let updated = 0;
  let alreadyValid = 0;
  let skippedNoAddress = 0;
  let geocodeFailed = 0;
  let batch = db.batch();
  let ops = 0;

  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return;
    if (!force && ops < BATCH_LIMIT) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (parsePickupCoordinates(data.pickup)) {
      alreadyValid += 1;
      continue;
    }

    const query = addressQueryFromJob({
      location: data.location,
      addressSnapshot: data.addressSnapshot,
    });
    if (!query) {
      skippedNoAddress += 1;
      continue;
    }

    let pickup = cache.get(query);
    if (pickup === undefined) {
      pickup = await geocodeAddressToPickup(query);
      cache.set(query, pickup);
      await sleep(GEOCODE_GAP_MS);
    }

    if (!pickup) {
      geocodeFailed += 1;
      continue;
    }

    batch.update(doc.ref, {
      pickup,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    updated += 1;
    ops += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);

  console.log(
    `jobs scanned=${snap.size} updated=${updated} alreadyValid=${alreadyValid} skippedNoAddress=${skippedNoAddress} geocodeFailed=${geocodeFailed}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
