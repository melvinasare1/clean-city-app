// Source - https://stackoverflow.com/a
// Posted by harsh_v
// Retrieved 2025-11-27, License - CC BY-SA 4.0

const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;
module.exports = config;
