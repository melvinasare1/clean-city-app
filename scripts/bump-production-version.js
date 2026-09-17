/**
 * Bumps expo.version patch (1.0.0 → 1.0.1).
 *
 * Production EAS builds: maybeBumpProductionAppVersion() from app.config.js.
 * OTA hotfixes: `node scripts/bump-production-version.js <appDir> --hotfix`
 *   (does not change runtimeVersion, so existing store binaries still update).
 */
const fs = require("fs");
const path = require("path");

const STATE_FILE = "version-bump.json";
const REUSE_WINDOW_MS = 30 * 60 * 1000;

function bumpPatch(version) {
  const parts = String(version).trim().split(".");
  while (parts.length < 3) parts.push("0");
  const patch = Number.parseInt(parts[2], 10);
  if (Number.isNaN(patch)) {
    throw new Error(`Cannot bump version: ${version}`);
  }
  parts[2] = String(patch + 1);
  return parts.join(".");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function replaceFirstVersion(filePath, nextVersion) {
  const text = fs.readFileSync(filePath, "utf8");
  let replaced = false;
  const updated = text.replace(/"version"\s*:\s*"[^"]+"/, (match) => {
    if (replaced) return match;
    replaced = true;
    return `"version": "${nextVersion}"`;
  });
  if (!replaced) {
    throw new Error(`No version field in ${filePath}`);
  }
  fs.writeFileSync(filePath, updated);
}

function readState(statePath) {
  try {
    return readJson(statePath);
  } catch {
    return { lastProductionVersion: null, bumpedAt: 0 };
  }
}

function resolveNextVersion(currentVersion, state) {
  const last = state.lastProductionVersion;
  const bumpedAt = Number(state.bumpedAt) || 0;
  const recentlyBumped = Date.now() - bumpedAt < REUSE_WINDOW_MS;

  if (last == null) {
    return bumpPatch(currentVersion);
  }

  if (last !== currentVersion) {
    return currentVersion;
  }

  if (recentlyBumped) {
    return currentVersion;
  }

  return bumpPatch(currentVersion);
}

function writeState(statePath, nextVersion, extra = {}) {
  fs.writeFileSync(
    statePath,
    `${JSON.stringify(
      {
        lastProductionVersion: nextVersion,
        bumpedAt: Date.now(),
        ...extra,
      },
      null,
      2
    )}\n`
  );
}

/**
 * OTA hotfix: bump expo.version patch (1.0.0 → 1.0.1) without changing
 * runtimeVersion, so existing store binaries still receive the update.
 */
function bumpHotfixAppVersion(appDir) {
  const appJsonPath = path.join(appDir, "app.json");
  const pkgPath = path.join(appDir, "package.json");
  const statePath = path.join(appDir, STATE_FILE);

  const appJson = readJson(appJsonPath);
  const currentVersion = appJson.expo?.version;
  if (!currentVersion) {
    throw new Error(`Missing expo.version in ${appJsonPath}`);
  }

  const nextVersion = bumpPatch(currentVersion);
  replaceFirstVersion(appJsonPath, nextVersion);
  if (fs.existsSync(pkgPath)) {
    replaceFirstVersion(pkgPath, nextVersion);
  }

  writeState(statePath, nextVersion, { lastHotfixVersion: nextVersion });
  console.log(
    `[hotfix] ${path.basename(appDir)} ${currentVersion} → ${nextVersion}`
  );
  return nextVersion;
}

function maybeBumpProductionAppVersion(appDir) {
  if (process.env.CLEAN_CITY_SKIP_VERSION_BUMP === "1") return null;
  if (process.env.CLEAN_CITY_HOTFIX === "1") return null;
  if (process.env.EAS_BUILD_PROFILE !== "production") return null;
  if (process.env.EAS_BUILD === "true" || process.env.EAS_BUILD === "1") return null;

  const appJsonPath = path.join(appDir, "app.json");
  const pkgPath = path.join(appDir, "package.json");
  const statePath = path.join(appDir, STATE_FILE);

  const appJson = readJson(appJsonPath);
  const currentVersion = appJson.expo?.version;
  if (!currentVersion) {
    throw new Error(`Missing expo.version in ${appJsonPath}`);
  }

  const state = readState(statePath);
  const nextVersion = resolveNextVersion(currentVersion, state);
  if (nextVersion === currentVersion && state.lastProductionVersion === currentVersion) {
    return currentVersion;
  }

  if (nextVersion !== currentVersion) {
    replaceFirstVersion(appJsonPath, nextVersion);
    if (fs.existsSync(pkgPath)) {
      replaceFirstVersion(pkgPath, nextVersion);
    }
  }

  writeState(statePath, nextVersion);

  if (nextVersion !== currentVersion) {
    console.log(
      `[version] ${path.basename(appDir)} ${currentVersion} → ${nextVersion}`
    );
  } else {
    console.log(
      `[version] ${path.basename(appDir)} using ${nextVersion} (manual bump)`
    );
  }

  return nextVersion;
}

module.exports = {
  bumpPatch,
  bumpHotfixAppVersion,
  maybeBumpProductionAppVersion,
  resolveNextVersion,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const hotfix = args.includes("--hotfix");
  const dirArg = args.find((arg) => arg !== "--hotfix");
  const appDir = path.resolve(dirArg || process.cwd());
  if (hotfix) {
    bumpHotfixAppVersion(appDir);
  } else {
    process.env.EAS_BUILD_PROFILE =
      process.env.EAS_BUILD_PROFILE || "production";
    maybeBumpProductionAppVersion(appDir);
  }
}
