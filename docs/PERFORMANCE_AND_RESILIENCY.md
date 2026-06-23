# Performance and Resiliency

NutsNews is designed to stay fast, reliable, and inexpensive as traffic and RSS volume grow.

---

## Performance Highlights

### Lightweight Homepage Rendering

The public homepage is intentionally kept lightweight.

It uses:

* Server-rendered first page for fast initial paint
* Client-side automatic scroll loading for older stories
* Cursor pagination through `/api/articles`
* No manual older/newer pagination buttons
* No homepage filter section
* No extra frontend libraries for the public feed

Example:

```text
/
```

---

### Optimized Article Image Delivery

The public feed uses a shared optimized article image component for article cards and article detail headers.

The image layer improves feed speed by:

* Serving responsive image candidates instead of forcing each phone to download a publisher's original full-size image
* Requesting modern formats such as AVIF and WebP when supported by the browser
* Eager-loading the first visible article image with high fetch priority
* Lazy-loading lower article images so they do not compete with the first screen
* Showing an amber loading backdrop while the final image downloads
* Falling back to the raw publisher image if the optimizer cannot fetch a specific remote image
* Showing branded fallback art if both optimized and raw publisher image loading fail

The Next.js image optimizer is configured in:

```text
web/next.config.ts
```

Image behavior is centralized in:

```text
web/app/components/OptimizedArticleImage.tsx
web/lib/imageDelivery.ts
```

Detailed guide:

```text
docs/IMAGE_DELIVERY.md
```

---

## Cloudflare CDN

Cloudflare sits in front of the public site and caches eligible public pages and API responses.

This helps:

* Reduce repeated hits to Vercel
* Improve repeat response speed
* Lower origin load
* Handle traffic spikes better
* Serve common requests from the edge

---

## Cloudflare Cache HIT Rate

Public routes use cache-friendly headers and middleware-enforced cache policy.

Public cache-eligible routes:

```text
/
/about
/articles/*
/api/articles
/opengraph-image
/articles/*/opengraph-image
/robots.txt
/sitemap.xml
```

Bypass routes:

```text
/admin/*
/api/auth/*
/api/log-test
/monitoring
```

Validate:

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

Expected:

```text
cf-cache-status: HIT
```

---

## Deployment and Cache Validation

When a release changes public pages, article API behavior, cache headers, or Cloudflare rules, use the deployment checklist:

```text
docs/DEPLOYMENT_CHECKLIST.md
```

The checklist includes Cloudflare cache purge steps and post-deploy cache HIT verification.

Quick cache validation:

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

---

## Public Feed Snapshot

The homepage and `/api/articles` now read from a precomputed Supabase materialized view first:

```text
public.public_feed_snapshot
```

This reduces repeated database work because the public feed no longer needs to repeatedly filter, image-check, and sort the full `articles` table for the common homepage path.

The Worker refreshes the snapshot after each ingestion run by calling:

```text
public.refresh_public_feed_snapshot()
```

The web app keeps a safe fallback:

```text
public.public_feed_snapshot -> public.articles fallback
```

The article API exposes the active source in headers:

```text
X-NutsNews-Article-Data-Source: public_feed_snapshot | articles_fallback
X-NutsNews-Feed-Snapshot: hit | fallback
```

Detailed guide:

```text
docs/PUBLIC_FEED_SNAPSHOT.md
```

---

## Article API Pagination

The public article API is optimized for predictable mobile feed performance.

Route:

```text
/api/articles?page=0
```

The API returns a small card payload:

```text
id, source, title, original_url, image_url, published_at, published_on_site_at, ai_summary, category, positivity_score
```

Page size:

```text
PAGE_SIZE = 5
```

The homepage uses cursor pagination for automatic scroll loading:

```text
/api/articles?page=0
/api/articles?cursor=<nextCursor>
```

Offset pagination remains available for compatibility, but the public homepage no longer shows manual older/newer buttons.

---

## Database Indexes

Supabase migrations add indexes for public feed and duplicate-check performance.

Important index areas:

