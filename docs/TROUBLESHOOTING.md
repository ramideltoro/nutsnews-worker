# Troubleshooting Guide

This guide helps diagnose common production problems in NutsNews from one place.

Created for GitHub issue #30.

Issue #30 asks for a guide covering:

* Vercel build failures
* Cloudflare cache issues
* Worker 1101 errors
* Supabase save failures
* Missing thumbnails
* Better Stack logs missing
* Sentry errors

Acceptance criteria:

```text
Common issues can be diagnosed from one document.
```

---

## Deployment Problems

Use the deployment checklist when a release has failed or when you need to verify a new production deploy:

```text
docs/DEPLOYMENT_CHECKLIST.md
```

The checklist covers:

* Web deployment checks
* Worker shard deployment checks
* Controller deployment checks
* Supabase migration checks
* Cloudflare cache purge checks
* Post-deploy verification commands

Quick verification command:

```bash
./scripts/post_deploy_verify.sh
```

---

## Quick Triage

Start here when something looks wrong.

### 1. Check public site

```bash
curl -I "https://www.nutsnews.com/"
```

Expected:

```text
HTTP/2 200
```

### 2. Check article API

```bash
curl -s "https://www.nutsnews.com/api/articles?page=0"
```

Expected:

* JSON response
* `articles` array
* no server error

### 3. Check Cloudflare cache

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

Expected for public routes:

```text
cf-cache-status: HIT
```

### 4. Check a Worker shard

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Expected:

```text
NutsNews refresh complete
```

### 5. Check controller

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
```

Expected:

```text
NutsNews controller run complete
```

---

## Vercel Build Failures

### Symptoms

* Vercel deployment fails
* `npm run build` fails
* missing environment variable error
* TypeScript error
* Sentry source map warning

### Check locally

```bash
cd web
npm run build
```

### Check environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SENTRY_DSN
NEXT_PUBLIC_APP_ENV
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ADMIN_EMAIL
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_INGESTING_HOST
```

### Common fixes

If TypeScript fails:

```bash
cd web
npx tsc --noEmit
```

If lint fails:

```bash
cd web
npm run lint
```

If a required environment variable is missing, add it in Vercel Project Settings and redeploy.

---

## Cloudflare Cache Issues

### Symptoms

```text
cf-cache-status: BYPASS
cf-cache-status: DYNAMIC
cache-control: private, no-cache, no-store
```

### Check

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

### Expected

Repeated public requests should eventually show:

```text
cf-cache-status: HIT
age: <number>
```

Good transitions:

```text
MISS → HIT
EXPIRED → HIT
BYPASS → EXPIRED → HIT
UPDATING → HIT
```

### Check headers

```bash
curl -sI "https://www.nutsnews.com/" | grep -iE "cache-control|cdn-cache-control|cf-cache-status|x-nutsnews-cache"
```

### Common fixes

* Confirm Cloudflare Cache Rules are enabled.
* Confirm public reader routes are eligible for cache.
* Confirm private/admin/auth routes bypass cache.
* Confirm `web/middleware.ts` is deployed.
* Confirm public routes return `cdn-cache-control`.
* Purge Cloudflare cache after major header changes.

---

## Worker 1101 Errors

### Symptoms

```text
Error 1101
Worker threw exception
```

### Check Worker logs

```bash
cd worker
npx wrangler tail nutsnews-worker-0
```

### Test a shard

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

### Check secrets

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_INGESTING_HOST
SENTRY_DSN
```

### Common fixes

Regenerate Wrangler configs:

```bash
cd worker
npm run generate:wrangler
```

Deploy one shard:

```bash
npx wrangler deploy --config generated-wrangler/wrangler.shard0.jsonc
```

If one shard works, deploy the rest.

---

## Supabase Save Failures

### Symptoms

```text
reviewSaveOk: false
articleSaveOk: false
aiUsageSaveOk: false
workerRunSaveOk: false
```

Common errors:

```text
401 invalid API key
409 duplicate key
400 bad request
relation does not exist
column does not exist
```

### Check tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'articles',
    'article_ai_reviews',
    'ai_usage_runs',
    'worker_runs',
    'rss_feeds',
    'feed_health'
  )
order by table_name;
```

