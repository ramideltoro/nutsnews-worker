# Worker GitHub Actions Pipeline

This repo now has one guarded Worker pipeline for pull requests and post-merge Cloudflare deploys.

## What runs on every pull request

The `Worker Pipeline` workflow runs on pull requests into `main` or `master` and must pass before merge:

1. Install Worker and Controller dependencies with `npm ci`.
2. Run the legacy immutable-test guard.
3. Run the Worker pipeline immutable guard.
4. Verify the pipeline workflow still has PR tests, protected deploy gating, Cloudflare secrets, local-AI deploy settings, and shard deployment concurrency.
5. Generate and verify local-AI Wrangler configs.
6. Type-check the Worker.
7. Type-check the Controller.
8. Run the local-AI deployment lock regression.
9. Run the fully mocked offline Worker E2E regression.

## What deploys after merge

After a PR merges into `main` or `master`, the same workflow runs the full CI job again. The `Deploy Workers to Cloudflare` job starts only after CI passes and only on a push to `main` or `master`.

The deploy job does this:

1. Validates required GitHub secrets are present.
2. Generates production Wrangler shard configs with local AI first and OpenAI fallback enabled.
3. Deploys all generated Worker shards to Cloudflare, five at a time.
4. Deploys the controller Worker to Cloudflare.

## Required GitHub secrets

Add these in GitHub → repo → Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NUTSNEWS_SECRETS_STORE_ID`
- `NUTSNEWS_KV_NAMESPACE_ID`
- `LOCAL_AI_URL`

Optional secrets:

- `NUTSNEWS_KV_PREVIEW_NAMESPACE_ID`
- `LOCAL_AI_API_KEY_SECRET_NAME`

Optional repository variables:

- `ENABLE_UPSTASH_REDIS_SECRET_BINDING`
- `UPSTASH_REDIS_REST_URL_SECRET_NAME`
- `UPSTASH_REDIS_REST_TOKEN_SECRET_NAME`
- `ENABLED_SUMMARY_LANGUAGES`
- `SUMMARY_TRANSLATION_LIMIT`
- `HOLD_ARTICLES_FOR_TRANSLATIONS`

## Immutable tests policy

Rami's rule: tests and deployment guardrails are non-modifiable unless explicitly approved.

The new guard uses `.github/worker-pipeline-immutable.manifest` and blocks edits to these files after the first PR lands:

- `.github/workflows/worker-pipeline.yml`
- `scripts/check_worker_pipeline_immutable.mjs`
- `scripts/verify_worker_pipeline_config.mjs`
- `scripts/deploy_worker_shards.mjs`
- `.github/worker-pipeline-immutable.manifest`

Only set `NUTSNEWS_APPROVE_PIPELINE_TEST_CHANGES=true` after Rami explicitly approves a test or pipeline guardrail change.

## Branch protection to turn this into an enforced gate

In GitHub branch protection, make `Worker Pipeline / Worker pipeline tests` a required status check for `main` or `master`.

That is the part that makes GitHub block merges when someone removes or bypasses the workflow. Without branch protection, the workflow still runs, but GitHub will not force maintainers to wait for it.

## Manual deploy

You can still run the deploy pipeline manually from GitHub Actions with `workflow_dispatch`. Manual runs execute the CI job first. The deploy job is intentionally limited to push events on `main` or `master`, so use a merge to deploy production.
