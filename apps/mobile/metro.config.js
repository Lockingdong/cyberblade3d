/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("cjs", "mjs");

// `packages/visuals` and the app each have their own `node_modules/three`
// symlink. They point at the same physical package, but Metro keys modules by
// the path it resolved, so it bundles and evaluates three twice — which is
// what three's own "Multiple instances of Three.js being imported" warning is
// reporting, and it costs real memory in a scene this size. Pinning the
// specifier to one directory collapses them back into a single instance.
// Resolved through the filesystem rather than `require.resolve`, because
// three's `exports` map does not expose `./package.json`.
const THREE_ROOT = fs.realpathSync(path.join(__dirname, "node_modules/three"));
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three" || moduleName.startsWith("three/")) {
    const rest = moduleName.slice("three".length);
    return context.resolveRequest(
      context,
      path.join(THREE_ROOT, rest),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
