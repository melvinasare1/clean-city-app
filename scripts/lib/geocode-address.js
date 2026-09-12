const fs = require("fs");
const path = require("path");

const ACCRA_PROXIMITY = "-0.2070,5.5480";

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

function extraQueryBeyondCity(query, name) {
  const q = String(query || "")
    .toLowerCase()
    .replace(/,/g, " ");
  const city = String(name || "").toLowerCase();
  const remainder = q
    .replace(city, " ")
    .replace(/\bghana\b/g, " ")
    .replace(/\bgreater accra\b/g, " ")
    .replace(/\baccra\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return remainder.length > 0;
}

const GENERIC_GEO_TOKENS = new Set([
  "accra",
  "ghana",
  "greater",
  "west",
  "western",
  "east",
  "eastern",
  "central",
  "north",
  "south",
  "region",
  "district",
  "area",
  "city",
  "market",
]);

function significantTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !GENERIC_GEO_TOKENS.has(word));
}

function featureMatchesQuery(query, featureName) {
  const queryTokens = significantTokens(query);
  if (queryTokens.length === 0) return true;
  const nameTokens = significantTokens(featureName);
  if (nameTokens.length === 0) return false;
  return nameTokens.some((token) => queryTokens.includes(token));
}

function isTooCoarse(query, hit) {
  if (!hit) return true;
  const type = hit.featureType || "";
  if (type === "country" || type === "region") return true;
  if (type === "place" && extraQueryBeyondCity(query, hit.name)) return true;
  if (!featureMatchesQuery(query, hit.name)) return true;
  return false;
}

async function geocodeAddressToPickup(address, options = {}) {
  loadEnvFiles();
  const query = String(address || "").trim();
  if (!query) return null;

  const mapbox = await geocodeMapbox(query, options);
  if (mapbox && !isTooCoarse(query, mapbox)) {
    return { lat: mapbox.lat, lng: mapbox.lng };
  }

  const nominatim = await geocodeNominatim(query);
  return nominatim ? { lat: nominatim.lat, lng: nominatim.lng } : null;
}

async function geocodeMapbox(address, options = {}) {
  const token = mapboxToken();
  if (!token) return null;

  const params = new URLSearchParams({
    q: address,
    access_token: token,
    permanent: "true",
    limit: "5",
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
  for (const feature of body.features || []) {
    const coordinates = feature.geometry?.coordinates;
    const parsed = Array.isArray(coordinates)
      ? parsePickupCoordinates({ lng: coordinates[0], lat: coordinates[1] })
      : null;
    if (!parsed) continue;
    const hit = {
      ...parsed,
      name: feature.properties?.name,
      featureType: feature.properties?.feature_type,
    };
    if (!isTooCoarse(address, hit)) return hit;
  }
  return null;
}

async function geocodeNominatim(address) {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "gh",
    viewbox: "-0.35,5.75,-0.05,5.45",
    bounded: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": "CleanCity/1.0 (job-pickup-geocode)" },
  });
  if (!res.ok) {
    console.error("[geocodeAddressToPickup] Nominatim error", res.status);
    return null;
  }
  const body = await res.json();
  const first = body[0];
  if (!first) return null;
  return parsePickupCoordinates({ lat: first.lat, lng: first.lon });
}

module.exports = {
  addressQueryFromJob,
  geocodeAddressToPickup,
  parsePickupCoordinates,
};
