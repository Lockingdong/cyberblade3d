---
name: cyberblade-release
description: Safely release CyberBlade 3D Web or API production deployments through the repository's version-tagged GitHub Actions workflow.
disable-model-invocation: true
---

# CyberBlade production release

Use this skill only when the user explicitly asks to release CyberBlade 3D
production Web or API. The production path is release-tag driven; do not call
Wrangler or SSH deployment commands directly from the local machine.

## Invocation

Require one explicit target:

- `$cyberblade-release web`
- `$cyberblade-release api`

If the target is missing or is not `web` or `api`, ask the user to choose one.

## Safety gates

1. Resolve the repository root with `git rev-parse --show-toplevel` and stop if
   it is not the CyberBlade 3D repository.
2. Require a clean worktree. Run `git status --porcelain`; if it prints
   anything, stop and ask the user to commit or otherwise resolve the changes.
   Never auto-commit, stash, reset, or discard work.
3. Require the `main` branch. Stop on any other branch.
4. Fetch tags before calculating the release number. Never overwrite an
   existing tag.
5. Before any push, show the target, proposed tag, commit SHA, checks, and
   deployment path, then ask for explicit confirmation.
6. On confirmation, push `main` first if the local `main` is ahead of
   `origin/main`; stop on divergence or if the remote is ahead.
7. Create an annotated tag and push only that tag. Never force-push a branch or
   tag.

## Version proposal

For target `web` or `api`, list tags matching `<target>-v*`, sort by semantic
version, and propose the next patch version. If no tag exists, propose
`<target>-v0.1.0`. The proposal is not authorization: wait for confirmation
before creating or pushing the tag.

## Fast pre-release checks

Run only the selected target's checks, as requested by the user:

- `web`: `pnpm -C apps/web typecheck`, `pnpm -C apps/web test`, then
  `pnpm -C apps/web build`.
- `api`: `go -C services/api test ./...`, then build to a temporary explicit
  output path (for example, a directory created with `mktemp -d`) so the
  repository does not receive an untracked binary.

If a check fails, stop without creating or pushing a tag.

## Release and verification

After confirmation and passing checks:

1. Push `main` when required.
2. Create `git tag -a <target>-vX.Y.Z -m "Release <target>-vX.Y.Z"`.
3. Push `git push origin <target>-vX.Y.Z`.
4. Report the GitHub Actions run URL and monitor until it is `success` or
   `failure`.

For a successful Web release, smoke-test `https://cyberblade3d.com/` (or the
configured `WEB_URL`) and verify the page loads, the canonical URL is present,
and `/og-cyberblade3d.png` returns a valid image. For a successful API release,
smoke-test the configured public API `/health` endpoint. If a required public
URL is not configured, report that deployment succeeded but verification could
not run.

## Final report

Include the target, exact tag, commit SHA, checks run, GitHub Actions result,
smoke-test result, and any non-blocking warnings. State clearly when deployment
is still in progress or when a required secret/environment variable blocked
the workflow.
