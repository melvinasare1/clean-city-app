/**
 * Re-geocode jobs.pickup using Mapbox-then-Nominatim, including jobs that
 * already have coordinates (to catch Accra city-centroid false positives).
 *
 *   node scripts/backfill-job-pickup-coordinates.js
 *
 * Overwrites pickup when the fresh result is >= SIGNIFICANT_METERS away.
 */

const fs = require("fs");
const path = require("path");
const {
  addressQueryFromJob,
  geocodeAddressToPickup,
  parsePickupCoordinates,
} = require("./lib/geocode-address");

const BATCH_LIMIT = 400;
const GEOCODE_GAP_MS = 1100;
const SIGNIFICANT_METERS = 300;
const CITY_CENTROID_METERS = 150;
const ACCRA_CITY_CENTROID = { lat: 5.661083, lng: -0.202815 };

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

function haversineMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function looksForeign(query, pickup) {
  if (/london|united kingdom|\buk\b|baker street/i.test(query)) return true;
  if (!pickup) return false;
  const inGhana = pickup.lat >= 4.5 && pickup.lat <= 11.2 && pickup.lng >= -3.3 && pickup.lng <= 1.3;
  return !inGhana;
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
  let filledMissing = 0;
  let corrected = 0;
  let cityCentroidWrong = 0;
  let leftAlone = 0;
  let skippedNoAddress = 0;
  let skippedForeign = 0;
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
    const existing = parsePickupCoordinates(data.pickup);
    const query =
      (typeof data.addressSnapshot?.addressLine1 === "string" &&
      data.addressSnapshot.addressLine1.trim()
        ? data.addressSnapshot.addressLine1.trim()
        : "") ||
      (typeof data.location === "string" ? data.location.trim() : "") ||
      addressQueryFromJob({
        location: data.location,
        addressSnapshot: data.addressSnapshot,
      });

    if (!query) {
      skippedNoAddress += 1;
      console.log(`left-alone ${doc.id} reason=no-address`);
      continue;
    }

    if (looksForeign(query, existing)) {
      skippedForeign += 1;
      leftAlone += 1;
      console.log(`left-alone ${doc.id} reason=foreign-address query=${JSON.stringify(query)}`);
      continue;
    }

    let fresh = cache.get(query);
    if (fresh === undefined) {
      fresh = await geocodeAddressToPickup(query);
      cache.set(query, fresh);
      await sleep(GEOCODE_GAP_MS);
    }

    if (!fresh) {
      geocodeFailed += 1;
      leftAlone += 1;
      console.log(`left-alone ${doc.id} reason=geocode-failed query=${JSON.stringify(query)}`);
      continue;
    }

    const nearAccraCentroid =
      existing &&
      haversineMeters(existing, ACCRA_CITY_CENTROID) <= CITY_CENTROID_METERS;
    const delta = existing ? haversineMeters(existing, fresh) : Infinity;
    const needsWrite = !existing || delta >= SIGNIFICANT_METERS;

    if (!needsWrite) {
      leftAlone += 1;
      console.log(
        `left-alone ${doc.id} deltaMeters=${Math.round(delta)} query=${JSON.stringify(query)}`
      );
      continue;
    }

    batch.update(doc.ref, {
      pickup: fresh,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    ops += 1;

    if (nearAccraCentroid) {
      cityCentroidWrong += 1;
    }
    if (existing) {
      corrected += 1;
      console.log(
        `corrected ${doc.id} deltaMeters=${Math.round(delta)} cityCentroid=${Boolean(
          nearAccraCentroid
        )} from=${existing.lat},${existing.lng} to=${fresh.lat},${fresh.lng} query=${JSON.stringify(
          query
        )}`
      );
    } else {
      filledMissing += 1;
      console.log(
        `filled-missing ${doc.id} to=${fresh.lat},${fresh.lng} query=${JSON.stringify(query)}`
      );
    }

    await commitIfNeeded();
  }

  await commitIfNeeded(true);

  console.log(
    [
      `jobs scanned=${snap.size}`,
      `corrected=${corrected}`,
      `cityCentroidWrong=${cityCentroidWrong}`,
      `filledMissing=${filledMissing}`,
      `leftAlone=${leftAlone}`,
      `skippedNoAddress=${skippedNoAddress}`,
      `skippedForeign=${skippedForeign}`,
      `geocodeFailed=${geocodeFailed}`,
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
