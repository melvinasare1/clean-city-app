/**
 * Backfill profile fields on drivers/{uid} when missing:
 *   jobsCompletedCount → 0
 *   notificationsEnabled → true
 *   priority → 100
 *   paymentMethods → { cash: true, card: true, cashAndCard: true }
 *   photoURL, vehicleType, vehiclePlate, serviceProviderName, rating → null
 *
 * Existing values are left unchanged.
 *
 * Run from functions/ so firebase-admin resolves (same as seed-pricing-config.js):
 *
 *   cd functions && node ../scripts/backfill-driver-profile-fields.js
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 */

const fs = require("fs");
const path = require("path");

const BATCH_LIMIT = 400;
const DEFAULT_PRIORITY = 100;
const DEFAULT_PAYMENT_METHODS = {
  cash: true,
  card: true,
  cashAndCard: true,
};

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

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(jsonEnv)),
    });
    return;
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  throw new Error(
    "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

function nullableStringPatch(data, key) {
  if (key in data) return undefined;
  return null;
}

function isPaymentMethodsMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    typeof value.cash === "boolean" &&
    typeof value.card === "boolean" &&
    typeof value.cashAndCard === "boolean"
  );
}

function profileFieldPatch(data) {
  const patch = {};

  if (nullableStringPatch(data, "photoURL") === null) patch.photoURL = null;
  if (nullableStringPatch(data, "vehicleType") === null) patch.vehicleType = null;
  if (nullableStringPatch(data, "vehiclePlate") === null) patch.vehiclePlate = null;
  if (nullableStringPatch(data, "serviceProviderName") === null) {
    patch.serviceProviderName = null;
  }

  if (!("rating" in data)) {
    patch.rating = null;
  }

  if (
    typeof data.priority !== "number" ||
    !Number.isFinite(data.priority)
  ) {
    patch.priority = DEFAULT_PRIORITY;
  }

  if (!isPaymentMethodsMap(data.paymentMethods)) {
    patch.paymentMethods = { ...DEFAULT_PAYMENT_METHODS };
  }

  if (
    typeof data.jobsCompletedCount !== "number" ||
    !Number.isFinite(data.jobsCompletedCount)
  ) {
    patch.jobsCompletedCount = 0;
  }

  if (typeof data.notificationsEnabled !== "boolean") {
    patch.notificationsEnabled = true;
  }

  return patch;
}

async function main() {
  const admin = loadFirebaseAdmin();
  initAdmin(admin);
  const db = admin.firestore();

  const snap = await db.collection("drivers").get();
  let updated = 0;
  let alreadyValid = 0;
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
    const patch = profileFieldPatch(doc.data() ?? {});
    if (Object.keys(patch).length === 0) {
      alreadyValid += 1;
      continue;
    }
    batch.update(doc.ref, {
      ...patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    updated += 1;
    ops += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);

  console.log(
    `drivers scanned=${snap.size} updated=${updated} alreadyValid=${alreadyValid}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
