#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MOBILE_RELEASE_RANK = {
  none: 0,
  ota: 1,
  native: 2,
};

function isTestOrDocumentation(file) {
  return (
    file.endsWith(".md") ||
    file.startsWith("design_docs/") ||
    file.startsWith(".github/") ||
    file.startsWith("scripts/ci/") ||
    /(^|\/)(__tests__|testdata|fixtures)\//.test(file) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
    /(^|\/)[^/]+_test\.go$/.test(file)
  );
}

function startsWithAny(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function promoteMobile(current, next) {
  return MOBILE_RELEASE_RANK[next] > MOBILE_RELEASE_RANK[current]
    ? next
    : current;
}

export function classifyDeployTargets(changedFiles) {
  let web = false;
  let server = false;
  let mobile = "none";

  for (const file of changedFiles) {
    if (!file || isTestOrDocumentation(file)) continue;

    const wireProtocolChanged =
      file === "packages/multiplayer/src/protocol.ts" ||
      file === "services/api/internal/matchmaking/protocol.go";

    if (wireProtocolChanged) {
      web = true;
      server = true;
      mobile = promoteMobile(mobile, "ota");
      continue;
    }

    if (file.startsWith("services/api/")) {
      server = true;
      continue;
    }

    if (file.startsWith("apps/web/")) {
      web = true;
      continue;
    }

    if (
      file === "apps/mobile/app.json" ||
      file === "apps/mobile/app.config.js" ||
      file === "apps/mobile/app.config.ts" ||
      file === "apps/mobile/eas.json" ||
      file === "apps/mobile/package.json"
    ) {
      mobile = promoteMobile(mobile, "native");
      continue;
    }

    if (file.startsWith("apps/mobile/")) {
      mobile = promoteMobile(mobile, "ota");
      continue;
    }

    if (
      startsWithAny(file, [
        "packages/config-typescript/",
        "packages/core/",
        "packages/simulation/",
        "packages/visuals/",
        "packages/multiplayer/",
        "packages/game-runtime/",
      ])
    ) {
      web = true;
      mobile = promoteMobile(mobile, "ota");
      continue;
    }

    if (file.startsWith("packages/design-system/")) {
      mobile = promoteMobile(mobile, "ota");
      continue;
    }

    // Lockfile changes can alter both JavaScript bundles and the native
    // dependency graph. Treat them conservatively until native fingerprinting
    // is introduced.
    if (
      file === "pnpm-lock.yaml" ||
      file === "pnpm-workspace.yaml" ||
      file === "package.json"
    ) {
      web = true;
      mobile = promoteMobile(mobile, "native");
    }

    if (file === ".dockerignore") {
      web = true;
      server = true;
    }
  }

  return { web, server, mobile };
}

export function overrideDeployTargets(targets, override) {
  switch (override) {
    case undefined:
    case "":
    case "auto":
      return targets;
    case "web":
      return { web: true, server: false, mobile: "none" };
    case "server":
      return { web: false, server: true, mobile: "none" };
    case "mobile-ota":
      return { web: false, server: false, mobile: "ota" };
    case "mobile-native":
      return { web: false, server: false, mobile: "native" };
    case "all":
      return { web: true, server: true, mobile: "native" };
    default:
      throw new Error(`Unknown deployment override: ${override}`);
  }
}

function readChangedFiles(before, after) {
  const zeroSha = /^0+$/;
  const args =
    !before || zeroSha.test(before)
      ? ["ls-tree", "-r", "--name-only", after]
      : ["diff", "--name-only", before, after];

  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function readArgument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function main() {
  const before = readArgument("--before");
  const after = readArgument("--after", "HEAD");
  const override = readArgument("--override", "auto");
  const files = readChangedFiles(before, after);
  const targets = overrideDeployTargets(classifyDeployTargets(files), override);

  process.stdout.write(`web=${String(targets.web)}\n`);
  process.stdout.write(`server=${String(targets.server)}\n`);
  process.stdout.write(`mobile=${targets.mobile}\n`);
  process.stderr.write(
    `Deployment targets for ${files.length} changed file(s): ${JSON.stringify(targets)}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
