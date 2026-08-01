# CI/CD

CyberBlade 3D uses short-lived branches and `main` as the only long-lived
branch. Pull requests run CI. Production deployment is release-tag driven and
does not run when commits are pushed or merged to `main`.

## Workflows

- `ci.yml` runs workspace typechecks/tests, Web and Mobile exports, and Go
  checks for pull requests.
- `cd-production.yml` validates `web-v<major>.<minor>.<patch>` tags, verifies the
  exact tagged revision, and deploys Web to Production.

The target classifier in `scripts/ci/detect-deploy-targets.mjs` remains covered
by CI but is not used by the tag-driven Production workflow.

## Production release tags

| Tag | Status | Target |
| --- | --- | --- |
| `web-v1.2.3` | Active | Web Production |
| `server-v1.2.3` | Reserved | Server Production |
| `mobile-v1.2.3` | Reserved | iOS and Android Production |

Only stable three-part semantic versions are accepted for Web releases. Create
the tag on the exact commit to release, then push that tag:

```sh
git tag -a web-v1.2.3 -m "Release web-v1.2.3"
git push origin web-v1.2.3
```

Server and Mobile tag filters are intentionally left as comments in the
workflow until those deployment paths are enabled.

## GitHub Production environment

Create one GitHub Environment named `production`. Configure these repository or
environment variables:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_WS_URL` | Public `wss://` endpoint embedded in the Web build |
| `WEB_URL` | Public Web URL used by the smoke test |

Configure these secrets:

| Secret | Purpose |
| --- | --- |
| `WEB_DEPLOY_HOOK_URL` | Web hosting deployment endpoint |
| `WEB_DEPLOY_HOOK_TOKEN` | Optional bearer token for the endpoint |

## Hosting hook contract

The Web job publishes an immutable image to GHCR:

```text
ghcr.io/<owner>/<repository>/web:<commit-sha>
```

It then sends an authenticated `POST` request to the configured hook:

```json
{
  "image": "ghcr.io/owner/repository/web:commit-sha",
  "revision": "commit-sha"
}
```

The hook must deploy the exact image, wait until the rollout is ready, and only
then return a successful HTTP response. The workflow performs an external smoke
test after the hook returns.

The hook is the only provider-specific seam in the initial architecture.
Replace it with a provider CLI or OIDC deployment later if the selected hosting
platform supports a stronger integration.

## Future Mobile activation

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

## Branch protection

Protect `main` with:

- pull requests required;
- the `Quality Gate` status check required;
- direct pushes disabled;
- squash merge enabled;
- branch deletion after merge.

Web Production deployments use one concurrency group and complete in order;
an in-progress Production deployment is never cancelled by a newer tag.

## Follow-up hardening

- Pin third-party GitHub Actions to full commit SHAs.
- Expose the deployed revision from Server `/health` and Web `/version.json`,
  then make smoke tests verify the exact SHA.
- Add a WebSocket protocol smoke test.
- Add Server connection draining before enabling unattended deployments.
- Read each target's last successful Production SHA when detecting changes, so
  a later merge automatically retries changes left behind by a failed deploy.
- Add a target-specific rollback workflow after the hosting provider is chosen.
