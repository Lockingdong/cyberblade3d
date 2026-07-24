import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDeployTargets,
  overrideDeployTargets,
} from "./detect-deploy-targets.mjs";

test("deploys only the web app for web runtime changes", () => {
  assert.deepEqual(classifyDeployTargets(["apps/web/src/App.tsx"]), {
    web: true,
    server: false,
    mobile: "none",
  });
});

test("deploys only the server for server implementation changes", () => {
  assert.deepEqual(
    classifyDeployTargets(["services/api/internal/matchmaking/hub.go"]),
    {
      web: false,
      server: true,
      mobile: "none",
    },
  );
});

test("publishes an OTA update for mobile JavaScript changes", () => {
  assert.deepEqual(classifyDeployTargets(["apps/mobile/App.tsx"]), {
    web: false,
    server: false,
    mobile: "ota",
  });
});

test("builds a native binary for mobile configuration changes", () => {
  assert.deepEqual(classifyDeployTargets(["apps/mobile/app.json"]), {
    web: false,
    server: false,
    mobile: "native",
  });
});

test("deploys both clients for shared runtime changes", () => {
  assert.deepEqual(
    classifyDeployTargets(["packages/core/src/index.ts"]),
    {
      web: true,
      server: false,
      mobile: "ota",
    },
  );
});

test("deploys every runtime when the wire protocol changes", () => {
  assert.deepEqual(
    classifyDeployTargets(["packages/multiplayer/src/protocol.ts"]),
    {
      web: true,
      server: true,
      mobile: "ota",
    },
  );
});

test("rebuilds both containers when their shared Docker context changes", () => {
  assert.deepEqual(classifyDeployTargets([".dockerignore"]), {
    web: true,
    server: true,
    mobile: "none",
  });
});

test("does not deploy for documentation and test-only changes", () => {
  assert.deepEqual(
    classifyDeployTargets([
      "README.md",
      "apps/web/src/App.test.tsx",
      "services/api/internal/matchmaking/hub_test.go",
    ]),
    {
      web: false,
      server: false,
      mobile: "none",
    },
  );
});

test("manual override selects exactly the requested target", () => {
  assert.deepEqual(
    overrideDeployTargets(
      { web: true, server: true, mobile: "native" },
      "server",
    ),
    {
      web: false,
      server: true,
      mobile: "none",
    },
  );
});
