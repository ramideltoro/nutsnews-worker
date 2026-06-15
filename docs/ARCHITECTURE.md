# Architecture

NutsNews uses a modular serverless architecture. Each part of the system has a focused responsibility.

---

## High-Level Flow

```text
RSS Sources
  ↓
Cloudflare Worker Shards
  ↓
Local Filtering
  ↓
OpenAI Review
  ↓
Supabase Postgres
  ↓
Next.js Website on Vercel
  ↓
Cloudflare CDN
  ↓
Reader
```

---

## Operations Flow

```text
Supabase Review Data
Worker Activity
Worker Run Records
AI Usage Metrics
Shard Health Metrics
Feed Health Metrics
Operational Signals
  ↓
Private Admin Portal
  ↓
Admin Dashboards
  ↓
Operator Visibility
```

---

## Observability Flow

```text
Next.js App
Cloudflare Worker Shards
Controller Worker
  ↓
Structured Logs
  ↓
Better Stack Telemetry
  ↓
Search by service, level, event, shard, duration, status
```

Application errors are monitored through:

```text
Frontend Errors
Server Errors
Worker Errors
  ↓
Sentry
```

---

## Core Components

### `web`

The public website and admin portal.

It includes:

* Mobile-first public feed
* Article pages
* SEO metadata
* Dynamic Open Graph images
* CDN-friendly public routes
* Google-protected admin portal
* Admin dashboards
* Sentry integration
* Better Stack web logging

Important routes:

```text
/
/api/articles
/articles/[id]
/admin
/admin/ai-usage
/admin/shards
/admin/feed-health
/admin/feeds
/admin/login
```

### `worker`

The automated ingestion engine.

It fetches RSS feeds, parses articles, applies local filters, calls OpenAI for review, stores accepted articles, stores rejected review history, saves Worker run records, saves AI usage, saves feed health, and logs structured activity.

### `controller`

The orchestration layer.

It triggers Worker shards in a controlled way so every shard does not need to run at once.

### `supabase`

The data layer.

It stores articles, RSS feeds, AI review history, AI usage runs, Worker run records, feed health, and admin dashboard data.

### `docs`

The GitHub documentation layer.

The root README stays short. Detailed documentation lives in `docs/`.

---

## Repository Structure

```text
nutsnews/
├── web/
│   ├── app/
│   ├── lib/
│   ├── public/
│   ├── next.config.ts
│   └── package.json
│
├── worker/
│   ├── src/
│   ├── scripts/
│   ├── generated-wrangler/
│   └── package.json
│
├── controller/
│   ├── src/
│   ├── wrangler.jsonc
│   └── package.json
│
├── supabase/
│   └── migrations/
│
├── docs/
│   ├── README.md
│   ├── PROJECT.md
│   ├── ARCHITECTURE.md
│   ├── OPERATIONS.md
│   ├── PERFORMANCE_AND_RESILIENCY.md
│   ├── OBSERVABILITY.md
│   └── TROUBLESHOOTING.md
│
├── scripts/
├── README.md
└── LICENSE
```

---

## Data Model Summary

### `articles`

Stores the stories shown on the public website.

Important fields:

* `id`
* `source`
* `title`
* `original_url`
* `image_url`
* `published_at`
* `published_on_site_at`
* `ai_summary`
* `category`
* `positivity_score`
* `status`

### `article_ai_reviews`

Stores AI or local-filter decisions for each reviewed article.

This prevents the same story from being reviewed repeatedly.

Important fields:

* `original_url`
* `decision`
* `category`
* `positivity_score`
* `summary`
* `reason`
* `reviewed_at`

### `rss_feeds`

Stores RSS feed configuration.

This allows feeds to be added, disabled, or prioritized without changing core Worker code.

Important fields:

* `source`
* `url`
* `is_positive_source`
* `is_active`

### `ai_usage_runs`

Stores run-level OpenAI usage metrics.

Powers `/admin/ai-usage`.

### `worker_runs`

Stores successful and failed Worker executions.

Powers `/admin/shards`.

### `feed_health`

Stores source-level health and operational metrics such as fetch success, failures, image coverage, accepted output, and rejected output.

Powers `/admin/feed-health` and contributes to `/admin/feeds`.

### `feed_quality_scores`

Computed Supabase view that ranks RSS feeds from 0 to 100 using success rate, thumbnail rate, accepted rate, failure rate, and duplicate/already-seen rate.

Powers source quality badges and rankings in `/admin/feeds`.

---

## Tech Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| Next.js | Public website, article pages, admin portal, server-rendered dashboards |
| React | UI rendering |
| TypeScript | Safer application code |
| Tailwind CSS | Mobile-first styling |
| Vercel | Frontend and admin hosting |

### Automation

| Technology | Purpose |
| --- | --- |
| Cloudflare Workers | RSS ingestion and automation |
| Worker shards | Split RSS processing across many workers |
| Controller Worker | Coordinates shard execution |
| Wrangler | Worker deployment and configuration |
| Cloudflare Secrets Store | Shared Worker secrets |

### Data

| Technology | Purpose |
| --- | --- |
| Supabase | Hosted Postgres database |
| Postgres | Article, feed, review, and operational data |
| Supabase REST API | Worker-to-database communication |

### Observability

| Technology | Purpose |
| --- | --- |
| Better Stack Uptime | External uptime monitoring |
| Better Stack Logs | Centralized structured logs |
| Sentry | Application error monitoring |
| Admin dashboards | Internal platform health visibility |
