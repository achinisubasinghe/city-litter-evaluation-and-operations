const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root to allow importing from convex/
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages and aliases
config.resolver.extraNodeModules = {
  '@convex': path.resolve(monorepoRoot, 'convex'),
};

module.exports = config;
