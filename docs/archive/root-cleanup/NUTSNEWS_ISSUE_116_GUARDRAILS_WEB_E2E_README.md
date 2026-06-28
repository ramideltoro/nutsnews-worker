# NutsNews Issue #116 Guardrails + Offline Web E2E Update

This update implements issue #116 with a new admin free-tier guardrails dashboard and adds a fully mocked public web end-to-end regression test.

## What changed

- Added `/admin/guardrails`.
- Added quota risk forecasting for database rows, AI cost/calls/tokens, Worker runs/failures, contact email sends, Redis/KV, egress, and PageSpeed/API usage where available.
- Added mitigation guidance directly on each dashboard metric.
- Added `quota_usage_events` table to record successful contact email sends.
- Updated `/api/contact` to use configurable mockable Turnstile/Resend URLs and record successful email sends.
- Added `scripts/web_offline_e2e_regression.mjs`.
- Added GitHub Action `.github/workflows/web-offline-e2e.yml`.

## Test locally

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web
npm install
npx playwright install --with-deps chromium
npx tsc --noEmit
npm run lint
npm run test:e2e:offline
```

The offline E2E test starts mock Supabase/PostgREST, mock Turnstile, mock Resend, then starts the real Next.js app against those mocks.

It verifies the homepage, footer controls, search, about/contact/privacy pages, contact email delivery, quota event recording, and French article translations.
