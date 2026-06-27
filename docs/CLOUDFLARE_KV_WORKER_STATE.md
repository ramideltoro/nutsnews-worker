# Cloudflare KV Worker State for NutsNews

This update adds an optional Cloudflare Workers KV binding named `NUTSNEWS_KV` to the RSS shard Workers.

## Why KV is the right first upgrade

NutsNews already uses Supabase as the system of record. D1 would act like another relational database, so it is not the best first move unless NutsNews later wants to move part of the data model away from Supabase.

KV is a better fit now because it is cheap, global, and simple. It can store small pieces of operational state close to the Workers without becoming a second source of truth.

Use KV for:

- recent processed URL markers, so Workers can skip recently handled articles before going back to Supabase
- latest successful Worker run status
- latest shard run state
- lightweight RSS metadata such as failed feeds and counts inside the run snapshot
- future feature flags or emergency switches

Keep Supabase for:

- published articles
- article summaries and translations
- article review history
- admin dashboards
- searchable article archive

## What changed in code

### `worker/src/index.ts`

Adds optional `NUTSNEWS_KV` support.

When the binding exists, each RSS shard Worker now:

1. Reads a compact per-shard KV cache of recently processed URL hashes.
2. Skips Supabase processed-url lookup for URLs that KV already knows are processed.
3. Writes newly reviewed URLs back to a compact per-shard KV key after the Supabase review save succeeds.
4. Writes latest shard run state and latest successful run state to KV.
5. Exposes a safe debug endpoint:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/kv-status"
```

The endpoint does not expose article URLs. Processed URL markers are stored as SHA-256 hashes.

### `worker/scripts/generate-wrangler-config.mjs`

Adds an optional KV binding to every generated shard config when this environment variable is present:

```bash
NUTSNEWS_KV_NAMESPACE_ID=<your-kv-namespace-id>
```

Optional preview namespace:

```bash
NUTSNEWS_KV_PREVIEW_NAMESPACE_ID=<your-preview-kv-namespace-id>
```

Optional marker size override:

```bash
KV_RECENT_PROCESSED_URL_LIMIT=2000
```

## Why this stays within the free KV write limits

The Worker writes only a few KV keys per run:

- one compact recent processed URL marker key per shard
- one latest shard run state key
- one latest successful run state key

It does **not** write one KV key per article, because that could burn through the free daily write limit quickly.

## Setup

Create one KV namespace:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npx wrangler kv namespace create NUTSNEWS_KV
```

Copy the generated namespace ID from Wrangler output, then export it before deploying shards:

```bash
export NUTSNEWS_KV_NAMESPACE_ID="paste_the_id_here"
```

Then regenerate and deploy shards:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npm run generate:wrangler
npm run deploy:all
```

## Verify

After deployment, run:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/kv-status"
```

You should see:

```json
{
  "kvEnabled": true,
  "shardIndex": 0,
  "latestShardRun": null,
  "lastSuccessfulRun": null,
  "recentProcessedUrlCache": null
}
```

After the Worker runs once, `latestShardRun`, `lastSuccessfulRun`, and `recentProcessedUrlCache.hashCount` should start filling in.

## Notes on article API response caching

The current public article API is a Next.js/Vercel route at `/api/articles`. That route already sends cache headers, so Cloudflare can cache it at the HTTP edge without KV.

KV becomes useful for article API response caching only if NutsNews later adds a dedicated Cloudflare Worker in front of `/api/articles` or moves the public feed endpoint to Cloudflare Pages/Workers. For the current architecture, this update intentionally uses KV where it is safest: RSS Worker state and dedupe hints.
