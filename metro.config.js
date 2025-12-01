// Source - https://stackoverflow.com/a
// Posted by harsh_v
// Retrieved 2025-11-27, License - CC BY-SA 4.0

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Keep this setting if your project needs it
config.resolver.unstable_enablePackageExports = false;

// Add support for .cjs files
if (!config.resolver.sourceExts.includes("cjs")) {
  config.resolver.sourceExts.push("cjs");
}

// Wire up react-native-svg-transformer
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);

// Remove "svg" from assetExts
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);

// Ensure "svg" is only added once to sourceExts
if (!config.resolver.sourceExts.includes("svg")) {
  config.resolver.sourceExts.push("svg");
}

module.exports = config;
