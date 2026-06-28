# NutsNews Worker Acceptance Fix

## What this fixes

This update fixes a Worker path that could make new accepted stories fail to show up after the translation/KV/Redis updates.

### 1. Accepted articles now publish immediately by default

The Worker had started saving accepted articles as `translation_pending` whenever summary translations were enabled. Since French and Japanese summaries are enabled by default, a translation failure could hide an otherwise accepted article from the public feed.

This update changes the default behavior so accepted English articles publish immediately. Translation generation still runs best-effort, and the web app already falls back to English when a translated title/summary is missing.

A new optional setting exists for the old strict behavior:

```bash
HOLD_ARTICLES_FOR_TRANSLATIONS=true
```

Leave it unset or set it to `false` for the safer default.

### 2. Redis article locks no longer starve AI reviews

When Redis was enabled, the Worker only tried to lock the first `maxAiReviews` eligible articles. If those top articles were already locked, a run could review fewer articles than expected, or even zero.

This update lets the Worker keep scanning eligible articles until it claims up to the configured review limit.

### 3. KV no longer caches retryable no-thumbnail rejects

No-thumbnail rejects are supposed to be retried after a short window, because article pages sometimes gain or expose images later. KV was storing them as processed for up to a week, which bypassed that retry path.

This update keeps no-thumbnail rejections out of the KV processed-url cache so the existing retry logic can work again.

## One-time cleanup for articles already stuck as `translation_pending`

Run this in the Supabase SQL editor after deploying the Worker fix:

```sql
update public.articles
set status = 'published'
where status = 'translation_pending'
  and image_url is not null
  and btrim(image_url) <> '';

select public.refresh_public_feed_snapshot();
```

## Verify after deploy

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=6&imageLookups=8" | python3 -m json.tool
curl "https://nutsnews-worker-0.nutsnews.workers.dev/redis-status" | python3 -m json.tool
curl "https://nutsnews-worker-0.nutsnews.workers.dev/kv-status" | python3 -m json.tool
```

In the manual refresh response, check these fields:

- `acceptedCount`
- `articleSaveOk`
- `articleSummaryPublishCount`
- `publicFeedSnapshotRefreshOk`
- `eligibleForAiCount`
- `aiReviewedCount`
- `redisAiReviewLockSkippedCount`
- `kvProcessedUrlHitCount`

If `acceptedCount` is greater than `0`, the articles should now be published immediately unless the database save fails.
