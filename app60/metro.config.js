// Metro configuration for Expo
// Purpose: avoid scanning native dependency trees like ios/Pods which can hang Metro startup.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

const localModules = path.join(projectRoot, "node_modules");
const parentModules = path.join(workspaceRoot, "node_modules");

// Em monorepos, dependências podem ser hoistadas para ../node_modules.
// A gente observa apenas essa pasta (não o repo inteiro) para evitar varredura gigante e travamentos.
const watch = config.watchFolders ?? [];
if (!watch.some((p) => path.resolve(p) === parentModules)) {
  config.watchFolders = [...watch, parentModules];
}

const basePaths = config.resolver?.nodeModulesPaths ?? [localModules];
const nodeModulesPaths = basePaths.includes(parentModules)
  ? basePaths
  : [...basePaths, parentModules];
config.resolver = { ...config.resolver, nodeModulesPaths };

const blockListPatterns = [
  // CocoaPods
  new RegExp(`${escapeRegExp(path.join(projectRoot, "ios", "Pods"))}\\/.*`),
  // Gradle & Android build outputs (safe to ignore for Metro)
  new RegExp(`${escapeRegExp(path.join(projectRoot, "android", "build"))}\\/.*`),
  new RegExp(`${escapeRegExp(path.join(projectRoot, "android", "app", "build"))}\\/.*`),
];

const useLatestCallbackShim = path.join(projectRoot, "metro-shims", "use-latest-callback.js");
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "use-latest-callback") {
    return { type: "sourceFile", filePath: useLatestCallbackShim };
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver = {
  ...config.resolver,
  // Metro expects a single RegExp.
  // `exclusionList()` isn't exported from metro-config in this version, so we compose it ourselves.
  blockList: new RegExp(blockListPatterns.map((r) => r.source).join("|")),
};

module.exports = config;

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

