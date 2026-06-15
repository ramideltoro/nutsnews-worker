# Public Feed Snapshot

Issue #8 adds a stable optimized data source for the public homepage and `/api/articles`.

The snapshot reduces repeated database work by precomputing the public article card feed in Supabase and letting the web app read that smaller, ordered data source first.

---

## What Was Added

The migration creates:

```text
public.public_feed_snapshot
public.refresh_public_feed_snapshot()
```

`public.public_feed_snapshot` is a materialized view. It contains only public, published, image-backed article card fields.

The Worker refreshes the snapshot after each ingestion run by calling:

```text
/rest/v1/rpc/refresh_public_feed_snapshot
```

The web app serves the homepage and `/api/articles` from the snapshot when possible. If the snapshot is missing or temporarily unavailable, the code falls back to the original `public.articles` query.

---

## Why a Materialized View

The snapshot belongs in Supabase as a materialized view because it gives NutsNews:

* a stable optimized read source for the homepage
* a precomputed sort order
* less repeated filtering on `articles`
* less repeated sorting by `published_on_site_at`
* a direct SQL object that can be validated after restore
* a safe fallback path in application code

This is a good fit for the current architecture because the article feed changes on Worker refresh cadence, not every millisecond.

---

## Snapshot Contents

The snapshot includes:

```text
snapshot_rank
id
source
title
original_url
image_url
published_at
published_on_site_at
ai_summary
category
positivity_score
```

It only includes rows where:

```sql
status = 'published'
image_url is not null
btrim(image_url) <> ''
```

---

## Freshness Window

The snapshot is refreshed by the Worker after article saves.

Current freshness model:

```text
RSS ingestion cadence + Worker duration + CDN cache window
```

The public API and homepage already use cache headers with a short public cache window, so new articles should appear within the normal Worker/CDN freshness window.

---

## Web Read Path

The web app tries this order:

```text
1. public.public_feed_snapshot
2. fallback to public.articles
```

The response from `/api/articles` includes these headers:

```text
X-NutsNews-Article-Data-Source: public_feed_snapshot | articles_fallback
X-NutsNews-Feed-Snapshot: hit | fallback
```

Use this to confirm whether the optimized path is active.

---

## Test the Snapshot

After applying the migration:

```bash
supabase db push
```

Run this in Supabase SQL Editor:

```sql
select
  snapshot_rank,
  id,
  source,
  title,
  published_on_site_at
from public.public_feed_snapshot
order by snapshot_rank asc
limit 10;
```

Manually refresh:

```sql
select public.refresh_public_feed_snapshot();
```

Check row count:

```sql
select count(*) as snapshot_articles
from public.public_feed_snapshot;
```

---

## Test the API

Local or production:

```bash
curl -I "http://localhost:3000/api/articles?page=0"
```

Expected optimized headers:

```text
X-NutsNews-Article-Data-Source: public_feed_snapshot
X-NutsNews-Feed-Snapshot: hit
```

If the migration has not been applied yet, the API should still work and show:

```text
X-NutsNews-Article-Data-Source: articles_fallback
X-NutsNews-Feed-Snapshot: fallback
```

---

## Test the Worker Refresh

Run a small Worker check:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Expected response field:

```text
publicFeedSnapshotRefreshOk: true
```

If it is `false`, check that the Supabase migration was applied and that the service role can execute `public.refresh_public_feed_snapshot()`.

---

## Restore Validation

The restore validation script now checks that the materialized view exists and that it has rows:

```bash
RESTORE_DATABASE_URL="postgresql://..." ./scripts/validate_supabase_restore.sh
```

The validation SQL lives in:

```text
supabase/restore_validation.sql
```

---

## Operational Notes

If the snapshot becomes stale:

```sql
select public.refresh_public_feed_snapshot();
```

If the snapshot is missing, the homepage and API should continue serving from `public.articles` through the fallback path.

If the API is unexpectedly using fallback after migration:

1. Confirm `public.public_feed_snapshot` exists.
2. Confirm the materialized view has rows.
3. Run `select public.refresh_public_feed_snapshot();`.
4. Recheck `/api/articles?page=0` response headers.
5. Confirm Supabase anon role can select from the materialized view.
