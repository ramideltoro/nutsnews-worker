# Public Feed Snapshot and Edge Fallback

NutsNews uses two snapshot layers for the public feed:

1. **Supabase materialized snapshot**: the normal fast read path for the homepage and `/api/articles`.
2. **Cloudflare KV edge snapshot**: a last-known-good fallback served by the Worker if Supabase public feed reads fail.

Issue #104 adds the second layer. Supabase remains the source of truth; KV only stores a compact public copy of recent article cards for outages.

---

## Why This Exists

The public feed should stay readable during temporary Supabase or API failures.

The edge fallback also reduces risk during incidents because the public site can still return a small, cached article list instead of failing closed.

---

## Read Path

Normal reader request:

```text
1. /api/articles
2. public.public_feed_snapshot in Supabase
3. public.articles fallback in Supabase
```

Outage fallback request:

```text
1. /api/articles
2. Supabase snapshot read fails
3. Supabase articles fallback fails or returns no rows
4. Web app fetches Cloudflare Worker /public-feed-snapshot
5. Worker serves last-known-good snapshot from Cloudflare KV
```

The homepage uses the same edge-aware helper for its initial article load and category sections.

---

## Write Path

After an ingestion or translation run, the Worker refreshes the Supabase materialized snapshot:

```text
/rest/v1/rpc/refresh_public_feed_snapshot
```

If `NUTSNEWS_KV` is bound to the Worker, the Worker then reads the newest rows from `public.public_feed_snapshot` and writes one compact JSON document to KV:

```text
public-feed:snapshot:v1:latest
```

The KV snapshot includes:

```text
version
updatedAt
refreshedAt
shardIndex
articleCount
maxArticles
articles[]
```

Each article contains only public card fields:

```text
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

---

## Worker Endpoints

### Public feed fallback

```bash
curl -i "https://nutsnews-worker-0.nutsnews.workers.dev/public-feed-snapshot?page=0&pageSize=5"
```

Optional category filter:

```bash
curl -i "https://nutsnews-worker-0.nutsnews.workers.dev/public-feed-snapshot?page=0&pageSize=5&category=Science"
```

### Snapshot status

```bash
curl -i "https://nutsnews-worker-0.nutsnews.workers.dev/public-feed-snapshot/status"
```

---

## Response Headers

`/api/articles` now exposes the active data source:

```text
X-NutsNews-Article-Data-Source: public_feed_snapshot | articles_fallback | edge_feed_snapshot
X-NutsNews-Feed-Snapshot: hit | fallback | edge-fallback
X-NutsNews-Edge-Snapshot: not-used | hit | miss | error
X-NutsNews-Edge-Snapshot-Updated-At: 2026-07-01T00:00:00.000Z
X-NutsNews-Edge-Snapshot-Age-Seconds: 120
X-NutsNews-Edge-Snapshot-Article-Count: 120
X-NutsNews-Edge-Snapshot-Version: 1
```

The Worker fallback endpoint exposes the same edge snapshot age headers.

---

## Admin Visibility

The admin portal includes:

```text
/admin/edge-snapshot
```

Use it to check:

- whether the web app has an edge snapshot endpoint configured
- whether the Worker has a KV snapshot available
- snapshot age
- article count
- snapshot version
- configured endpoint

---

## Environment Variables

### Web / Vercel

Set this to one deployed Worker endpoint. Shard 0 is enough because the KV namespace is shared across shards.

```bash
NUTSNEWS_EDGE_FEED_SNAPSHOT_URL="https://nutsnews-worker-0.nutsnews.workers.dev"
```

The code also accepts the older alias:

```bash
NUTSNEWS_EDGE_SNAPSHOT_URL="https://nutsnews-worker-0.nutsnews.workers.dev"
```

### Worker / Cloudflare

Create and bind a KV namespace:

```bash
cd worker
npx wrangler kv namespace create NUTSNEWS_KV
```

Then generate Worker configs with the namespace id:

```bash
export NUTSNEWS_KV_NAMESPACE_ID="paste_namespace_id_here"
export PUBLIC_FEED_EDGE_SNAPSHOT_LIMIT=120
export PUBLIC_FEED_EDGE_SNAPSHOT_TTL_SECONDS=604800
npm run generate:wrangler
```

Deploy the Workers:

```bash
npm run deploy:all
```

---

## Invalidation and Update Rules

The edge snapshot updates after successful Worker refreshes.

Recommended defaults:

```text
PUBLIC_FEED_EDGE_SNAPSHOT_LIMIT=120
PUBLIC_FEED_EDGE_SNAPSHOT_TTL_SECONDS=604800
```

Rules:

- Supabase is still the source of truth.
- KV is overwritten after each successful public snapshot refresh.
- KV stores a bounded number of article cards, not the whole archive.
- KV TTL protects against serving very old data forever.
- The API only uses KV when the normal Supabase paths cannot serve the feed.

---

## Verification

Check the Worker has a snapshot:

```bash
curl -i "https://nutsnews-worker-0.nutsnews.workers.dev/public-feed-snapshot/status"
```

Check the public API normal path:

```bash
curl -I "https://nutsnews.com/api/articles?page=0"
```

Expected normal headers:

```text
X-NutsNews-Article-Data-Source: public_feed_snapshot
X-NutsNews-Feed-Snapshot: hit
X-NutsNews-Edge-Snapshot: not-used
```

During a Supabase read incident, expected fallback headers:

```text
X-NutsNews-Article-Data-Source: edge_feed_snapshot
X-NutsNews-Feed-Snapshot: edge-fallback
X-NutsNews-Edge-Snapshot: hit
X-NutsNews-Edge-Snapshot-Age-Seconds: <number>
```

Run the mocked web regression test:

```bash
cd web
npm run test:e2e:offline
```

The test includes a mocked Supabase outage and verifies `/api/articles` can recover from the edge snapshot fallback.

---

## Troubleshooting

### `/admin/edge-snapshot` says unconfigured

Set this in Vercel:

```bash
NUTSNEWS_EDGE_FEED_SNAPSHOT_URL="https://nutsnews-worker-0.nutsnews.workers.dev"
```

Redeploy the web app.

### Worker status returns 503

The Worker probably does not have `NUTSNEWS_KV` bound. Create the namespace, export `NUTSNEWS_KV_NAMESPACE_ID`, regenerate Wrangler configs, and redeploy.

### Worker status returns 404

KV is bound, but no snapshot has been written yet. Run a small Worker refresh:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Then check `/public-feed-snapshot/status` again.

### API never uses the edge snapshot

That is normal while Supabase is healthy. The edge snapshot is a fallback, not the primary path.
