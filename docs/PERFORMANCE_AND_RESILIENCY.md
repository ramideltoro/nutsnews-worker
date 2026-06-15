# Performance and Resiliency

NutsNews is designed to stay fast, reliable, and inexpensive as traffic and RSS volume grow.

---

## Performance Highlights

### Lightweight Homepage Rendering

The public homepage is intentionally kept lightweight.

It uses:

* Server-rendered article cards
* Server-rendered category links
* URL-based category filtering
* URL-based older/newer pagination
* Native HTML disclosure behavior for the filter menu
* No homepage infinite-scroll client state
* No extra frontend libraries for the public feed

Examples:

```text
/
/?category=Science
/?category=Community&page=1
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

The API supports offset pagination and optional cursor pagination:

```text
/api/articles?page=0
/api/articles?cursor=<nextCursor>
```

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
