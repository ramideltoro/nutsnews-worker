# NutsNews Worker Upstash Redis Update

This update adds optional Upstash Redis support to the Cloudflare Worker shard refresh flow.

## What Redis does in this update

- Adds a short-lived worker shard lock so the same shard does not run twice at the same time.
- Adds per-article AI review locks so two Worker runs do not spend AI calls reviewing the same URL at the same time.
- Adds a Redis-backed rate limit for manual Worker refresh requests.
- Adds short-lived Redis counters for daily manual runs, scheduled runs, AI reviewed count, accepted count, and rejected count.
- Adds `/redis-status` to confirm Redis is connected and view the temporary counters.

Redis is optional. If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are missing, the Worker keeps running without Redis.

## Required Upstash values

In the Upstash dashboard, open your Redis database, go to the REST connection section, and copy:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Use the standard token, not the read-only token, because the Worker needs write commands for locks and counters.

## Cloudflare Secrets Store secrets

Add these two secrets to the same Cloudflare Secrets Store already used by the Worker:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Wrangler generator flags

To bind the Upstash secrets into every generated shard config, run the generator with:

```bash
export ENABLE_UPSTASH_REDIS_SECRET_BINDING=true
export UPSTASH_REDIS_ENABLED=true
```

Optional tuning values:

```bash
export UPSTASH_REDIS_WORKER_LOCK_TTL_SECONDS=600
export UPSTASH_REDIS_AI_REVIEW_LOCK_TTL_SECONDS=1800
export UPSTASH_REDIS_MANUAL_RATE_LIMIT_MAX=20
export UPSTASH_REDIS_MANUAL_RATE_LIMIT_WINDOW_SECONDS=3600
export UPSTASH_REDIS_COUNTER_TTL_SECONDS=259200
```

## Verify after deploy

Open one shard's status endpoint:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/redis-status"
```

Expected when configured:

```json
{
  "redisEnabled": true,
  "ping": "PONG"
}
```

Run one small manual refresh:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

The response should include:

- `redisEnabled: true`
- `redisAiReviewLockAcquiredCount`
- `redisAiReviewLockSkippedCount`
- `redisStatsSaveOk`

## Rollback

Disable Redis without removing the code:

```bash
export ENABLE_UPSTASH_REDIS_SECRET_BINDING=true
export UPSTASH_REDIS_ENABLED=false
npm run generate:wrangler
npm run deploy:all
```

Or remove the Upstash secret binding export and regenerate/deploy.
