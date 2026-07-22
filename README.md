# CyberBlade 3D

Beyblade-inspired 3D battle game implemented as a first-class Game Pool module.

## Architecture

```text
apps/web/              React + Vite browser client
apps/mobile/           Expo + React Native client
packages/core/         platform-neutral rules and runtime
packages/simulation/   deterministic Cannon physics adapter
packages/visuals/      shared procedural Three.js scene objects
services/api/           Go WebSocket matchmaking service
design_docs/           future product and online-play plans
```

Both clients use the same rules, physics snapshots, procedural models and battle
events. Platform code owns only the canvas, controls, HUD and feedback adapter.
Online matches use the game-owned WebSocket service and do not require the
platform API or a database.

## Gameplay

- Four tops: attack, defense, stamina and balance.
- Three procedural stadium themes: neon, toxic and volcano.
- Timing-based launch with an 85–95% perfect window.
- Fixed-step physics, type-specific AI, collision damage and spin decay.
- Burst, over, spin and 20-second time finishes.
- Shared sparks, trails, burst debris and cinematic camera tracking.

## Development

From the repository root:

```sh
pnpm install
pnpm --filter @game-pool/beyblade-web dev
pnpm --filter @game-pool/beyblade-mobile dev
go run ./games/beyblade/services/api/cmd/api
```

Run package checks with:

```sh
pnpm --filter './games/beyblade/**' typecheck
pnpm --filter './games/beyblade/**' test
pnpm --filter './games/beyblade/**' build
go test ./games/beyblade/services/api/...
```

The native renderer uses Expo GL and React Three Fiber. Test 3D behavior on a
physical iOS or Android device in addition to the automated Expo export.

The Web and API container targets are declared in
[`../../deploy/targets.json`](../../deploy/targets.json). Deployment logic is
shared by deployable type rather than duplicated for this game.
