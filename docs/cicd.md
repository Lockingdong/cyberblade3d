# CI/CD

CyberBlade 3D uses short-lived branches and `main` as the only long-lived
branch. Pull requests run CI. Production deployment is release-tag driven and
does not run when commits are pushed or merged to `main`.

## Workflows

- `ci.yml` runs workspace typechecks/tests, Web and Mobile exports, and Go
  checks for pull requests.
- `cd-production.yml` validates stable Web and API release tags, verifies the
  exact tagged revision, and deploys only the tagged target to Production.

The target classifier in `scripts/ci/detect-deploy-targets.mjs` remains covered
by CI but is not used by the tag-driven Production workflow.

## Production release tags

| Tag             | Status   | Target                     |
| --------------- | -------- | -------------------------- |
| `web-v1.2.3`    | Active   | Web Production             |
| `api-v1.2.3`    | Active   | API Production             |
| `mobile-v1.2.3` | Reserved | iOS and Android Production |

Only stable three-part semantic versions are accepted. Create
the tag on the exact commit to release, then push that tag:

```sh
git tag -a web-v1.2.3 -m "Release web-v1.2.3"
git push origin web-v1.2.3

git tag -a api-v1.2.3 -m "Release api-v1.2.3"
git push origin api-v1.2.3
```

Each tag deploys only its matching target. An API release builds a static
Linux AMD64 binary, copies it to the Oracle instance over SSH, atomically
replaces the installed binary, restarts systemd, and rolls back if the local
health check fails.

## GitHub Production environment

Create one GitHub Environment named `production`. Configure these repository or
environment variables:

| Variable        | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| `PUBLIC_WS_URL` | Optional public `wss://` endpoint embedded in the Web build     |
| `WEB_URL`       | Optional public Web URL used by the post-deploy smoke test      |
| `API_URL`       | Required public API base URL used by the post-deploy smoke test |

Configure these secrets:

| Secret                  | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the Worker                 |
| `CLOUDFLARE_API_TOKEN`  | Token with permission to deploy Workers scripts         |
| `API_SSH_HOST`          | Oracle instance host or IP address                      |
| `API_SSH_USER`          | Oracle instance SSH user                                |
| `API_SSH_PRIVATE_KEY`   | Dedicated private deploy key authorized by the instance |
| `API_SSH_KNOWN_HOSTS`   | Pinned SSH host-key entry for the instance              |

If `PUBLIC_WS_URL` is absent, the Web client falls back to `/ws` on its own
host. The first static-only Workers release can therefore omit the variable,
but online play will remain unavailable until `/ws` is proxied to the API
service or the variable points to a deployed API WebSocket endpoint.

## Cloudflare Workers hosting

`apps/web/wrangler.jsonc` configures `apps/web/dist` as a Cloudflare Workers
Static Assets single-page application. A Web release builds the Vite app and
runs the project-pinned Wrangler version directly; Docker and a provider deploy
hook are not involved. Add `WEB_URL` after the first deployment if the workflow
should verify the public URL on every later release.

## Future Mobile activation

`apps/mobile/eas.json` defines a single `production` profile and channel. Before
setting `ENABLE_MOBILE_DEPLOY=true`:

1. Link the app to the intended EAS project with `eas init`.
2. Configure EAS Update with `eas update:configure`. This adds the real project
   ID, updates URL, runtime version policy, and required native dependency.
3. Create the EAS `production` environment variable `EXPO_PUBLIC_WS_URL`.
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

Web and API Production deployments use separate concurrency groups and
complete in order; an in-progress deployment is never cancelled by a newer
tag for the same target.

## Follow-up hardening

- Pin third-party GitHub Actions to full commit SHAs.
- Expose the deployed revision from Server `/health` and Web `/version.json`,
  then make smoke tests verify the exact SHA.
- Add a WebSocket protocol smoke test.
- Add Server connection draining to minimize interrupted WebSocket matches.
- Read each target's last successful Production SHA when detecting changes, so
  a later merge automatically retries changes left behind by a failed deploy.
