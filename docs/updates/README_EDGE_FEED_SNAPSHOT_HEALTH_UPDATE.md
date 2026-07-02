# Edge Feed Snapshot Health Update

This update makes the Cloudflare Worker edge snapshot fallback easier to diagnose and harder to deploy incorrectly.

## Changes

- `/public-feed-snapshot/status` now returns an inspectable JSON status payload with:
  - `ready`
  - `kvBound`
  - `configured`
  - `enabled`
  - `status`
  - `articleCount`
  - `ageSeconds`
  - `version`
  - `message`
- The status endpoint returns HTTP 200 for dashboard inspection, even when the fallback is not ready.
- The actual fallback feed endpoint still returns an error when KV is missing or no snapshot exists.
- Wrangler config generation now requires `NUTSNEWS_KV_NAMESPACE_ID`.
- Worker CI provides a fake KV namespace id for type/config checks.
- A scheduled/manual GitHub Action checks the live Worker status endpoint and feed payload.

## Healthy status

Expected healthy payload:

```json
{
  "ready": true,
  "kvBound": true,
  "status": "hit",
  "articleCount": 120,
  "version": 1
}
```

## Recovery

If status shows `status: "unbound"`:

1. Export `NUTSNEWS_KV_NAMESPACE_ID`.
2. Regenerate Wrangler configs.
3. Deploy the Worker shards.
4. Run one Worker refresh to publish a new edge snapshot.
5. Recheck `/public-feed-snapshot/status`.
