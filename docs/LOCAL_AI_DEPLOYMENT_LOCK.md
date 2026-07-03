# Local AI Deployment Lock

NutsNews Worker shards must use the home-server local AI provider first.

This lock exists because a Worker deploy without `AI_PROVIDER=local`, `LOCAL_AI_URL`, and the `LOCAL_AI_API_KEY` secret binding silently behaves like an OpenAI deployment. That creates unexpected OpenAI usage and hides local-server configuration mistakes.

## What changed

- `npm run generate:wrangler` now refuses to generate production shard configs unless local AI is complete.
- `npm run deploy:all` now runs the local-AI config verifier before deploying shards.
- `AI_PROVIDER_FALLBACK_TO_OPENAI=true` is required by default.
- Article reviews and summary translations no longer fall back to OpenAI when fallback is enabled.
- CI runs a local-AI deployment-lock regression.
- CI runs an immutable-test guard so locked regression tests cannot be edited later without explicit owner approval.

## Required deploy environment

Create `worker/.env.deploy.local` from `worker/.env.deploy.example`:

```bash
cd worker
cp .env.deploy.example .env.deploy.local
```

Set these values:

```bash
NUTSNEWS_SECRETS_STORE_ID=...
NUTSNEWS_KV_NAMESPACE_ID=...
AI_PROVIDER=local
LOCAL_AI_URL=https://your-local-ai-tunnel.example.com
LOCAL_AI_MODEL=qwen2.5:3b
AI_PROVIDER_FALLBACK_TO_OPENAI=true
AI_REVIEW_CONCURRENCY=1
ENABLE_LOCAL_AI_SECRET_BINDING=true
LOCAL_AI_API_KEY_SECRET_NAME=LOCAL_AI_API_KEY
```

The `LOCAL_AI_API_KEY` value itself must live in Cloudflare Secrets Store. The Worker config only binds the secret name.

## Safe deploy command

```bash
cd worker
npm run check:local-ai-config
npm run deploy:all
```

`deploy:local-ai` is kept as an alias for `deploy:all`.

## Emergency OpenAI-only deploy

OpenAI-only deploys are blocked by default. Use this only after explicit owner approval:

```bash
cd worker
NUTSNEWS_ALLOW_OPENAI_ONLY_DEPLOYMENT=true npm run deploy:openai-only
```

OpenAI fallback for a local-AI deployment is also blocked by default. Use this only after explicit owner approval:

```bash
cd worker
NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT=true AI_PROVIDER_FALLBACK_TO_OPENAI=true npm run deploy:all
```

## Verification after deploy

Call one shard manually:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1&imageLookups=1"
```

Look for:

- `aiProvider` is `local`
- `aiReviewProviderOrder` is `["local"]`
- `localAiConfigured` is `true`
- `openAiFallbackEnabled` is `false`
- `localAiCallCount` is greater than `0` when a story reaches AI review
- `openAiCallCount` is `0`
- `estimatedOpenAiCostUsd` is `0`

If `aiReviewedCount` is `0`, the shard did not need AI for that run. Try another shard or increase the manual limit.

## Regression tests

```bash
cd worker
npm run test:local-ai-lock
npm run test:e2e:offline
npm run test:immutable
```

The offline E2E test already asserts `aiProvider === "local"` and `openAiCallCount === 0`.
