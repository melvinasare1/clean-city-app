/**
 * Dynamic Expo config.
 * - Disables OTA updates on development EAS builds so the dev client can load Metro.
 * - Adds iOS local-network keys so physical devices can reach the packager.
 */
const appJson = require("./app.json");

const buildProfile = process.env.EAS_BUILD_PROFILE;
const isDevelopmentBuild = buildProfile === "development";

module.exports = {
  expo: {
    ...appJson.expo,
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
