/**
 * Create a jobs doc assigned to a real drivers/{uid} record.
 * Creates unassigned first, then updates assignedTo so onJobAssigned (onUpdate)
 * can set offerExpiresAt and enqueue the Cloud Task.
 *
 * Usage (from repo root):
 *   node scripts/create-test-job.js <driverUid>
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS,
 * or service-account.json at the repo root. firebase-admin is loaded from
 * functions/node_modules when it is not installed at the repo root.
 */

const fs = require("fs");
const path = require("path");
const { geocodeAddressToPickup } = require("./lib/geocode-address");

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

  const credCandidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "..", "service-account.json"),
  ].filter(Boolean);

  for (const credPath of credCandidates) {
    if (!fs.existsSync(credPath)) continue;
    const serviceAccount = JSON.parse(fs.readFileSync(credPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  throw new Error(
    "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS, or place service-account.json at the repo root."
  );
}

async function main() {
  const driverUid = process.argv[2] && process.argv[2].trim();
  if (!driverUid) {
    console.error("Usage: node scripts/create-test-job.js <driverUid>");
    process.exit(1);
  }

  const admin = loadFirebaseAdmin();
  initAdmin(admin);
  const db = admin.firestore();
  const Timestamp = admin.firestore.Timestamp;
  const FieldValue = admin.firestore.FieldValue;

  const driverRef = db.doc(`drivers/${driverUid}`);
  const driverSnap = await driverRef.get();
  if (!driverSnap.exists) {
    throw new Error(
      `No driver document at drivers/${driverUid}. Refusing to create an orphaned job.`
    );
  }

  const now = Timestamp.now();
  const jobRef = db.collection("jobs").doc();
  const location = "221B Baker Street, London";
  const pickup = await geocodeAddressToPickup(location, { country: "gb" });

  await jobRef.set({
    id: jobRef.id,
    type: "one_time",
    bookingId: `test-${jobRef.id}`,
    userId: "test-customer",
    scheduledDate: now,
    paymentStatus: "paid",
    jobStatus: "scheduled",
    assignmentStatus: "unassigned",
    items: [
      {
        id: "GENERAL_WASTE",
        type: "General waste",
        quantity: 1,
        unitPrice: 18.5,
        totalPrice: 18.5,
      },
    ],
    location,
    addressSnapshot: {
      addressLine1: location,
      area: "Marylebone",
      phoneNumber: "+440000000000",
    },
    ...(pickup ? { pickup } : {}),
    windowId: "morning",
    windowLabel: "Morning",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await jobRef.update({
    assignedTo: driverUid,
    assignedAt: FieldValue.serverTimestamp(),
    assignedBy: "create-test-job",
    assignmentStatus: "assigned",
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`created jobId=${jobRef.id}`);
  console.log(`driverUid=${driverUid}`);
  console.log(
    pickup
      ? `pickup=${pickup.lat},${pickup.lng}`
      : "pickup=missing (geocode failed or Mapbox token unset)"
  );
  console.log("assignmentStatus=assigned (via update, so onJobAssigned can fire)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
