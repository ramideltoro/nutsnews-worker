# Deployment Checklist

This checklist explains how to safely deploy NutsNews across the web app, Worker shards, controller Worker, Cloudflare cache, and post-deploy verification.

Created for GitHub issue #29.

Issue #29 asks for one clear deployment checklist covering:

* Web deployment checklist
* Worker shard deployment checklist
* Controller deployment checklist
* Cloudflare cache purge checklist
* Post-deploy verification commands

Acceptance criteria:

```text
README or docs include one clear deployment checklist.
```

---

## Deployment Principles

Use this deployment flow for normal production releases:

```text
1. Pull latest main
2. Check local status
3. Run dependency routine when dependency/package files changed
4. Build the web app
5. Generate Worker shard configs
6. Deploy web changes through Vercel
7. Deploy Worker shards when Worker code/config changed
8. Deploy controller when controller code/config changed
9. Purge Cloudflare cache when public web/cache behavior changed
10. Run post-deploy verification
11. Check logs, Sentry, and admin dashboards
```

Keep deployments small when possible. A documentation-only change does not need Worker or controller redeploys.

---

## 1. Pre-Deployment Checklist

Run from repo root:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

git status
git checkout main
git pull origin main
```

Confirm there are no accidental local files:

```bash
git status --short
```

Check changed files for the release:

```bash
git diff --stat HEAD~1..HEAD
```

If the release includes secrets, `.env` files, `.dev.vars`, build output, or `node_modules`, stop and remove them before pushing.

Files that should not be committed:

```text
.env
.env.local
.dev.vars
node_modules/
.next/
dist/
build/
.wrangler/
.turbo/
coverage/
.DS_Store
```


---

## 1A. Dependency Update Checklist

Use this section when the release includes `package.json`, `package-lock.json`, dependency, or security maintenance changes.

The full dependency runbook lives in:

```text
docs/DEPENDENCY_UPDATES.md
```

Check dependency health without changing lockfiles:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2
./scripts/dependency_update_routine.sh check
```

Apply safe patch/minor updates only:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2
./scripts/dependency_update_routine.sh update
```

Before committing dependency changes, confirm:

```text
[ ] npm audit output was reviewed
[ ] npm outdated output was reviewed
[ ] no npm audit fix --force was used
[ ] web lint passed
[ ] web build passed
[ ] Worker Wrangler generation passed when Worker dependencies changed
[ ] Worker TypeScript check passed when Worker dependencies changed
[ ] major upgrades were moved to their own issue
```

Review package diffs:

```bash
git diff -- web/package.json web/package-lock.json worker/package.json worker/package-lock.json controller/package.json controller/package-lock.json
```

---

## 2. Web Deployment Checklist

The web app lives in:

```text
web/
```

Use this checklist when changing:

* Homepage
* Article pages
* API routes
* Admin portal
* Article review dashboard
* Sentry web config
* Better Stack web logging
* Cloudflare cache headers
* Next.js config
* Public docs shown from the repo

### Local web build

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/web
npm install
npm run build
```

If TypeScript or linting fails, fix that before deploying.

Optional lint check:

```bash
npm run lint
```

### Required Vercel environment variables

Confirm these exist in Vercel for production when web behavior depends on them:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_ENV
NEXT_PUBLIC_GA_ID
NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_INGESTING_HOST
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ADMIN_EMAIL
```

### Deploy web

Normal production web deploy is triggered by pushing to `main`:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

git status
git add <changed-files>
git commit -m "<release message>"
git push
```

Then verify the Vercel deployment finishes successfully.

### Web post-deploy checks

```bash
curl -I "https://www.nutsnews.com/"
curl -s "https://www.nutsnews.com/api/articles?page=0" | head -c 500
```

Expected:

```text
HTTP/2 200
```

Admin article dashboard smoke check after signing in:

```text
/admin/articles
```

Expected:

```text
Article Review Dashboard
Accepted and Rejected Story Reviews
```

For `/api/articles`, expected response shape includes:

```text
articles
nextPage or nextCursor
```

---

## 3. Worker Shard Deployment Checklist

The RSS ingestion Worker lives in:

```text
worker/
```

