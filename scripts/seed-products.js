/**
 * Seed Firestore `products` with placeholder catalog rows.
 * Prices are 0 / pricePlaceholder: true until real retail prices are confirmed.
 *
 * Usage (from repo root):
 *   cd functions && node ../scripts/seed-products.js
 *   cd functions && node ../scripts/seed-products.js --dry-run
 *
 * Environment:
 *   FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 */

const fs = require("fs");
const path = require("path");

const PRODUCTS_COLLECTION = "products";
const CATEGORIES = new Set(["bin", "liner"]);

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
  console.log(`Seed Firestore products collection (placeholder catalog).

Usage:
  cd functions && node ../scripts/seed-products.js [options]

Options:
  --config <path>   JSON array of products (default: scripts/products.placeholder.json)
  --dry-run         Validate and print payload only
  --help            Show this message
`);
}

function parseNonNegativeNumber(value, label) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  throw new Error(`${label}: expected a non-negative number, got ${JSON.stringify(value)}`);
}

function normalizeProduct(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Each product must be a JSON object");
  }
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  if (!id) throw new Error("product.id is required");
  if (!name) throw new Error(`product ${id}: name is required`);
  if (!CATEGORIES.has(category)) {
    throw new Error(`product ${id}: category must be "bin" or "liner"`);
  }

  return {
    id,
    payload: {
      name,
      description: typeof input.description === "string" ? input.description.trim() : "",
      price: parseNonNegativeNumber(input.price, `${id}.price`),
      imageUrl: typeof input.imageUrl === "string" ? input.imageUrl.trim() : "",
      category,
      enabled: input.enabled !== false,
      sortOrder: parseNonNegativeNumber(input.sortOrder ?? 0, `${id}.sortOrder`),
      pricePlaceholder: input.pricePlaceholder === true,
    },
  };
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
      "Then run: npm run seed:products"
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

  const configPath = path.resolve(
    args.configPath || path.join(__dirname, "products.placeholder.json")
  );
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const loaded = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!Array.isArray(loaded)) {
    throw new Error("Products config must be a JSON array");
  }
  const products = loaded.map(normalizeProduct);

  console.log("Products to write:");
  console.log(JSON.stringify(products, null, 2));

  if (args.dryRun) {
    console.log("\nDry run — no changes written.");
    return;
  }

  const admin = loadFirebaseAdmin();
  initAdmin(admin);
  const db = admin.firestore();
  const batch = db.batch();

  for (const product of products) {
    const ref = db.collection(PRODUCTS_COLLECTION).doc(product.id);
    batch.set(
      ref,
      {
        ...product.payload,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        seededBy: "scripts/seed-products.js",
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log(`\n✅ Wrote ${products.length} docs to ${PRODUCTS_COLLECTION}`);
}

main().catch((err) => {
  console.error("Failed to seed products:", err.message || err);
  process.exit(1);
});