### Check latest Worker runs

```sql
select
  run_started_at,
  shard_index,
  success,
  error_name,
  error_message,
  review_save_ok,
  article_save_ok,
  ai_usage_save_ok,
  duration_ms
from public.worker_runs
order by run_started_at desc
limit 25;
```

### Common fixes

* Run `supabase db push`.
* Confirm Worker uses service role key, not anon key.
* Confirm migrations are applied.
* Check duplicate URL constraints.
* Check Supabase project health.

---

## Missing Thumbnails

### Symptoms

* Articles are fetched but not published.
* Worker rejects many items.
* `noThumbnailRejectedCount` is high.

### Check Worker response

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=5"
```

Look for:

```text
noThumbnailRejectedCount
imageHydrationLookupCount
imageHydrationFoundCount
acceptedCount
```

### Check weak feeds

```sql
select *
from public.bad_feeds
limit 25;
```

### Common fixes

* Prefer direct publisher RSS feeds.
* Disable feeds with poor image coverage.
* Use `/admin/feed-health`.
* Use `/admin/feeds`.

Disable weak feeds:

```sql
update public.rss_feeds
set is_active = false
where url in (
  select feed_url
  from public.bad_feeds
  limit 25
);
```

---

## Better Stack Logs Missing

### Symptoms

* Worker runs but logs do not appear.
* Web app log test succeeds locally but not in Better Stack.
* Missing `nutsnews-web`, `nutsnews-worker`, or `nutsnews-controller` logs.

### Test web logs

```bash
curl "https://www.nutsnews.com/api/log-test"
```

Search Better Stack for:

```text
service:nutsnews-web
event:api.log_test.completed
```

### Test Worker logs

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Search Better Stack for:

```text
service:nutsnews-worker
shardIndex:0
```

### Common fixes

Check:

```text
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_INGESTING_HOST
```

Make sure secrets exist in both Vercel and Cloudflare Workers.

---

## Sentry Errors

### Symptoms

* Errors happen but do not show in Sentry.
* Source map warning during build.
* Hydration or frontend runtime errors.

### Check environment variables

```text
NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
NEXT_PUBLIC_APP_ENV
SENTRY_DSN
```

### Common fixes

* Confirm DSN belongs to the right Sentry project.
* Add `SENTRY_AUTH_TOKEN` in Vercel.
* Confirm Sentry project slug and org slug.
* Redeploy after changing environment variables.
* Check Cloudflare Worker secret `SENTRY_DSN` for Worker-side errors.

---

## Useful Admin Pages

```text
/admin
/admin/ai-usage
/admin/shards
/admin/feed-health
/admin/feeds
```

Use these dashboards before digging through raw logs.

---

## Production Health Checklist

### Public site

```bash
curl -I "https://www.nutsnews.com/"
curl -s "https://www.nutsnews.com/api/articles?page=0"
```

### Cache

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

### Worker

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

### Controller

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
```

### Supabase

```sql
select count(*) from public.articles;
select count(*) from public.article_ai_reviews;
select count(*) from public.worker_runs;
select count(*) from public.feed_health;
```

### Better Stack

Search:

```text
service:nutsnews-web
service:nutsnews-worker
service:nutsnews-controller
```

### Sentry

Check:

```text
Latest events
Release health
Frontend errors
Server errors
Worker errors
```

---

## Controller and Shard Manual Testing

For detailed controller and shard commands, use:

```text
docs/CONTROLLER_AND_SHARDS.md
```

Fast checks:

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
cd worker && npx wrangler tail --config generated-wrangler/wrangler.shard0.jsonc
```

Expected controller response fields:

```text
message
mode
shardCount
shardRunIntervalMinutes
maxAiReviewsPerShard
requestId
shardIndex
shardUrl
ok
status
response
```

Expected healthy values:

```text
message = NutsNews controller run complete
ok = true
status = 200
response.message = NutsNews refresh complete
```
