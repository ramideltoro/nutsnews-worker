[![Edge Feed Snapshot Health](https://github.com/ramideltoro/nutsnews-worker/actions/workflows/edge-feed-snapshot-health.yml/badge.svg)](https://github.com/ramideltoro/nutsnews-worker/actions/workflows/edge-feed-snapshot-health.yml)

[![Worker Smoke Test](https://github.com/ramideltoro/nutsnews-worker/actions/workflows/worker-smoke-test.yml/badge.svg)](https://github.com/ramideltoro/nutsnews-worker/actions/workflows/worker-smoke-test.yml)

[![Worker Offline E2E Regression](https://github.com/ramideltoro/nutsnews-worker/actions/workflows/worker-offline-e2e.yml/badge.svg)](https://github.com/ramideltoro/nutsnews-worker/actions/workflows/worker-offline-e2e.yml)

# NutsNews Worker

Cloudflare Worker ingestion, AI review, translation, and publishing pipeline for NutsNews.

## What This Repo Contains

- worker: Cloudflare Worker RSS ingestion engine
- controller: Cloudflare Worker shard controller
- local-ai-service: home-server local AI endpoint
- supabase: database config, migrations, and restore validation
- scripts: operational and regression-test scripts
- docs: Worker and operations documentation

## Main Worker Commands

```bash
cd worker
npm install
npm run test:e2e:offline
npm run generate:wrangler
npm run check:local-ai-config
npm run dev
npm run deploy:shard0
npm run deploy:all
npm run deploy:local-ai
```

## Local AI First Deploy Safety

Production Worker shard generation is now locked to local AI by default. Create `worker/.env.deploy.local` from `worker/.env.deploy.example`, then use:

```bash
cd worker
npm run check:local-ai-config
npm run deploy:all
```

This blocks accidental OpenAI-only shard configs. It also requires `AI_PROVIDER_FALLBACK_TO_OPENAI=true`, so article reviews and summary translations do not silently fall back to OpenAI when the local server is missing or failing.

See [Local AI Deployment Lock](docs/LOCAL_AI_DEPLOYMENT_LOCK.md).


## GitHub Actions Worker Pipeline

Pull requests now run the guarded `Worker Pipeline` workflow before merge. After the PR merges into `main` or `master`, the same workflow reruns CI and deploys the Worker shards plus the controller to Cloudflare.

Required production deploy secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NUTSNEWS_SECRETS_STORE_ID`, `NUTSNEWS_KV_NAMESPACE_ID`, and `LOCAL_AI_URL`.

See [Worker GitHub Actions Pipeline](docs/WORKER_GITHUB_ACTIONS_PIPELINE.md).

## Verification

Run the fully mocked offline Worker test:

```bash
cd worker
npm run test:e2e:offline
```

## Related Repositories

- nutsnews: public website and admin app
- nutsnews-worker: Worker ingestion, controller, local AI, and backend automation
- nutsnews-ios: native iOS app

## License

MIT. See LICENSE.


## Translation quality

The Worker validates translated summary responses before saving them to `public.article_summaries`. Critical issues are retried/rejected, while missing public rows fall back to English on the web app. See `docs/MULTILINGUAL_QUALITY_AND_FALLBACKS.md`.
