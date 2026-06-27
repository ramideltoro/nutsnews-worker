# Google Lighthouse CI Onboarding

Google Lighthouse CI is the NutsNews automated quality check for public web pages.

It runs from GitHub Actions and helps catch regressions in:

* Performance
* Accessibility
* SEO
* Best practices
* Core Web Vitals-style metrics such as LCP, CLS, and TBT

The first NutsNews setup should run Lighthouse against the built Next.js website inside GitHub Actions, not against production refresh endpoints.

---

## Important NutsNews Repository Layout

NutsNews is a multi-folder repository.

The repository root is:

```bash
/Users/ramideltoro/WebstormProjects/nutsnews3
```

The Next.js website is inside:

```bash
/Users/ramideltoro/WebstormProjects/nutsnews3/web
```

That means these commands must run from `web/`:

```bash
npm install --save-dev @lhci/cli
npm run build
npx lhci autorun
```

Do not install Lighthouse CI from the repository root. The root package does not contain the web app `build` or `start` scripts.

---

## If Lighthouse CI Was Accidentally Installed at the Repository Root

If `npm install --save-dev @lhci/cli` was run from the root folder by mistake, clean it up first.

Run from the repository root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

rm -rf node_modules .lighthouseci
rm -f package.json lighthouserc.js
git restore -- package-lock.json 2>/dev/null || rm -f package-lock.json
```

This cleanup preserves the tracked root `package-lock.json` if Git knows about it, while removing the accidental root install files. The actual Next.js package files live in:

```text
web/package.json
web/package-lock.json
```

Before removing files, confirm the real web package still exists:

```bash
ls -la web/package.json web/package-lock.json
```

---

## Step 1 — Install Lighthouse CI in the Web App

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm install --save-dev @lhci/cli
```

Expected changed files:

```text
web/package.json
web/package-lock.json
```

NPM may print deprecation warnings from transitive packages. Those warnings are common for Lighthouse CI dependency trees and do not necessarily mean the install failed.

---

## Step 2 — Add `web/lighthouserc.js`

Create this file inside `web/`, not in the repository root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

cat > lighthouserc.js <<'EOF'
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start -- -p 3000',
      startServerReadyPattern: 'Ready in|Local:|started server|listening',
      startServerReadyTimeout: 120000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/privacy',
        'http://localhost:3000/contact'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.60 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.90 }],

        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.15 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
EOF
```

Recommended first audited pages:

| URL | Why it is audited |
| --- | --- |
| `/` | Main reader experience and article feed |
| `/privacy` | Required public policy page for app review and user trust |
| `/contact` | Public support/contact page |

Do not audit Worker refresh URLs, controller trigger URLs, admin pages, OAuth routes, or any URL that performs ingestion, refresh, translation, AI review, database writes, or authenticated work.

---

## Step 3 — Add GitHub Actions Workflow

The workflow file belongs at the repository root:

```text
.github/workflows/lighthouse-ci.yml
```

But the commands inside the workflow must run from `web/`.

Run from the repository root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

mkdir -p .github/workflows

cat > .github/workflows/lighthouse-ci.yml <<'EOF'
name: Lighthouse CI

on:
  push:
    branches:
      - main
  pull_request:
  workflow_dispatch:

jobs:
  lighthouse:
    name: Lighthouse CI
    runs-on: ubuntu-latest

    permissions:
      contents: read

    defaults:
      run:
        working-directory: web

    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      NEXT_PUBLIC_APP_ENV: ci

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build NutsNews
        run: npm run build

      - name: Run Lighthouse CI
        run: npx lhci autorun
EOF
```

Important details:

* `defaults.run.working-directory: web` tells GitHub Actions to run npm commands in the Next.js app folder.
* `cache-dependency-path: web/package-lock.json` makes the npm cache match the web app lockfile.
* The workflow uses `npm ci`, so `web/package-lock.json` must be committed.
* The GitHub token warning is not the first thing to fix. Missing `build` or `start` scripts usually means the command was run from the wrong folder.

---

## Step 4 — Confirm Local Supabase Environment Variables

The homepage can read public article data from Supabase, so the local build/server should have these values in `web/.env.local`:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

grep -E '^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=' web/.env.local | sed 's/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/NEXT_PUBLIC_SUPABASE_ANON_KEY=<hidden>/'
```

Expected shape:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=<hidden>
```

Do not commit `.env.local`.

---

## Step 5 — Add GitHub Repository Secrets

GitHub Actions needs the same public Supabase values.

In GitHub, go to:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Add:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Use the values from `web/.env.local`.

---

## Step 6 — Test Locally

Run from `web/`:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm run build
npx lhci autorun
```

Expected result:

```text
Build passes
Lighthouse checks /
Lighthouse checks /privacy
Lighthouse checks /contact
Reports upload
Warnings or errors print in the terminal
```

If this appears:

```text
GitHub token not set
```

That is not the main failure for the starter setup. The starter setup uses temporary public report storage and can run without `LHCI_GITHUB_APP_TOKEN`.

If this appears:

```text
Missing script: "build"
Missing script: "start"
```

The command was probably run from the repository root instead of `web/`.

---

## Step 7 — Commit the Lighthouse CI Setup

Run from the repository root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

git status

git add web/package.json web/package-lock.json web/lighthouserc.js .github/workflows/lighthouse-ci.yml

git commit -m "Add Lighthouse CI checks"

git push
```

After pushing, check:

```text
GitHub → Repository → Actions → Lighthouse CI
```

Expected workflow steps:

```text
Checkout repository ✅
Use Node.js ✅
Install dependencies ✅
Build NutsNews ✅
Run Lighthouse CI ✅
```

---

## First Threshold Policy

The first Lighthouse CI setup intentionally starts with forgiving thresholds.

| Area | Threshold | Result |
| --- | --- | --- |
| Performance | `0.60` | Warning only |
| Accessibility | `0.90` | Fails CI below threshold |
| Best practices | `0.85` | Warning only |
| SEO | `0.90` | Fails CI below threshold |
| LCP | `4000ms` | Warning only |
| CLS | `0.15` | Warning only |
| TBT | `600ms` | Warning only |

Performance should start as a warning because Lighthouse performance can fluctuate between runs. After a few successful runs, raise thresholds based on NutsNews' actual baseline.

---

## Later Optional Improvement — GitHub App Token

For cleaner GitHub commit status links, install the Lighthouse CI GitHub App later and store the generated token as:

```text
LHCI_GITHUB_APP_TOKEN
```

Then update the workflow step:

```yaml
      - name: Run Lighthouse CI
        run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

This is optional. The starter setup works without it.

---

## Safety Rules

Never point Lighthouse CI at URLs that trigger production work.

Do not audit URLs like:

```text
https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1
https://nutsnews-controller.nutsnews.workers.dev/?shard=0
```

Those URLs can cause article fetching, AI review, translation, database writes, or operational side effects.

Only audit stable public reader pages unless a route is confirmed to be safe, read-only, and unauthenticated.
