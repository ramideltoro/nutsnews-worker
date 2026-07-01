# NutsNews Web Offline E2E Fix

This patch updates the mocked public web flow test so it no longer assumes the mock article title is globally unique on the homepage.

## Why this was needed

The current homepage intentionally renders category sections. The same mock article can appear in the lead story and in multiple category sections, so Playwright strict mode fails when the test uses `page.getByText(title)` and that locator resolves to multiple visible elements.

## What changed

- Updated `scripts/web_offline_e2e_regression.mjs` to use the first visible matching title when verifying homepage/search rendering.
- This keeps the test focused on the real requirement: at least one mock article is visible.

## Validate

```bash
npm --prefix web run test:e2e:offline
```

or, if your package script is named differently, run the GitHub workflow command for the Web Offline E2E Regression.
