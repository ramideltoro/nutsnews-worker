# NutsNews Worker Fully Offline E2E Regression Test

This test runs the real Cloudflare Worker locally and mocks every external service it normally depends on.

It does **not** call production Supabase, OpenAI, Upstash Redis, Cloudflare KV, Better Stack, Vercel, or the live NutsNews website.

## What it tests

The test starts local mock services for:

- RSS feed and article pages
- Local AI review endpoint
- Local AI translation endpoint
- Supabase/PostgREST tables and RPCs
- Web API and homepage rendering

Then it runs the real Worker through these scenarios:

1. RSS article with a feed image is accepted.
2. RSS article without a feed image is hydrated from article-page `og:image` and accepted.
3. Article with no RSS image and no article-page image is rejected.
4. Article with blocked/political/market terms is rejected by local prefilter.
5. Article that reaches AI is rejected by the mocked AI provider.
6. Accepted articles are stored in the mocked `articles` table.
7. Review rows are stored in the mocked `article_ai_reviews` table.
8. French and Japanese summaries are stored in mocked `article_summaries`.
9. Accepted articles are published and included in mocked `public_feed_snapshot`.
10. Worker telemetry is stored in mocked `worker_runs` and `ai_usage_runs`.
11. Mock `/api/articles` returns English, French, and Japanese versions.
12. Mock homepage HTML renders an accepted article.
13. Translation recovery works if a published article is missing French/Japanese rows.

## Run locally

From the repo root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npm install
cd ..
node scripts/worker_offline_e2e_regression.mjs
```

Or use the package script:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npm run test:e2e:offline
```

A successful run ends with:

```text
✅ NutsNews fully offline Worker E2E regression passed.
```

## CI usage

This test is safe to run in GitHub Actions because it uses mocks only. It does not require repository secrets.

The included workflow is:

```text
.github/workflows/worker-offline-e2e.yml
```

## Ports

Default local ports:

- Worker: `8787`
- Mock AI: `8890`
- Mock RSS/article pages: `8891`
- Mock Supabase/PostgREST: `8892`
- Mock web/homepage: `8893`

Override ports only if needed:

```bash
NUTSNEWS_OFFLINE_E2E_WORKER_PORT=8877 \
NUTSNEWS_OFFLINE_E2E_AI_PORT=8894 \
NUTSNEWS_OFFLINE_E2E_RSS_PORT=8895 \
NUTSNEWS_OFFLINE_E2E_SUPABASE_PORT=8896 \
NUTSNEWS_OFFLINE_E2E_WEB_PORT=8897 \
node scripts/worker_offline_e2e_regression.mjs
```

The script writes a temporary generated Wrangler config at:

```text
worker/wrangler.offline-e2e.generated.jsonc
```

That generated file is ignored by Git.


## Fast CI exit behavior

After the test prints `✅ NutsNews fully offline Worker E2E regression passed.`, the script stops Wrangler and the mock services, prints `Cleanup complete; exiting Worker E2E regression with code 0.`, then explicitly exits. This prevents lingering Wrangler/server handles from making GitHub Actions appear stuck after success.

The script also has a watchdog timeout. Override it only if needed:

```bash
NUTSNEWS_OFFLINE_E2E_WATCHDOG_TIMEOUT_MS=180000 npm run test:e2e:offline
```
