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
/admin/ai-usage
/admin/shards
/admin/feed-health
/admin/feeds
/admin/login
```

---

## Admin Dashboards

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

### Feed Management Dashboard

Route:

```text
/admin/feeds
```

Purpose:

* List RSS feeds
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
* Actual database backup files stay outside Git.
* Docs live in `docs/`.

---

## Common Maintenance Tasks

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
