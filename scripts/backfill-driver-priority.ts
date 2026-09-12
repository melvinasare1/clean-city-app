/**
 * Backfill drivers.priority → 100 when missing or not a valid number.
 *
 * Run order (backfill first — a test job against a driver with no
 * priority field would otherwise be the first thing to expose the NaN bug):
 *
 *   npx ts-node scripts/backfill-driver-priority.ts
 *   node scripts/create-test-job.js iuocJ5AAEwb4bmKKDCB3mmYbphg1
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * (same as scripts/seed-pricing-config.js). firebase-admin is resolved from
 * functions/node_modules when the repo root has no copy.
 */

import * as fs from "fs";
import * as path from "path";

const DEFAULT_PRIORITY = 100;
const BATCH_LIMIT = 400;

function loadFirebaseAdmin(): typeof import("firebase-admin") {
  const candidates = [
    "firebase-admin",
    path.join(__dirname, "..", "functions", "node_modules", "firebase-admin"),
  ];
  for (const mod of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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

function initAdmin(admin: typeof import("firebase-admin")): void {
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

function isValidPriority(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

async function main(): Promise<void> {
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
    if (isValidPriority(doc.data()?.priority)) {
      alreadyValid += 1;
      continue;
    }
    batch.update(doc.ref, {
      priority: DEFAULT_PRIORITY,
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
