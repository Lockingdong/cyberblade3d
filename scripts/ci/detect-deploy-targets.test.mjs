import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDeployTargets,
  overrideDeployTargets,
} from "./detect-deploy-targets.mjs";

test("deploys only the web app for web runtime changes", () => {
  assert.deepEqual(classifyDeployTargets(["apps/web/src/App.tsx"]), {
    web: true,
    api: false,
    mobile: "none",
  });
});

test("deploys only the api for api implementation changes", () => {
  assert.deepEqual(
    classifyDeployTargets(["services/api/internal/matchmaking/hub.go"]),
    {
      web: false,
      api: true,
      mobile: "none",
    },
  );
});

test("publishes an OTA update for mobile JavaScript changes", () => {
  assert.deepEqual(classifyDeployTargets(["apps/mobile/App.tsx"]), {
    web: false,
    api: false,
    mobile: "ota",
  });
});

test("builds a native binary for mobile configuration changes", () => {
  assert.deepEqual(classifyDeployTargets(["apps/mobile/app.json"]), {
    web: false,
    api: false,
    mobile: "native",
  });
});

test("deploys both clients for shared runtime changes", () => {
  assert.deepEqual(
    classifyDeployTargets(["packages/core/src/index.ts"]),
    {
      web: true,
      api: false,
      mobile: "ota",
    },
  );
});

test("deploys every runtime when the wire protocol changes", () => {
  assert.deepEqual(
    classifyDeployTargets(["packages/multiplayer/src/protocol.ts"]),
    {
      web: true,
      api: true,
      mobile: "ota",
    },
  );
});

test("rebuilds both containers when their shared Docker context changes", () => {
  assert.deepEqual(classifyDeployTargets([".dockerignore"]), {
    web: true,
    api: true,
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
      api: false,
      mobile: "none",
    },
  );
});

test("manual override selects exactly the requested target", () => {
  assert.deepEqual(
    overrideDeployTargets(
      { web: true, api: true, mobile: "native" },
      "api",
    ),
    {
      web: false,
      api: true,
      mobile: "none",
    },
  );
});
