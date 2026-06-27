# axe Accessibility CI with Playwright

axe Accessibility CI is the automated accessibility safety net for the NutsNews web app.

It complements Lighthouse CI by running deeper page-level accessibility checks with Playwright and `@axe-core/playwright` on every push, pull request, and manual workflow run.

Use this for checking:

* Missing image alternative text
* Form label problems
* Button/link naming problems
* Landmark and heading issues
* Color contrast issues detected by axe
* Serious and critical WCAG violations before public launch or App Store review

This does not replace a manual WAVE browser-extension pass. Use WAVE manually before important releases, and use axe CI to catch regressions automatically.

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

That means Playwright and axe dependencies must be installed inside `web/`, not at the repository root.

---

## What Was Added

| File | Purpose |
| --- | --- |
| `web/playwright.config.ts` | Playwright test configuration for the built NutsNews web app |
| `web/tests/accessibility.spec.ts` | axe accessibility tests for public NutsNews pages |
| `.github/workflows/accessibility-ci.yml` | GitHub Actions workflow that runs the accessibility tests |
| `web/package.json` | Adds the `test:accessibility` script and dev dependencies |
| `web/package-lock.json` | Locks Playwright and axe dependency versions |
| `web/.gitignore` | Ignores generated local Playwright and Lighthouse reports |

---

## Audited Pages

The first automated axe pass checks these public reader/support pages:

```text
/
/about
/privacy
/contact
```

These are safe because they are public pages and do not trigger ingestion, AI review, translation, refresh work, database writes, OAuth flows, or admin-only workflows.

Do not add Worker refresh URLs, controller trigger URLs, admin pages, OAuth callback routes, or API routes that perform writes.

---

## Blocking Threshold

The first setup fails CI only for axe violations with these impacts:

```text
critical
serious
```

Moderate and minor findings are still useful during manual review, but starting with serious and critical issues keeps the CI signal practical while NutsNews is still evolving.

Later, the threshold can be tightened to fail on `moderate` issues too.

---

## Step 1 — Install Dependencies in the Web App

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm install --save-dev @playwright/test @axe-core/playwright
```

Expected changed files:

```text
web/package.json
web/package-lock.json
```

---

## Step 2 — Add the Package Script

`web/package.json` should include:

```json
{
  "scripts": {
    "test:accessibility": "playwright test --config=playwright.config.ts"
  }
}
```

Keep the existing `dev`, `build`, `start`, and `lint` scripts.

---

## Step 3 — Add `web/playwright.config.ts`

The config starts the already-built Next.js app on a local CI port and runs Chromium-only accessibility tests.

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

---

## Step 4 — Add `web/tests/accessibility.spec.ts`

The test opens each public NutsNews page and scans it with axe.

The test currently uses these axe tags:

```text
wcag2a
wcag2aa
wcag21a
wcag21aa
```

The test fails when serious or critical violations are found.

---

## Step 5 — Add GitHub Actions Workflow

The workflow file belongs at the repository root:

```text
.github/workflows/accessibility-ci.yml
```

The workflow commands run from `web/` using:

```yaml
defaults:
  run:
    working-directory: web
```

The workflow:

1. Checks out the repository.
2. Sets up Node.js 22.
3. Installs web dependencies with `npm ci`.
4. Installs Playwright Chromium and Linux browser dependencies.
5. Builds NutsNews.
6. Runs the axe accessibility tests.
7. Uploads the Playwright HTML report and failure traces as a GitHub Actions artifact.

---

## Step 6 — Required GitHub Secrets

The CI workflow uses the same public Supabase values as Lighthouse CI:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Add or confirm them here:

```text
GitHub repo → Settings → Secrets and variables → Actions → Repository secrets
```

Use the values from:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

grep -E '^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=' web/.env.local | sed 's/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/NEXT_PUBLIC_SUPABASE_ANON_KEY=<hidden>/'
```

---

## Step 7 — Run Locally

From the web app folder:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web

npm run build
npx playwright install chromium
npm run test:accessibility
```

Expected result:

```text
4 passed
```

If there is a failure, open the local report:

```bash
npx playwright show-report
```

---

## Step 8 — Commit and Push

From the repository root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

git status

git add \
  web/package.json \
  web/package-lock.json \
  web/playwright.config.ts \
  web/tests/accessibility.spec.ts \
  web/.gitignore \
  .github/workflows/accessibility-ci.yml \
  README.md \
  docs/README.md \
  docs/OBSERVABILITY.md \
  docs/AXE_PLAYWRIGHT_ACCESSIBILITY_CI.md \
  docs/updates/README_AXE_PLAYWRIGHT_ACCESSIBILITY_CI_UPDATE.md

git commit -m "Add axe Playwright accessibility CI"

git push
```

---

## Step 9 — Read the GitHub Actions Result

After pushing, open:

```text
GitHub → Actions → Accessibility CI
```

A good run shows:

```text
Install dependencies ✅
Install Playwright Chromium ✅
Build NutsNews ✅
Run axe accessibility checks ✅
Upload Playwright accessibility report ✅
```

If it fails, open the failed step. The test output lists:

* axe rule ID
* impact level
* help text
* affected DOM selectors
* axe help URL

The uploaded `accessibility-playwright-report` artifact can be downloaded from the workflow run.

---

## Manual WAVE Still Matters

Automated axe checks are useful, but they do not catch every accessibility issue. Before App Store review and public launch, still run the WAVE browser extension manually on:

```text
https://www.nutsnews.com/
https://www.nutsnews.com/about
https://www.nutsnews.com/privacy
https://www.nutsnews.com/contact
```

Use WAVE for visual review of:

* Contrast warnings
* Heading structure
* Visible labels
* Button readability
* Link text quality
* Layout and reading order

For NutsNews, the best setup is:

```text
Lighthouse CI = broad web quality score
axe Playwright CI = automated accessibility regression checks
WAVE extension = final manual accessibility polish
```
