/**
 * Seed or update Firestore remote pricing at config/pricing.
 *
 * Prerequisites:
 *   - firebase-admin installed (run from the functions/ directory)
 *   - FIREBASE_SERVICE_ACCOUNT_JSON env var set to your service account JSON string
 *     OR GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON file
 *
 * Usage (from repo root):
 *   cd functions && FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
 *     node ../scripts/seed-pricing-config.js
 *
 * Options:
 *   --config <path>   JSON file to upload (default: scripts/pricing-config.default.json)
 *   --dry-run         Print payload without writing to Firestore
 *
 * Examples:
 *   node ../scripts/seed-pricing-config.js --dry-run
 *   node ../scripts/seed-pricing-config.js --config ../scripts/my-pricing.json
 */

const fs = require("fs");
const path = require("path");

const PRICING_COLLECTION = "config";
const PRICING_DOC_ID = "pricing";
const BIN_KEYS = ["smallBag", "standardBin", "wheelieBin"];

function parseArgs(argv) {
  const args = { dryRun: false, configPath: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--config") {
      args.configPath = argv[++i];
      if (!args.configPath) {
        console.error("--config requires a file path");
        process.exit(1);
      }
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Seed Firestore config/pricing for remote app pricing.

Usage:
  cd functions && node ../scripts/seed-pricing-config.js [options]

Options:
  --config <path>   JSON file (default: scripts/pricing-config.default.json)
  --dry-run         Validate and print payload only
  --help            Show this message

Environment:
  FIREBASE_SERVICE_ACCOUNT_JSON   Service account JSON as a string
  GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON file
`);
}

function resolveDefaultConfigPath() {
  return path.join(__dirname, "pricing-config.default.json");
}

function loadPricingConfig(configPath) {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

function parsePositiveNumber(value, label) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  throw new Error(`${label}: expected a non-negative number, got ${JSON.stringify(value)}`);
}

function normalizePricingPayload(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Config root must be a JSON object");
  }

  const currency =
    typeof input.currency === "string" && input.currency.trim()
      ? input.currency.trim()
      : "GHS";

  const binsInput = input.bins;
  if (!binsInput || typeof binsInput !== "object") {
    throw new Error('Config must include a "bins" object');
  }

  const bins = {};
  for (const key of BIN_KEYS) {
    const entry = binsInput[key];
    if (!entry || typeof entry !== "object") {
      throw new Error(`bins.${key} is required and must be an object`);
    }
    bins[key] = {
      unitPrice: parsePositiveNumber(entry.unitPrice, `bins.${key}.unitPrice`),
      enabled: entry.enabled !== false,
    };
  }

  return { currency, bins };
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
      "  cd functions && npm install\n" +
      "Then run: npm run seed:pricing"
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

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const configPath = args.configPath || resolveDefaultConfigPath();
  const loaded = loadPricingConfig(configPath);
  const payload = normalizePricingPayload(loaded);

  const firestorePayload = {
    ...payload,
    updatedAt: new Date().toISOString(),
    seededBy: "scripts/seed-pricing-config.js",
  };

  console.log("Pricing config to write:");
  console.log(JSON.stringify(firestorePayload, null, 2));

  if (args.dryRun) {
    console.log("\nDry run — no changes written.");
    return;
  }

  const admin = loadFirebaseAdmin();

  initAdmin(admin);
  const db = admin.firestore();
  const docRef = db.collection(PRICING_COLLECTION).doc(PRICING_DOC_ID);

  await docRef.set(
    {
      currency: payload.currency,
      bins: payload.bins,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      seededBy: "scripts/seed-pricing-config.js",
    },
    { merge: true }
  );

  const written = await docRef.get();
  console.log(`\n✅ Wrote ${PRICING_COLLECTION}/${PRICING_DOC_ID}`);
  console.log(JSON.stringify(written.data(), null, 2));
}

main().catch((err) => {
  console.error("Failed to seed pricing config:", err.message || err);
  process.exit(1);
});
