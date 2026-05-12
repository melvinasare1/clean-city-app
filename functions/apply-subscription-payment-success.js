/**
 * Apply subscription payment success to Firestore (subscription doc).
 * Run from the functions directory so firebase-admin resolves:
 *   cd functions && node apply-subscription-payment-success.js <subscriptionId> <paystackReference>
 *
 * Ensures payment.status is explicitly "paid" (not left as "initiated") when updating reference.
 * Uses a batch write; merge preserves other subscription fields.
 */
const admin = require("firebase-admin");

const SUBSCRIPTIONS = "subscriptions";

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    process.exit(1);
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  });
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.WriteBatch} batch
 * @param {string} subscriptionId
 * @param {string} reference Paystack transaction reference
 */
function applySubscriptionPaymentSuccessToBatch(db, batch, subscriptionId, reference) {
  const subRef = db.collection(SUBSCRIPTIONS).doc(subscriptionId);
  batch.set(
    subRef,
    {
      status: "active",
      lastPaymentReference: reference,
      currentPaymentReference: admin.firestore.FieldValue.delete(),
      "payment.status": "paid",
      "payment.reference": reference,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function main() {
  const subscriptionId = process.argv[2];
  const reference = process.argv[3];
  if (!subscriptionId || !reference) {
    console.error(
      "Usage: node apply-subscription-payment-success.js <subscriptionId> <paystackReference>"
    );
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();
  const batch = db.batch();
  applySubscriptionPaymentSuccessToBatch(db, batch, subscriptionId, reference);
  await batch.commit();
  console.log(`Subscription ${subscriptionId} updated: payment.status=paid, reference=${reference}`);
}

module.exports = { applySubscriptionPaymentSuccessToBatch };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
