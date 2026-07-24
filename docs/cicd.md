# CI/CD

CyberBlade 3D uses short-lived branches and `main` as the only long-lived
branch. Pull requests run CI. A successful merge to `main` runs the selective
Production workflow.

## Workflows

- `ci.yml` runs workspace typechecks/tests, Web and Mobile exports, and Go
  checks for pull requests.
- `cd-production.yml` classifies the changed files, verifies the exact
  Production revision, and deploys only affected targets.

The target classifier is implemented and tested in
`scripts/ci/detect-deploy-targets.mjs`.

## Deployment mapping

| Change | Web | Server | Mobile |
| --- | --- | --- | --- |
| `apps/web/**` | deploy | - | - |
| `services/api/**` | - | deploy | - |
| Mobile JavaScript/assets | - | - | OTA |
| Mobile native configuration/dependencies | - | - | native build |
| Shared game runtime packages | deploy | - | OTA |
| TypeScript or Go wire protocol | deploy | deploy | OTA |
| Documentation and tests only | - | - | - |

`pnpm-lock.yaml` is conservatively treated as Web plus a native Mobile build.
This can be narrowed after Expo native fingerprinting is added.

## GitHub Production environment

Create one GitHub Environment named `production`. Configure these repository or
environment variables:

| Variable | Purpose |
| --- | --- |
| `ENABLE_SERVER_DEPLOY` | Set to `true` after the Server hook is ready |
| `ENABLE_WEB_DEPLOY` | Set to `true` after the Web hook is ready |
| `ENABLE_MOBILE_DEPLOY` | Set to `true` after EAS is fully configured |
| `PUBLIC_WS_URL` | Public `wss://` endpoint used by both clients |
| `SERVER_HEALTH_URL` | Public Server `/health` URL |
| `WEB_URL` | Public Web URL used by the smoke test |

Configure these secrets:

| Secret | Purpose |
| --- | --- |
| `SERVER_DEPLOY_HOOK_URL` | Server hosting deployment endpoint |
| `SERVER_DEPLOY_HOOK_TOKEN` | Optional bearer token for the endpoint |
| `WEB_DEPLOY_HOOK_URL` | Web hosting deployment endpoint |
| `WEB_DEPLOY_HOOK_TOKEN` | Optional bearer token for the endpoint |
| `EXPO_TOKEN` | EAS Build, Update, and Submit authentication |

All `ENABLE_*_DEPLOY` variables default to disabled when absent. This lets the
workflows merge safely before Production credentials and hosting exist.

## Hosting hook contract

The Server and Web jobs publish immutable images to GHCR:

```text
ghcr.io/<owner>/<repository>/server:<commit-sha>
ghcr.io/<owner>/<repository>/web:<commit-sha>
```

They then send an authenticated `POST` request to the configured hook:

```json
{
  "image": "ghcr.io/owner/repository/server:commit-sha",
  "revision": "commit-sha"
}
```

The hook must deploy the exact image, wait until the rollout is ready, and only
then return a successful HTTP response. The workflow performs an external smoke
test after the hook returns.

The hook is the only provider-specific seam in the initial architecture.
Replace it with a provider CLI or OIDC deployment later if the selected hosting
platform supports a stronger integration.

## Mobile activation

`apps/mobile/eas.json` defines a single `production` profile and channel. Before
setting `ENABLE_MOBILE_DEPLOY=true`:

1. Link the app to the intended EAS project with `eas init`.
2. Configure EAS Update with `eas update:configure`. This adds the real project
   ID, updates URL, runtime version policy, and required native dependency.
3. Create the EAS `production` environment variable
   `EXPO_PUBLIC_BEYBLADE_WS_URL`.
4. Configure iOS and Android signing credentials.
5. Complete the first App Store and Play Store submissions manually where the
   stores require it.

JavaScript-compatible changes use EAS Update. Changes to `app.json`,
`eas.json`, or the Mobile package dependency declaration create and submit new
iOS and Android binaries.

## Manual deployment

`Deploy Production` supports manual runs against a commit on `main`:

```text
auto
web
server
mobile-ota
mobile-native
all
```

Use an explicit target to retry one failed component without redeploying the
others.

## Branch protection

Protect `main` with:

- pull requests required;
- the `Quality Gate` status check required;
- direct pushes disabled;
- squash merge enabled;
- branch deletion after merge.

Production deployment jobs use separate concurrency groups for Web, Server,
and Mobile. Unrelated targets can deploy independently, while a change that
also deploys Server must pass the Server gate before either client is released.

## Follow-up hardening

- Pin third-party GitHub Actions to full commit SHAs.
- Expose the deployed revision from Server `/health` and Web `/version.json`,
  then make smoke tests verify the exact SHA.
- Add a WebSocket protocol smoke test.
- Add Server connection draining before enabling unattended deployments.
- Read each target's last successful Production SHA when detecting changes, so
  a later merge automatically retries changes left behind by a failed deploy.
- Add a target-specific rollback workflow after the hosting provider is chosen.