Use this checklist when changing:

* RSS fetching
* AI review logic
* thumbnail extraction
* Supabase writes
* Better Stack Worker logs
* Sentry Worker capture
* Worker environment bindings
* generated Wrangler config behavior

### Local Worker checks

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker
npm install
npm run generate:wrangler
npx tsc --noEmit
```

### Required Cloudflare Worker secrets

Each shard needs access to:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_INGESTING_HOST
SENTRY_DSN
```

### Deploy one shard first

Deploy shard 0 first for a safer smoke test:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker
npm run generate:wrangler
npx wrangler deploy --config generated-wrangler/wrangler.shard0.jsonc
```

Then run a low-limit manual test:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Expected:

```text
NutsNews refresh complete
```

Important healthy fields:

```text
message
shardIndex
feedCount
fetchedCount
candidateCount
eligibleForAiCount
aiReviewedCount
acceptedCount
rejectedCount
reviewSaveOk
articleSaveOk
feedHealthSaveOk
aiUsageSaveOk
workerRunSaveOk
durationMs
```

### Deploy all shards

After shard 0 looks healthy:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker
npm run deploy:all
```

### Worker post-deploy checks

Test a few shards:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
curl "https://nutsnews-worker-12.nutsnews.workers.dev/?limit=1"
curl "https://nutsnews-worker-24.nutsnews.workers.dev/?limit=1"
```

Optional full shard sweep:

```bash
for shard in $(seq 0 24); do
  echo "== shard $shard =="
  curl -s "https://nutsnews-worker-${shard}.nutsnews.workers.dev/?limit=1"     | python3 -m json.tool
  echo
  sleep 2
done
```

Tail a shard while testing:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker
npx wrangler tail --config generated-wrangler/wrangler.shard0.jsonc
```

---

## 4. Controller Deployment Checklist

The controller Worker lives in:

```text
controller/
```

Use this checklist when changing:

* shard orchestration
* shard selection
* controller cron behavior
* controller logging
* controller Sentry handling
* controller environment config

### Local controller checks

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/controller
npm install
npx tsc --noEmit
```

### Deploy controller

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/controller
npm run deploy
```

### Controller post-deploy checks

Run automatic shard selection:

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/"
```

Run a specific shard through the controller:

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
```

Expected top-level fields:

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

Healthy values:

```text
message: NutsNews controller run complete
ok: true
status: 200
response.message: NutsNews refresh complete
```

Tail controller logs:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/controller
npx wrangler tail nutsnews-controller
```

More detailed controller and shard commands live in:

```text
docs/CONTROLLER_AND_SHARDS.md
```

---

## 5. Supabase Migration Checklist

Use this checklist when a release includes files in:

```text
supabase/migrations/
```

Review migration files:

```bash
ls -la supabase/migrations
```

Apply migrations:

```bash
supabase db push
```

After applying migrations, check important tables:

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

Check latest Worker run writes:

```sql
select
  run_started_at,
  shard_index,
  success,
  error_name,
  error_message,
  review_save_ok,
  article_save_ok,
  feed_health_save_ok,
  ai_usage_save_ok,
  worker_run_save_ok,
  duration_ms
from public.worker_runs
order by run_started_at desc
limit 25;
```

---

## 6. Cloudflare Cache Purge Checklist

Use this checklist when changing:

* homepage rendering
* article page rendering
* `/api/articles`
* cache headers
* `web/middleware.ts`
* `web/next.config.ts`
* Open Graph images
* `robots.txt`
* `sitemap.xml`

### Purge from Cloudflare dashboard

In Cloudflare:

```text
Website → nutsnews.com → Caching → Configuration → Purge Cache
```

For major cache/header changes, use:

```text
Purge Everything
```

For smaller changes, purge specific URLs:

```text
https://www.nutsnews.com/
https://www.nutsnews.com/api/articles?page=0
https://www.nutsnews.com/robots.txt
https://www.nutsnews.com/sitemap.xml
```

### Optional API purge

Set these locally only for the command session:

```bash
export CLOUDFLARE_ZONE_ID="your_zone_id"
export CLOUDFLARE_API_TOKEN="your_cache_purge_token"
```

Purge everything:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache"   -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"   -H "Content-Type: application/json"   --data '{"purge_everything":true}'
```