* Active RSS feed selection by `is_active` and `id`
* Unique RSS feed URLs
* Unique AI review records by `original_url`
* Unique published article records by `original_url`
* Published image-backed feed ordering
* Recent AI review history scans
* Category search support

---

## Worker Sharding

RSS processing can be split across many Cloudflare Worker shards.

Example:

```text
500 RSS feeds
20 feeds per shard
25 Worker shards
```

This reduces the chance that one large workload overwhelms a single Worker.

---

## Partial Failure Handling

The Worker is designed to complete useful work even when some dependencies fail.

Handled failure areas:

* Individual RSS feed failures
* OpenAI API failures
* OpenAI invalid responses
* Supabase lookup failures
* Supabase save failures
* Better Stack delivery failures
* Article-page image hydration failures

A single bad RSS feed should not fail the full Worker run.

---

## Thumbnail Quality

NutsNews requires published articles to have a usable publisher image.

The Worker checks:

* RSS media tags
* RSS thumbnail tags
* Image enclosures
* iTunes image tags
* RSS item image blocks
* Embedded RSS HTML images
* Article metadata
* `og:image`
* `twitter:image`
* JSON-LD image fields
* Article page image tags

Generic images are rejected when they look like:

* Google News placeholders
* Logos
* Favicons
* Icons
* Sprites
* Avatars
* Tracking pixels
* SVG icons
* Tiny images

Tracked counters:

```text
imageHydrationLookupCount
imageHydrationFoundCount
noThumbnailRejectedCount
```

---

## Cost Controls

OpenAI is the main usage-based cost.

NutsNews reduces unnecessary AI calls through:

* Local filtering before AI
* Duplicate URL detection
* Accepted article review caching
* Rejected article review caching
* Shard-level review limits
* Batch database operations
* Admin AI usage dashboard
* Estimated OpenAI cost visibility

Core idea:

```text
Review each article once, remember the decision, and avoid paying to review the same story again.
```

---

## Resiliency Highlights

NutsNews improves resiliency by:

* Using managed serverless platforms
* Splitting ingestion across Worker shards
* Allowing Worker runs to continue when individual feeds fail
* Treating OpenAI failures as safe rejections
* Logging Supabase save failures clearly
* Tracking reviewed URLs
* Coordinating shards with a controller Worker
* Monitoring uptime externally
* Capturing application errors in Sentry
* Logging activity centrally in Better Stack
* Keeping public reader routes cacheable
* Keeping admin dashboards separate from public reader pages

---

## Worker Article Recovery Improvements

The Worker now does more work to recover usable publisher images before rejecting articles for missing thumbnails.

Current behavior:

* Article page image hydration defaults to multiple lookups per run instead of only one lookup.
* Manual Worker tests can override image lookup count with `imageLookups`.
* No-thumbnail local rejections are retried after a short cooldown instead of becoming permanent dead ends.
* Article AI review rows are merged on conflict so retry cooldowns refresh cleanly.
* RSS image detection accepts more publisher CDN image URL shapes.
* Atom image enclosure links are included as RSS image candidates.

Manual test with more image lookups:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=6&imageLookups=8"
```

Watch these response fields:

```text
fetchedCount
candidateCount
alreadyReviewedCount
unreviewedCount
articlePageImageLookupLimit
imageHydrationLookupCount
imageHydrationFoundCount
noThumbnailRejectedCount
eligibleForAiCount
aiReviewedCount
acceptedCount
rejectedCount
```

A healthier run should show one or more of:

```text
imageHydrationFoundCount > 0
eligibleForAiCount > 0
acceptedCount > 0
```

---

## Failed Feed Error Truncation

The Worker keeps partial RSS feed failure behavior, but failed feed error messages are kept short and readable.

When a feed returns a large HTML error page, the Worker now:

* strips noisy HTML, script, style, and noscript content
* keeps the HTTP status visible
* keeps a short readable response preview
* caps the final message around 500 characters
* keeps `feedFetchSuccessCount` and `feedFetchFailureCount` unchanged
* continues returning `NutsNews refresh complete` when only some feeds fail

This keeps manual `curl` checks, controller responses, Better Stack payloads, and admin debugging easier to read.
