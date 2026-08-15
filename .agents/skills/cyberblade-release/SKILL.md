---
name: cyberblade-release
description: Automatically verify, version-tag, and release CyberBlade 3D Web, API, or both to production via GitHub Actions. Use whenever the user asks to deploy, release, or "上版" (e.g., "上版", "上版 web", "上版 api", "發布", "deploy").
---

# CyberBlade 3D Production Release Runbook

This skill automates the production deployment workflow for CyberBlade 3D Web and API services via GitHub Actions release tags.

## 1. Target Determination

Determine the target from the user's request:
- **`web`**: Release the Web application (`web-v*` tag)
- **`api`**: Release the API matchmaking service (`api-v*` tag)
- **`both` / `all`**: Release both Web and API simultaneously

> **Note**: If the user did not specify the target (e.g. only said "上版" or "部署"), prompt the user to clarify whether they want to deploy `web`, `api`, or `both`.

---

## 2. Pre-flight Safety Checks

Run the following checks sequentially before creating any tag:

1. **Verify Workspace Root**: Ensure working directory is the project root (`git rev-parse --show-toplevel`).
2. **Check Clean Working Tree**:
   ```sh
   git status --porcelain
   ```
   If uncommitted modifications or untracked files exist, stop immediately and ask the user to commit or resolve changes. Never auto-commit or discard work.
3. **Check Branch**:
   ```sh
   git branch --show-current
   ```
   Must be on `main`. Stop if on any feature or release branch.
4. **Fetch & Push Main Sync**:
   ```sh
   git fetch origin
   git push origin main
   ```
   Ensure local `main` is completely in sync with `origin/main`.
5. **Run Pre-Release Quality Checks**:
   ```sh
   task check
   ```
   All static checks (TypeScript typechecks, package tests, web/mobile vitest, Go API unit tests) must pass with exit code 0.

---

## 3. Version Calculation

Fetch all existing remote and local tags:
```sh
git fetch --tags
```

For each target being released:
1. **List existing tags**:
   - For `web`: `git tag -l "web-v*" | sort -V`
   - For `api`: `git tag -l "api-v*" | sort -V`
2. **Calculate Next Patch Version**:
   - Parse the highest semantic version `v<major>.<minor>.<patch>`.
   - Increment `<patch>` by 1 (e.g., `web-v0.1.14` -> `web-v0.1.15`, `api-v0.1.4` -> `api-v0.1.5`).
   - If no existing tag matches, default to `<target>-v0.1.0`.

---

## 4. Release Execution

Create and push the annotated tag(s) to GitHub:

### For Web:
```sh
git tag web-vX.Y.Z && git push origin web-vX.Y.Z
```

### For API:
```sh
git tag api-vX.Y.Z && git push origin api-vX.Y.Z
```

---

## 5. Deployment Verification & Reporting

After pushing tags:
1. Confirm that GitHub Actions workflow `cd-production.yml` was triggered by the pushed tag.
2. Provide a clean summary report to the user including:
   - Target(s) deployed
   - Release Tag(s) created & pushed
   - Commit SHA & message
   - Public URLs for verification:
     - **Web**: `https://cyberblade3d.com/`
     - **API Health Check**: configured `API_URL/health`
