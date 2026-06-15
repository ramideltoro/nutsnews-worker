# Dependency Update Routine

This document defines the repeatable dependency update process for NutsNews.

Created for GitHub issue #33.

Issue #33 asks for a routine that keeps dependencies reasonably current without breaking the site.

Acceptance criteria:

```text
Dependency updates have a repeatable process.
```

---

## Goals

The dependency routine should:

* Review `npm audit` output.
* Review `npm outdated` output.
* Update safe patch/minor versions.
* Avoid forced upgrades without testing.
* Confirm the web build still passes.
* Confirm Worker TypeScript checks still pass when Worker dependencies change.
* Leave a local report that can be reviewed before committing.

---

## Project Areas Covered

NutsNews has three npm projects:

| Area | Path | Runtime |
| --- | --- | --- |
| Web app and admin portal | `web/` | Next.js on Vercel |
| RSS ingestion shards | `worker/` | Cloudflare Workers |
| Shard controller | `controller/` | Cloudflare Workers |

The dependency routine checks all three.

---

## Commands

Run from the repository root.

### Check only

Use this when you want to inspect dependency health without changing lockfiles:

```bash
./scripts/dependency_update_routine.sh check
```

This mode:

1. Installs from lockfiles with `npm ci`.
2. Captures `npm outdated --long`.
3. Captures `npm audit --audit-level=moderate`.
4. Runs validation checks.
5. Writes a report under `dependency-update-reports/`.

### Apply safe patch/minor updates

Use this when you want to update dependencies within the safe version ranges already allowed by `package.json`:

```bash
./scripts/dependency_update_routine.sh update
```

This mode does everything from check mode and also runs:

```bash
npm update --save
```

The script intentionally does **not** run:

```bash
npm audit fix --force
```

Forced fixes can jump major versions and break the site. Handle those in a separate issue after reading release notes and testing.

---

## What the Script Validates

### Web

The web project must pass:

```bash
npm run lint
npm run build
```

The build check is required because Issue #33 explicitly requires confirming the web build after dependency updates.

### Worker

The Worker project must pass:

```bash
npm run generate:wrangler
npx tsc --noEmit --project tsconfig.json
```

This catches TypeScript, Wrangler config, and Cloudflare Worker typing problems.

### Controller

The controller routine checks TypeScript only when a `tsconfig.json` exists.

The controller currently has no build script, so dependency updates are validated through install/audit/outdated reporting and deployment-time Wrangler checks.

---

## Report Location

Every run writes a timestamped local report:

```text
dependency-update-reports/<yyyymmdd-hhmmss>/
```

The report includes:

* `summary.md`
* Per-project routine logs
* `package.before.json`
* `package.after.json`
* `package-lock.before.json`
* `package-lock.after.json`

These reports are ignored by Git.

---

## Recommended Cadence

Run the check routine:

* Once per month.
* Before closing dependency/security maintenance issues.
* Before applying Dependabot PRs.
* After adding major new libraries.
* After a security advisory appears in GitHub or `npm audit`.

Run update mode only when you have time to review and test.

---

## Dependabot

This repo includes:

```text
.github/dependabot.yml
```

Dependabot is configured to check npm dependencies weekly for:

* `web/`
* `worker/`
* `controller/`

Dependabot groups patch/minor updates separately by project. Treat those PRs as suggestions, not automatic production releases.

Before merging a dependency PR, run:

```bash
./scripts/dependency_update_routine.sh check
```

If the PR changes web dependencies, confirm:

```bash
cd web
npm run build
```

---

## Safe Update Rules

Safe by default:

* Patch updates.
* Minor updates inside existing semver ranges.
* Type package updates that pass build/typecheck.
* Lockfile-only refreshes that pass validation.

Not safe by default:

* Major version upgrades.
* `npm audit fix --force`.
* Framework upgrades without reading release notes.
* Next.js, React, Wrangler, Supabase, Sentry, or NextAuth upgrades without build/deploy testing.
* Updates that require environment variable changes.

---

## Manual Review Checklist

After running update mode:

```bash
git status --short
git diff -- web/package.json web/package-lock.json worker/package.json worker/package-lock.json controller/package.json controller/package-lock.json
```

Confirm:

```text
[ ] npm audit output was reviewed.
[ ] npm outdated output was reviewed.
[ ] No forced audit fix was used.
[ ] Web lint passed.
[ ] Web build passed.
[ ] Worker Wrangler generation passed.
[ ] Worker TypeScript passed.
[ ] Any major upgrades were excluded or moved to a separate issue.
[ ] Runtime smoke checks are planned after deploy.
```

---

## Commit Pattern

Use a clear commit message:

```bash
git add web/package.json web/package-lock.json worker/package.json worker/package-lock.json controller/package.json controller/package-lock.json
git commit -m "Update safe npm dependencies"
```

For a routine-only documentation/script update:

```bash
git add .github/dependabot.yml .gitignore README.md docs/README.md docs/OPERATIONS.md docs/ARCHITECTURE.md docs/DEPLOYMENT_CHECKLIST.md docs/DEPENDENCY_UPDATES.md scripts/dependency_update_routine.sh
git commit -m "Add dependency update routine"
```

---

## Rollback

If an update breaks local validation:

```bash
git restore web/package.json web/package-lock.json worker/package.json worker/package-lock.json controller/package.json controller/package-lock.json
```

Then rerun check mode:

```bash
./scripts/dependency_update_routine.sh check
```

If the problem happens after deployment, revert the dependency update commit and redeploy.

---

## Production Smoke Checks After Deploy

After dependency updates are deployed, run:

```bash
./scripts/post_deploy_verify.sh
```

Then check:

```bash
curl -I "https://www.nutsnews.com/"
curl -s "https://www.nutsnews.com/api/articles?page=0" | head -c 500
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Also review:

* Sentry errors
* Better Stack logs
* Better Stack uptime
* `/admin/shards`
* `/admin/feed-health`
* `/admin/feeds`
