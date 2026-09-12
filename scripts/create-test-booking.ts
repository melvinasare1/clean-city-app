/**
 * Create a bookings doc with status "assigned" for a real drivers/{uid} record.
 * Relies on onBookingAssigned to set offerExpiresAt and enqueue the Cloud Task.
 *
 * Usage:
 *   npx ts-node scripts/create-test-booking.ts <driverUid>
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 * (same as scripts/seed-pricing-config.js).
 */

import * as fs from "fs";
import * as path from "path";

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

function resolveDriverName(driver: { name?: unknown; email?: unknown }): string {
  return (driver.name ?? driver.email ?? "Unknown driver") as string;
}

async function main(): Promise<void> {
  const driverUid = process.argv[2]?.trim();
  if (!driverUid) {
    console.error("Usage: npx ts-node scripts/create-test-booking.ts <driverUid>");
    process.exit(1);
  }

  const admin = loadFirebaseAdmin();
  initAdmin(admin);
  const db = admin.firestore();

  const driverRef = db.doc(`drivers/${driverUid}`);
  const driverSnap = await driverRef.get();
  if (!driverSnap.exists) {
    throw new Error(
      `No driver document at drivers/${driverUid}. Refusing to create an orphaned booking.`
    );
  }

  const driver = driverSnap.data() || {};
  const driverName = resolveDriverName(driver);

  const bookingRef = await db.collection("bookings").add({
    status: "assigned",
    driverId: driverUid,
    driverName,
    customerName: "Jordan (test)",
    address: "221B Baker Street, London",
    totalPrice: 18.5,
    scheduledDate: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`created bookingId=${bookingRef.id}`);
  console.log(`driverUid=${driverUid}`);
  console.log(`driverName=${driverName}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
