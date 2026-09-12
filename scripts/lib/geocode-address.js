const fs = require("fs");
const path = require("path");

const ACCRA_PROXIMITY = "-0.1870,5.6037";

function loadEnvFiles() {
  const files = [
    path.join(__dirname, "..", "..", ".env"),
    path.join(__dirname, "..", "..", "apps", "driver", ".env"),
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

function mapboxToken() {
  for (const value of [
    process.env.MAPBOX_ACCESS_TOKEN,
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
  ]) {
    if (typeof value === "string" && value.length > 0 && !value.includes("${")) {
      return value;
    }
  }
  return "";
}

function parsePickupCoordinates(value) {
  if (!value || typeof value !== "object") return null;
  const lat = typeof value.lat === "number" ? value.lat : Number(value.lat);
  const lng = typeof value.lng === "number" ? value.lng : Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function addressQueryFromJob(params) {
  const snapshot = params.addressSnapshot || {};
  const parts = [snapshot.addressLine1, snapshot.area, params.location]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return [...new Set(parts)].join(", ");
}

async function geocodeAddressToPickup(address, options = {}) {
  const first = await geocodeOnce(address, options);
  if (first) return first;
  if (options.country === "") return null;
  return geocodeOnce(address, { country: "" });
}

async function geocodeOnce(address, options = {}) {
  loadEnvFiles();
  const query = String(address || "").trim();
  const token = mapboxToken();
  if (!query || !token) return null;

  const params = new URLSearchParams({
    q: query,
    access_token: token,
    permanent: "true",
    limit: "1",
    autocomplete: "false",
  });
  const country = options.country === undefined ? "gh" : options.country;
  if (country) params.set("country", country);
  if (country === "gh") params.set("proximity", ACCRA_PROXIMITY);

  const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[geocodeAddressToPickup] Mapbox error", res.status, await res.text().catch(() => ""));
    return null;
  }

  const body = await res.json();
  const coordinates = body.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  return parsePickupCoordinates({ lng: coordinates[0], lat: coordinates[1] });
}

module.exports = {
  addressQueryFromJob,
  geocodeAddressToPickup,
  parsePickupCoordinates,
};
