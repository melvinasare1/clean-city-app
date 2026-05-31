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
      },
    },
    updates: {
      ...appJson.expo.updates,
      // OTA on launch blocks Metro when no published update exists for the channel.
      enabled: isDevelopmentBuild ? false : true,
      checkAutomatically: isDevelopmentBuild ? "NEVER" : "ON_LOAD",
      fallbackToCacheTimeout: isDevelopmentBuild ? 0 : 30000,
    },
  },
};
