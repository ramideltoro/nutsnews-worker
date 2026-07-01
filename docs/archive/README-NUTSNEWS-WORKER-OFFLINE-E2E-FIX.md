# NutsNews Worker Offline E2E Fix

This update fixes the Worker Offline E2E Regression after the summary translation language set expanded to:

- French (`fr`)
- Japanese (`ja`)
- Swiss German (`de-CH`)
- German (`de`)
- Greek (`el`)

## Why the GitHub Action failed

The Worker has a safe hard budget of 5 summary translation tasks per run. With 5 enabled languages and 2 accepted test articles, the first Worker run can fully translate only 1 accepted article. The other accepted article is intentionally left for translation recovery.

The old offline E2E test still expected every accepted article to have every language immediately after the first Worker run, so it exited with code 1 even though the Worker refresh itself completed successfully.

## What changed

Updated `scripts/worker_offline_e2e_regression.mjs` so the regression test now:

1. Verifies the first Worker run accepts/rejects the right mocked articles.
2. Verifies the first run fully translates at least one accepted article across all 5 configured languages.
3. Verifies the Worker reports the article skipped by the safe translation task budget.
4. Allows English fallback in the mock web API before translation recovery finishes.
5. Verifies translation recovery restores all missing language summaries.
6. Verifies all accepted articles have all configured language summaries after recovery.
7. Fixes the mock web API so it can localize `de-CH`, `de`, and `el`, not only `fr` and `ja`.

## Validation performed

I ran this successfully in the sandbox:

```bash
cd /mnt/data/nutsnews_fix/nutsnews-main
NUTSNEWS_OFFLINE_E2E_WATCHDOG_TIMEOUT_MS=120000 node scripts/worker_offline_e2e_regression.mjs
```

Result:

```text
✅ NutsNews fully offline Worker E2E regression passed.
✓ Cleanup complete; exiting Worker E2E regression with code 0.
```
