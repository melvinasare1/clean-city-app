const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Pin a single React copy, but allow nested Expo packages (expo-font -> expo-asset)
// to resolve. `disableHierarchicalLookup` breaks those nested deps in this repo.
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
};
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enablePackageExports = false;

if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);

config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);

if (!config.resolver.sourceExts.includes('svg')) {
  config.resolver.sourceExts.push('svg');
}

module.exports = config;
