# Operations

This document explains how NutsNews is operated and maintained.

---

## Admin Portal

The admin portal lives at:

```text
/admin
```

It is protected by Google login and an approved admin email allowlist.

Current admin routes:

```text
/admin
/admin/articles
/admin/ai-usage
/admin/local-ai
/admin/shards
/admin/feed-health
/admin/feeds
/admin/login
```

---

## Admin Dashboards

### Article Review Dashboard

Route:

```text
/admin/articles
```

Purpose:

* Show recently reviewed articles
* Sort reviewed articles by review time
* Filter by accepted/rejected decision
* Filter by source
* Filter by category
* Filter by positivity score
* Show rejection reasons
* Link to the original article
* Link to the published NutsNews story when available
* Support manual investigation of bad AI decisions
* Show whether OpenAI, local AI, or local rules processed each article
* Show the exact AI model name saved with the article review

Detailed guide:

```text
docs/ADMIN_ARTICLE_REVIEWS.md
```

### AI Usage Dashboard

Route:

```text
/admin/ai-usage
```

Purpose:

* Track OpenAI calls
* Track prompt tokens
* Track completion tokens
* Track total tokens
* Track estimated cost
* Track accepted/rejected reviews
* Track cost protection hits
* Track spike warnings

### Local AI Dashboard

Route:

```text
/admin/local-ai
```

Purpose:

* Track Oracle-hosted local AI calls
* Track qwen/Ollama model usage
* Track local accepted/rejected decisions
* Track local review latency
* Track OpenAI fallback calls while local AI mode is enabled
* Show recent local AI article decisions
* Compare model-level quality signals while testing new local models

Detailed guide:

```text
docs/ORACLE_LOCAL_AI.md
```

### Worker Shard Health Dashboard

Route:

```text
/admin/shards
```

Purpose:

* Track Worker shard freshness
* Identify failed shards
* Identify stale shards
* Show latest errors
* Show failed Worker runs
* Show feed counts
* Show accepted/rejected counts
* Show image hydration metrics

### Feed Health Dashboard

Route:

```text
/admin/feed-health
```

Purpose:

* Show RSS feed reliability
* Show repeated failures
* Show thumbnail coverage
* Show accepted output
* Identify weak feeds
* Compare source quality signals

### Feed Management Dashboard

Route:

```text
/admin/feeds
```

Purpose:

* List RSS feeds
* Show 0-100 source quality scores
* Show source quality grades
* Enable feeds
* Disable feeds
* Inspect active/inactive status
* Manage bad sources without code deploys

---

## Deployment Checklist

The repeatable production deployment checklist lives in:

```text
docs/DEPLOYMENT_CHECKLIST.md
```

Use that guide when releasing changes to:

* Vercel web app
* Cloudflare Worker shards
* Controller Worker
* Supabase migrations
* Cloudflare cache behavior
* Post-deploy verification commands

Quick post-deploy verification:

```bash
./scripts/post_deploy_verify.sh
```

With an article path:

```bash
./scripts/post_deploy_verify.sh https://www.nutsnews.com /articles/<article-id>
```

---

## Deployment Model

### Web

The web app is deployed to Vercel.

Common commands:

```bash
cd web
npm install
npm run build
```

### Worker shards

Worker shard configs are generated.

```bash
cd worker
npm run generate:wrangler
```

Deploy one shard:

```bash
npx wrangler deploy --config generated-wrangler/wrangler.shard0.jsonc
```

Deploy controller:

```bash
cd controller
npx wrangler deploy
```

---

## Useful Runtime Checks

### Public site

```bash
curl -I "https://www.nutsnews.com/"
```

### Article API

```bash
curl -s "https://www.nutsnews.com/api/articles?page=0"
```

### Public feed snapshot headers

```bash
curl -I "https://www.nutsnews.com/api/articles?page=0"
```

Expected optimized headers after the migration is applied and the snapshot is refreshed:

```text
X-NutsNews-Article-Data-Source: public_feed_snapshot
X-NutsNews-Feed-Snapshot: hit
X-NutsNews-Edge-Snapshot: not-used
```

### Worker shard

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

### Controller

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
```

### Cache HIT rate

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

---

## Dependency Update Routine

The dependency update runbook lives in:

```text
docs/DEPENDENCY_UPDATES.md
```

Use it when reviewing `npm audit`, applying safe patch/minor updates, or validating Dependabot PRs.

Check dependency health without changing lockfiles:

```bash
./scripts/dependency_update_routine.sh check
```

Apply safe patch/minor updates allowed by existing `package.json` ranges:

```bash
./scripts/dependency_update_routine.sh update
```

The routine intentionally avoids forced upgrades:

```text
Do not use npm audit fix --force as part of the normal routine.
```

Validation includes the web lint/build and Worker TypeScript checks.

Reports are written locally under:

```text
dependency-update-reports/<timestamp>/
```

These reports are ignored by Git.

---

## Supabase Backup and Restore

The full restore runbook lives in:

```text
docs/SUPABASE_RESTORE.md
```

Use that guide when recovering from:

* Bad deploy
* Broken migration
* Accidental delete
* Corrupt data
* Hacked data
* Production database crash

The restore process is:

1. Pause database writers.
2. Choose the backup.
3. Restore into a temporary Supabase database first.
4. Run validation queries.
5. Test the app or Worker against the temporary database.
6. Restore production only after the temporary restore passes.
7. Re-enable Workers and monitoring.

Restore validation SQL lives in:

```text
supabase/restore_validation.sql
```

Validation helper:

```bash
RESTORE_DATABASE_URL="postgresql://..." ./scripts/validate_supabase_restore.sh
```

If validating a dump file before running SQL validation:

```bash
RESTORE_DATABASE_URL="postgresql://..." ./scripts/validate_supabase_restore.sh backups/supabase/latest/nutsnews.dump
```

---

## Environment Variables

### Web / Vercel

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

### Worker / Cloudflare

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
AI_PROVIDER
LOCAL_AI_URL
LOCAL_AI_MODEL
LOCAL_AI_API_KEY
AI_PROVIDER_FALLBACK_TO_OPENAI
AI_REVIEW_CONCURRENCY
BETTER_STACK_SOURCE_TOKEN
BETTER_STACK_INGESTING_HOST
SENTRY_DSN
```

