# Issue 104 Edge Feed Snapshot Fallback Update

This update implements GitHub issue #104.

## Added

- Worker `/public-feed-snapshot` endpoint backed by Cloudflare KV
- Worker `/public-feed-snapshot/status` endpoint
- Worker KV publish step after `refresh_public_feed_snapshot`
- Web fallback from `/api/articles` to the Worker edge snapshot
- Homepage initial feed and category-section fallback helpers
- `/admin/edge-snapshot` status dashboard
- Response headers for edge snapshot age, version, and article count
- Offline web E2E coverage for Supabase outage recovery through edge snapshot

## Required config

Web:

```bash
NUTSNEWS_EDGE_FEED_SNAPSHOT_URL="https://nutsnews-worker-0.nutsnews.workers.dev"
```

Worker:

```bash
NUTSNEWS_KV_NAMESPACE_ID="paste_namespace_id_here"
PUBLIC_FEED_EDGE_SNAPSHOT_LIMIT=120
PUBLIC_FEED_EDGE_SNAPSHOT_TTL_SECONDS=604800
```

## Docs

Main runbook:

```text
docs/PUBLIC_FEED_SNAPSHOT.md
```
