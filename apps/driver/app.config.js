/**
 * Dynamic Expo config.
 * - Resolves ${ENV} placeholders from app.json (Expo does not interpolate them).
 * - Disables OTA updates on development EAS builds so the dev client can load Metro.
 * - Adds iOS local-network keys so physical devices can reach the packager.
 * - Bumps expo.version patch on production EAS builds.
 */
const { maybeBumpProductionAppVersion } = require("../../scripts/bump-production-version");

maybeBumpProductionAppVersion(__dirname);
delete require.cache[require.resolve("./app.json")];
const appJson = require("./app.json");

const buildProfile = process.env.EAS_BUILD_PROFILE;
const isDevelopmentBuild = buildProfile === "development";

function envValue(placeholderOrValue, envName) {
  const fromEnv = process.env[envName];
  if (typeof fromEnv === "string" && fromEnv.length > 0 && !fromEnv.includes("${")) {
    return fromEnv;
  }
  if (
    typeof placeholderOrValue === "string" &&
    placeholderOrValue.length > 0 &&
    !placeholderOrValue.includes("${")
  ) {
    return placeholderOrValue;
  }
  return "";
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      aptabaseKey: envValue(
        appJson.expo.extra?.aptabaseKey,
        "EXPO_PUBLIC_APTABASE_KEY"
      ),
      mapboxAccessToken: envValue(
        appJson.expo.extra?.mapboxAccessToken,
        "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN"
      ),
    },
    ios: {
      ...appJson.expo.ios,
      infoPlist: {
        ...appJson.expo.ios?.infoPlist,
        NSLocalNetworkUsageDescription:
          "Clean City needs access to your local network to load the app from your development computer.",
        NSBonjourServices: ["_expo._tcp"],
        NSLocationWhenInUseUsageDescription:
          "Clean City uses your location while you use the app to show you on the map and match you with nearby jobs.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Clean City Driver uses your location in the background only while you are online so dispatch can see nearby available drivers and assign jobs. Location sharing stops when you go offline.",
        NSLocationAlwaysUsageDescription:
          "Clean City Driver uses your location in the background only while you are online so dispatch can see nearby available drivers and assign jobs. Location sharing stops when you go offline.",
        UIBackgroundModes: ["location"],
      },
    },
    updates: {
      ...appJson.expo.updates,
      enabled: isDevelopmentBuild ? false : Boolean(appJson.expo.updates?.url),
      checkAutomatically: isDevelopmentBuild ? "NEVER" : "ON_LOAD",
      fallbackToCacheTimeout: isDevelopmentBuild ? 0 : 30000,
    },
  },
};