Purge specific files:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache"   -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"   -H "Content-Type: application/json"   --data '{"files":["https://www.nutsnews.com/","https://www.nutsnews.com/api/articles?page=0"]}'
```

Do not commit Cloudflare API tokens.

---

## 7. Post-Deploy Verification Checklist

Run the bundled verification script from repo root:

```bash
./scripts/post_deploy_verify.sh
```

With an article path:

```bash
./scripts/post_deploy_verify.sh https://www.nutsnews.com /articles/<article-id>
```

The script checks:

* homepage HTTP response
* article API HTTP response
* article API basic JSON shape
* Cloudflare cache HIT behavior through `validate_cloudflare_cache_hit_rate.sh`
* controller automatic trigger
* controller specific shard trigger
* direct Worker shard trigger

Manual verification commands:

```bash
curl -I "https://www.nutsnews.com/"
curl -s "https://www.nutsnews.com/api/articles?page=0"
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
curl "https://nutsnews-controller.nutsnews.workers.dev/"
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Expected public site result:

```text
HTTP/2 200
```

Expected cache result after repeated requests:

```text
cf-cache-status: HIT
```

Expected controller result:

```text
NutsNews controller run complete
```

Expected Worker result:

```text
NutsNews refresh complete
```

---

## 8. Observability Verification Checklist

After deploy, check Better Stack, Sentry, and admin dashboards.

### Better Stack searches

```text
service:nutsnews-web
service:nutsnews-worker
service:nutsnews-controller
```

Useful Worker search:

```text
service:nutsnews-worker shardIndex:0
```

Useful controller search:

```text
service:nutsnews-controller
```

### Sentry checks

Check the Sentry project for:

* new frontend errors
* new server errors
* hydration errors
* Worker errors
* controller errors

### Admin dashboards

```text
/admin
/admin/ai-usage
/admin/shards
/admin/feed-health
/admin/feeds
```

Check that:

* shard freshness looks normal
* latest Worker runs are saving
* AI usage is within expectations
* feed health is not getting worse
* Sentry has no new deployment-related errors

---

## 9. Rollback Checklist

### Web rollback

Use Vercel deployment rollback if the web app is broken.

Then verify:

```bash
curl -I "https://www.nutsnews.com/"
curl -s "https://www.nutsnews.com/api/articles?page=0" | head -c 500
```

### Worker rollback

Redeploy the previous known-good commit or config.

Safer approach:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker
npm run generate:wrangler
npx wrangler deploy --config generated-wrangler/wrangler.shard0.jsonc
```

Test shard 0 before deploying all shards:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

### Controller rollback

Redeploy the previous known-good controller:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/controller
npm run deploy
```

Verify:

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
```

### Cache rollback/purge

After rollback, purge Cloudflare cache if public pages or API responses may still be stale.

Then validate:

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

---

## 10. Release Completion Checklist

Before closing a deployment issue, confirm:

```text
[ ] Web build passed
[ ] Supabase migrations applied, if any
[ ] Worker configs regenerated, if Worker changed
[ ] Worker shard 0 tested, if Worker changed
[ ] All Worker shards deployed, if Worker changed
[ ] Controller deployed, if controller changed
[ ] Cloudflare cache purged, if public/cache behavior changed
[ ] Post-deploy verification passed
[ ] Better Stack logs checked
[ ] Sentry checked
[ ] Admin dashboards checked
[ ] GitHub issue updated with validation notes
```

---

## Related Docs

| Document | Purpose |
| --- | --- |
| [Operations](OPERATIONS.md) | Day-to-day operating model |
| [Controller and Shards](CONTROLLER_AND_SHARDS.md) | Manual controller and shard commands |
| [Performance and Resiliency](PERFORMANCE_AND_RESILIENCY.md) | Cache, performance, resiliency, and cost controls |
| [Observability](OBSERVABILITY.md) | Better Stack, Sentry, structured logs, and dashboards |
| [Troubleshooting Guide](TROUBLESHOOTING.md) | Diagnose production problems |
