/**
 * Deploy Firestore security rules (and indexes) using the Firebase CLI.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/deploy-firestore-rules.js
 *
 * Requires: firebase-tools (`npm i -g firebase-tools` or `npx firebase`)
 */

const { spawnSync } = require("child_process");
const path = require("path");

const projectId = process.env.FIREBASE_PROJECT_ID || "clean-city-app-f9d73";
const repoRoot = path.join(__dirname, "..");

function runFirebase(args) {
  const bin = process.platform === "win32" ? "firebase.cmd" : "firebase";
  const result = spawnSync(bin, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    console.error("Install Firebase CLI: npm i -g firebase-tools");
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Deploying Firestore rules to project: ${projectId}`);
runFirebase(["deploy", "--only", "firestore:rules,firestore:indexes", "--project", projectId]);
console.log("Done.");
