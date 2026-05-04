// app60/metro.config.js
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const localModules = path.join(projectRoot, "node_modules");

config.watchFolders = [projectRoot];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [localModules],

  blockList: new RegExp(
    [
      escapeRegExp(path.join(projectRoot, "ios", "Pods")) + "\\/.*",
      escapeRegExp(path.join(projectRoot, "android", "build")) + "\\/.*",
      escapeRegExp(path.join(projectRoot, "android", "app", "build")) + "\\/.*",
    ].join("|")
  ),
};

const useLatestCallbackShim = path.join(
  projectRoot,
  "metro-shims",
  "use-latest-callback.js"
);

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

module.exports = config;

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}