### Admin tuning

```text
ADMIN_SHARD_COUNT=25
ADMIN_SHARD_STALE_MINUTES=180
ADMIN_SHARD_SLOW_RUN_MS=15000
```

Recommended stale threshold:

```text
25 shards × 5 minutes per shard = 125 minutes per full rotation
```

A stale threshold of 180 minutes gives the controller time to complete a normal rotation with buffer.

---

## Maintenance Model

NutsNews is maintained by keeping each system boundary clear:

* RSS feeds live in Supabase.
* Worker shards share one codebase.
* Wrangler configs are generated.
* Secrets are centralized.
* Logs are structured.
* Public routes are cacheable.
* Admin routes are protected.
* Restore instructions and validation SQL live in the repo.
* Dependency update instructions and validation scripts live in the repo.
* Local dependency update reports stay outside Git.
* Actual database backup files stay outside Git.
* Docs live in `docs/`.

---

## Common Maintenance Tasks

### Run dependency health check

```bash
./scripts/dependency_update_routine.sh check
```

### Apply safe dependency updates

```bash
./scripts/dependency_update_routine.sh update
```

Review the generated report and package diffs before committing.

### Add or disable RSS feeds

Use `/admin/feeds` or update `public.rss_feeds` directly.

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

### Check latest Worker runs

```sql
select *
from public.worker_runs
order by run_started_at desc
limit 25;
```

### Check latest AI usage

```sql
select *
from public.ai_usage_runs
order by run_started_at desc
limit 25;
```

### Check weak feeds

```sql
select *
from public.bad_feeds
limit 25;
```

### Rank feeds by source quality

Use this query when deciding which feeds to keep, promote, disable, or replace:

```sql
select
  source,
  feed_url,
  is_active,
  quality_score,
  quality_grade,
  success_rate_pct,
  thumbnail_rate_pct,
  accepted_rate_pct,
  failure_rate_pct,
  duplicate_rate_pct,
  total_fetch_count,
  total_accepted_count,
  quality_reason
from public.feed_quality_scores
order by quality_score desc, total_accepted_count desc, source asc;
```

Find low-quality active feeds quickly:

```sql
select
  source,
  feed_url,
  quality_score,
  quality_grade,
  quality_reason
from public.feed_quality_scores
where is_active = true
  and quality_score < 50
order by quality_score asc, consecutive_failure_count desc, source asc;
```

Detailed scoring rules live in:

```text
docs/RSS_SOURCE_QUALITY.md
```




### Public feed edge snapshot fallback

The Worker can store a compact last-known-good public feed in Cloudflare KV and serve it from:

```bash
curl -i "https://nutsnews-worker-0.nutsnews.workers.dev/public-feed-snapshot/status"
```

The web app uses this endpoint only when the Supabase snapshot and source-table fallback cannot serve `/api/articles`. Check `/admin/edge-snapshot` for age, article count, version, and endpoint readiness.

Required web environment variable:

```bash
NUTSNEWS_EDGE_FEED_SNAPSHOT_URL="https://nutsnews-worker-0.nutsnews.workers.dev"
```

Required Worker setup:

```bash
cd worker
npx wrangler kv namespace create NUTSNEWS_KV
export NUTSNEWS_KV_NAMESPACE_ID="paste_namespace_id_here"
npm run generate:wrangler
npm run deploy:all
```

### Refresh public feed snapshot

The homepage/API optimized feed source is:

```text
public.public_feed_snapshot
```

Refresh it manually from Supabase SQL Editor when needed:

```sql
select public.refresh_public_feed_snapshot();
```

Check the latest snapshot rows:

```sql
select
  snapshot_rank,
  source,
  title,
  published_on_site_at
from public.public_feed_snapshot
order by snapshot_rank asc
limit 10;
```

Detailed guide:

```text
docs/PUBLIC_FEED_SNAPSHOT.md
```

### Validate a restored Supabase database

```bash
RESTORE_DATABASE_URL="postgresql://..." ./scripts/validate_supabase_restore.sh
```

---

## Controller and Manual Shard Operations

Detailed controller and shard commands live in:

```text
docs/CONTROLLER_AND_SHARDS.md
```

Use that guide when you need to:

* Trigger the controller manually
* Trigger a specific shard through the controller
* Trigger a shard directly
* Tail controller logs
* Tail shard logs
* Understand expected controller response fields
* Understand expected Worker shard response fields

Quick commands:

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/"
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
cd worker && npx wrangler tail --config generated-wrangler/wrangler.shard0.jsonc
```

## Local-first AI operations

For lowest OpenAI usage, deploy Worker shards with article review and translation both local-first:

```bash
export ENABLE_LOCAL_AI_SECRET_BINDING=true
export AI_PROVIDER="local"
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_MODEL="qwen2.5:3b"
export AI_PROVIDER_FALLBACK_TO_OPENAI=true
export AI_REVIEW_CONCURRENCY=1
export ENABLED_SUMMARY_LANGUAGES="fr,ja,de-CH,de,el"
export SUMMARY_TRANSLATION_LIMIT=12
```

Then regenerate and deploy Workers:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker
npm run generate:wrangler
npm run deploy:all
```

A normal local-first run should have local review logs and zero OpenAI calls unless fallback is needed.
