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

const iosMapsKey = envValue(
  appJson.expo.ios?.config?.googleMapsApiKey,
  "EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY"
);
const androidMapsKey = envValue(
  appJson.expo.android?.config?.googleMaps?.apiKey,
  "EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY"
);

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      config: {
        ...appJson.expo.ios?.config,
        googleMapsApiKey: iosMapsKey,
      },
      infoPlist: {
        ...appJson.expo.ios?.infoPlist,
        NSLocalNetworkUsageDescription:
          "Clean City needs access to your local network to load the app from your development computer.",
        NSBonjourServices: ["_expo._tcp"],
      },
    },
    android: {
      ...appJson.expo.android,
      config: {
        ...appJson.expo.android?.config,
        googleMaps: {
          ...appJson.expo.android?.config?.googleMaps,
          apiKey: androidMapsKey,
        },
      },
    },
    extra: {
      ...appJson.expo.extra,
      aptabaseKey: envValue(
        appJson.expo.extra?.aptabaseKey,
        "EXPO_PUBLIC_APTABASE_KEY"
      ),
      googlePlacesApiKey: envValue(
        appJson.expo.extra?.googlePlacesApiKey,
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY"
      ),
    },
    updates: {
      ...appJson.expo.updates,
      enabled: isDevelopmentBuild ? false : true,
      checkAutomatically: isDevelopmentBuild ? "NEVER" : "ON_LOAD",
      fallbackToCacheTimeout: isDevelopmentBuild ? 0 : 30000,
    },
  },
};
