
# Badges

[![Better Stack Badge](https://uptime.betterstack.com/status-badges/v1/monitor/2ovb1.svg)](https://uptime.betterstack.com/?utm_source=status_badge)

# NutsNews

NutsNews is a calm, mobile-first news platform that collects positive stories from trusted RSS feeds, filters out stressful topics, and presents short cheerful summaries with links back to the original publishers.

The goal of NutsNews is to create a peaceful daily feed of uplifting, inspiring, human-interest, science, culture, travel, wellness, community, animal, nature, space, creativity, and achievement stories.

**Media Owner:** Rami Del Toro
**Editor-in-Chief:** OpenAI
**Managing Editor:** OpenAI

---

## Table of Contents

* [Overview](#overview)
* [Mission](#mission)
* [What NutsNews Avoids](#what-nutsnews-avoids)
* [Key Features](#key-features)
* [Architecture](#architecture)
* [Repository Structure](#repository-structure)
* [Frontend Web App](#frontend-web-app)
* [RSS Ingestion Worker](#rss-ingestion-worker)
* [Sharded Worker Design](#sharded-worker-design)
* [Controller Worker](#controller-worker)
* [Database Design](#database-design)
* [AI Curation Workflow](#ai-curation-workflow)
* [Source-Friendly Publishing](#source-friendly-publishing)
* [Tech Stack](#tech-stack)
* [CI/CD and Deployment](#cicd-and-deployment)
* [Environment Variables and Secrets](#environment-variables-and-secrets)
* [Local Development](#local-development)
* [Operations, Monitoring, and Observability](#operations-monitoring-and-observability)
* [Current Cost Model](#current-cost-model)
* [Project Benefits](#project-benefits)
* [Roadmap](#roadmap)
* [License](#license)
* [Status](#status)

---

## Overview

NutsNews is an automated uplifting-news platform.

It discovers story candidates from RSS feeds, uses automation and AI to review them, stores approved stories in Supabase, and displays them through a mobile-friendly Next.js website.

The platform is designed to be:

* Calm and uplifting
* Mobile-first
* Source-friendly
* Low-cost to operate
* Automated end-to-end
* Scalable across hundreds of RSS feeds
* Observable through uptime monitoring

High-level flow:

```text
RSS Feeds
  ↓
Cloudflare Workers
  ↓
Local Filtering
  ↓
OpenAI Review
  ↓
Supabase Postgres
  ↓
Next.js Website
  ↓
Reader clicks through to the original publisher
```

---

## Mission

Most news feeds are optimized for urgency, conflict, fear, and attention. NutsNews is designed to offer the opposite experience.

NutsNews focuses on:

* Positive stories
* Inspiring people
* Community wins
* Wellness and lifestyle
* Science and health breakthroughs
* Nature and animal stories
* Travel and culture
* Creativity and art
* Remarkable achievements
* Human-interest stories that feel encouraging

The product goal is not to replace journalism. It is to help readers discover uplifting stories and then send them back to the original publishers.

---

## What NutsNews Avoids

The platform intentionally filters out stressful topics such as:

* Politics
* War
* Money and markets
* Crime
* Fear-driven stories
* Violent or tragic stories
* Conflict-heavy content
* Election and government coverage
* Inflation, stocks, business, and financial stress stories

The Worker and OpenAI prompt are designed to reject articles that do not match the calm editorial direction of the site.

---

## Key Features

### Mobile-first article feed

The website renders a clean story feed optimized for phone screens.

Each card includes:

* Title
* Short AI-written summary
* Source label
* Published date
* Category badges
* Image or generated fallback thumbnail
* Link to the original article

### AI-assisted story selection

OpenAI is used to classify story candidates, reject unsuitable articles, assign categories, score positivity, and produce short calm summaries.

### RSS-based discovery

RSS feeds provide the article candidate pool. The system can ingest from positive-news publishers, general publishers, and topic-based RSS feeds.

### Duplicate protection

The Worker stores accepted and rejected review decisions so the same article is not sent to OpenAI repeatedly.

### Source-friendly links

NutsNews does not republish full copyrighted articles. It links readers back to the original publisher.

### Scalable sharding

The platform can split feeds across many Cloudflare Worker shards.

For example:

```text
500 RSS feeds ÷ 20 feeds per Worker = 25 Worker shards
```

### Controller Worker

A single controller Worker can trigger one shard at a time, reducing the need to maintain many separate cron schedules.

### External uptime monitoring

NutsNews has been onboarded to Better Stack Uptime for continuous external availability monitoring of the live website.

The monitoring setup helps verify that the public site is reachable and provides visibility into uptime, downtime, and incident history.

---

## Architecture

### Current platform architecture

```text
Content Sources
BBC / NPR / Positive News / Good News Network / Google News RSS / Other RSS Feeds
  ↓
Automation Layer
Cloudflare Workers fetch and parse RSS feeds
  ↓
Filtering Layer
Local negative prefilter removes obvious unsuitable stories
  ↓
AI Curation Layer
OpenAI filters, classifies, scores, and summarizes article candidates
  ↓
Data Layer
Supabase Postgres stores review records and approved articles
  ↓
Presentation Layer
Next.js renders the public NutsNews website
  ↓
Observability Layer
Better Stack Uptime monitors public site availability
  ↓
Distribution
Readers click through to original publishers
```

### Main components

| Component           | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `web`               | Public Next.js website                                                      |
| `worker`            | RSS ingestion and article review pipeline                                   |
| `controller`        | Optional controller Worker for triggering Worker shards                     |
| `supabase`          | Database schema and data storage                                            |
| GitHub              | Source control                                                              |
| Vercel              | Frontend deployment                                                         |
| Cloudflare Workers  | Scheduled or manually-triggered backend automation                          |
| OpenAI              | AI article classification and summary generation                            |
| Better Stack Uptime | External uptime monitoring, availability reporting, and incident visibility |

---

## Repository Structure

```text
nutsnews/
├── web/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── about/
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   └── articles/
│   │   │       └── route.ts
│   │   └── components/
│   │       ├── ArticleFeed.tsx
│   │       └── SiteFooter.tsx
│   └── lib/
│       └── articles.ts
│
├── worker/
│   ├── src/
│   │   └── index.ts
│   ├── scripts/
│   │   └── generate-wrangler-config.mjs
│   ├── generated-wrangler/
│   │   └── wrangler.shard*.jsonc
│   └── package.json
│
├── controller/
│   ├── src/
│   │   └── index.ts
│   ├── wrangler.jsonc
│   └── package.json
│
├── supabase/
│   └── database scripts and migrations
│
├── LICENSE
└── README.md
```

Some deployed Worker/controller files may exist locally before being pushed to GitHub.

The intended long-term structure keeps shared logic in one codebase and uses configuration for scaling.

---

## Frontend Web App

The `web` app is the public NutsNews website. It is built with Next.js and designed around a mobile-first article feed.

### Responsibilities

* Load published articles from Supabase
* Load available categories
* Render the homepage
* Render the About page
* Support category filtering
* Support infinite scrolling
* Show generated fallback thumbnails when articles do not include images
* Link every story to the original publisher
* Provide SEO metadata and structured data
* Serve the public website monitored by Better Stack Uptime

### Important files

| File                                 | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `web/app/page.tsx`                   | Homepage and initial article loading |
| `web/app/about/page.tsx`             | Project About page                   |
| `web/app/components/ArticleFeed.tsx` | Interactive story feed component     |
| `web/app/api/articles/route.ts`      | Paginated article API                |
| `web/lib/articles.ts`                | Supabase data helpers                |

The homepage is configured for dynamic rendering so new articles can appear without waiting for a static rebuild.

---

## RSS Ingestion Worker

The ingestion Worker is responsible for discovering, filtering, reviewing, and saving articles.

### Main workflow

```text
Fetch RSS feeds
  ↓
Parse RSS or Atom XML
  ↓
Extract title, URL, excerpt, date, and image
  ↓
Normalize article URLs
  ↓
Remove duplicate URLs
  ↓
Score candidates
  ↓
Check previously reviewed URLs
  ↓
Apply local hard-negative filter
  ↓
Send eligible articles to OpenAI
  ↓
Save all review decisions
  ↓
Publish accepted articles
```

### Article metadata extracted from feeds

The Worker attempts to extract:

* Source name
* Article title
* Original URL
* Excerpt or description
* Published date
* RSS image or thumbnail URL

### URL normalization

The Worker removes common tracking parameters such as:

* `utm_source`
* `utm_medium`
* `utm_campaign`
* `utm_content`
* `fbclid`
* `gclid`
* `mc_cid`
* `mc_eid`

This helps reduce duplicate reviews and duplicate article rows.

---

## Sharded Worker Design

The platform is designed to scale across hundreds of RSS feeds.

Instead of one Worker trying to read every feed, RSS sources can be split into shards.

Example:

```text
500 feeds
20 feeds per shard
25 Worker shards
```

Each shard runs the same code.

Only these variables change:

```text
FEED_SHARD_INDEX
FEEDS_PER_SHARD
```

### Shard math

```text
offset = FEED_SHARD_INDEX × FEEDS_PER_SHARD
limit = FEEDS_PER_SHARD
```

Examples:

```text
shard 0  → feeds 1–20
shard 1  → feeds 21–40
shard 2  → feeds 41–60
shard 17 → feeds 341–360
shard 24 → feeds 481–500
```

### Why this design matters

This allows the platform to:

* Add more RSS feeds without changing core Worker logic
* Avoid overloading a single Worker invocation
* Stay closer to free-tier limits
* Keep process updates centralized
* Deploy the same source code across many Worker instances

---

## Controller Worker

The controller Worker is an optional orchestration layer.

Instead of giving every shard its own cron trigger, the controller can run on a schedule and call one shard per run.

### Controller flow

```text
Controller receives request or scheduled event
  ↓
Determines which shard should run
  ↓
Builds shard URL
  ↓
Calls nutsnews-worker-{index}.workers.dev
  ↓
Returns or logs the shard result
```

### Example controller URL

```text
https://nutsnews-controller.nutsnews.workers.dev/
```

### Manual shard test

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=17"
```

### Automatic shard selection

Automatic mode selects a shard based on time:

```text
shardIndex = floor(currentTime / interval) % shardCount
```

With 25 shards and a 5-minute interval:

```text
25 shards × 5 minutes = each shard runs about every 125 minutes
```

### Worker-to-Worker fetch

When the controller calls public `workers.dev` shard URLs from another Worker, the controller may need the Cloudflare compatibility flag:

```jsonc
"compatibility_flags": ["global_fetch_strictly_public"]
```

---

## Database Design

NutsNews uses Supabase Postgres.

### `rss_feeds`

Stores RSS feed configuration.

Suggested schema:

```sql
create table if not exists rss_feeds (
  id bigserial primary key,
  source text not null,
  url text not null unique,
  is_active boolean not null default true,
  is_positive_source boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rss_feeds_active_id_idx
on rss_feeds (is_active, id);
```

Purpose:

* Store RSS feeds outside source code
* Add feeds without redeploying Worker code
* Disable feeds without deleting them
* Mark known positive sources
* Support shard loading with `limit` and `offset`

### `article_ai_reviews`

Stores every article review decision.

Common fields:

* `original_url`
* `source`
* `title`
* `decision`
* `category`
* `positivity_score`
* `summary`
* `reason`
* `reviewed_at`

Purpose:

* Avoid repeated OpenAI calls for the same article
* Track accepted and rejected articles
* Support debugging and quality review
* Reduce AI cost over time

### `articles`

Stores accepted stories shown on the public site.

Common fields:

* `source`
* `title`
* `original_url`
* `image_url`
* `published_at`
* `published_on_site_at`
* `original_excerpt`
* `ai_summary`
* `category`
* `positivity_score`
* `status`

Purpose:

* Power the public article feed
* Keep published story records separate from rejected reviews
* Store short summaries rather than full article text
* Link readers back to the original source

---

## AI Curation Workflow

OpenAI is used as the editorial filter and summary generator.

For each eligible article, the AI returns:

```json
{
  "decision": "accept or reject",
  "category": "Community | Wellness | Science | Culture | Animals | Travel | Lifestyle | Achievement | Uplifting | Nature | Space | Creativity",
  "positivity_score": 1,
  "summary": "A calm 2-3 sentence summary.",
  "reason": "Short reason for the decision."
}
```

### Accepted story types

The prompt accepts stories about:

* Positive human-interest moments
* Wellness and lifestyle
* Science
* Culture
* Animals
* Travel
* Community
* Nature
* Space
* Creativity
* Remarkable achievements

### Rejected story types

The prompt rejects stories involving:

* Politics
* War
* Money
* Crime
* Tragedy
* Fear
* Conflict
* Elections
* Government
* Markets
* Inflation
* Business
* Stocks
* Military
* Violence

### Local negative prefilter

Before using OpenAI, the Worker can locally reject obviously negative stories.

This protects cost and reduces unnecessary AI calls. Broad sources such as NPR, BBC, and Google News RSS feeds can be filtered more strictly than positive-first sources.

---

## Source-Friendly Publishing

NutsNews does not republish full copyrighted articles.

The site stores and displays:

* Original title
* Source name
* Source link
* Article metadata
* Short AI-written summary
* Category
* Positivity score

Every card links back to the original publisher.

The summary is intended to be brief, original, and not a replacement for the full article.

---

## Tech Stack

The About page describes the current stack as:

| Technology            | Role                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| Next.js               | Mobile-friendly website and article feed                                          |
| GitHub → Vercel CI/CD | Every push to `main` triggers an automatic Vercel build and production deployment |
| Vercel                | Frontend hosting, HTTPS, custom domain, and production deployment                 |
| Supabase              | Postgres database for article storage                                             |
| Cloudflare Workers    | Scheduled RSS ingestion and automation                                            |
| OpenAI                | Article filtering and cheerful summary generation                                 |
| Better Stack Uptime   | Continuous external uptime monitoring and availability reporting                  |
| RSS Feeds             | Story sources from trusted publishers                                             |

---

## CI/CD and Deployment

### Website deployment

The web app is deployed through GitHub and Vercel.

Deployment flow:

```text
1. Code commit
   Changes are committed locally and pushed to GitHub on the main branch.

2. Vercel build
   Vercel detects the push, installs dependencies, runs the Next.js build,
   and prepares production deployment.

3. Production release
   If the build succeeds, Vercel automatically publishes the latest version
   to the production NutsNews domain.

4. External monitoring
   Better Stack Uptime continuously monitors the live site after deployment.
```

### Worker deployment

For shard Workers:

```bash
cd worker
npm install
npm run generate:wrangler
npm run deploy:all
```

For the controller Worker:

```bash
cd controller
npm install
npm run deploy
```

---

## Environment Variables and Secrets

### Web app

Typical frontend environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Depending on implementation, server-side Supabase variables may also be used.

### Worker shards

Worker shards need:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
FEED_SHARD_INDEX
FEEDS_PER_SHARD
```

If using Cloudflare Secrets Store, secret values are read asynchronously:

```ts
const supabaseUrl = await env.SUPABASE_URL.get();
const supabaseServiceRoleKey = await env.SUPABASE_SERVICE_ROLE_KEY.get();
const openAiApiKey = await env.OPENAI_API_KEY.get();
```

### Controller Worker

The controller Worker uses non-secret environment variables:

```text
SHARD_COUNT=25
SHARD_RUN_INTERVAL_MINUTES=5
SHARD_WORKER_PREFIX=nutsnews-worker
SHARD_WORKER_SUBDOMAIN=nutsnews
MAX_AI_REVIEWS_PER_SHARD=12
```

### Better Stack Uptime

Better Stack Uptime is configured outside this repository.

It monitors the live public site from Better Stack's external monitoring infrastructure and does not require application secrets in this codebase.

---

## Local Development

### Web app

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

### Worker

```bash
cd worker
npm install
npm run dev
```

Generate shard configs:

```bash
npm run generate:wrangler
```

Deploy all shards:

```bash
npm run deploy:all
```

### Controller

```bash
cd controller
npm install
npm run dev
```

Deploy:

```bash
npm run deploy
```

---

## Operations, Monitoring, and Observability

NutsNews uses operational checks across the website, Worker automation, database, and external uptime monitoring.

### External uptime monitoring

The public NutsNews website has been onboarded to Better Stack Uptime.

Better Stack Uptime is used to:

* Continuously monitor whether the public site is reachable
* Detect downtime or failed availability checks
* Provide uptime and incident history
* Support operational reporting
* Give early visibility when the live site is unavailable

Primary monitored site:

```text
https://nutsnew.com
```

Optional monitors that can be added as the platform grows:

```text
https://www.nutsnew.com
https://nutsnews-controller.nutsnews.workers.dev/
https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1
```

### Why observability matters

The monitoring setup helps support the long-term goal of high availability by making outages visible quickly.

Monitoring does not by itself guarantee five nines availability, but it is a required foundation for operating a reliable production service.

### Test one shard

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

### Test a specific shard through the controller

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=17"
```

### Test automatic controller mode

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/"
```

### Check recent review volume

```sql
select
  count(*) as reviews_last_hour
from article_ai_reviews
where reviewed_at > now() - interval '1 hour';
```

### Check recent published articles

```sql
select
  title,
  source,
  category,
  positivity_score,
  published_on_site_at
from articles
where published_on_site_at > now() - interval '1 day'
order by published_on_site_at desc;
```

### Check accepted vs rejected decisions

```sql
select
  source,
  decision,
  count(*) as count
from article_ai_reviews
where reviewed_at > now() - interval '1 hour'
group by source, decision
order by count desc;
```

### Add a new RSS feed

```sql
insert into rss_feeds (source, url, is_positive_source)
values ('Example Source', 'https://example.com/feed.xml', false)
on conflict (url)
do update set
  source = excluded.source,
  is_positive_source = excluded.is_positive_source,
  is_active = true;
```

### Disable a feed

```sql
update rss_feeds
set is_active = false
where url = 'https://example.com/feed.xml';
```

---

## Current Cost Model

The About page lists the current cost model as:

| Item                |     Cost | Notes                                                               |
| ------------------- | -------: | ------------------------------------------------------------------- |
| Domain              | `$11.95` | The only paid cost so far is the NutsNews domain registration       |
| Vercel              |     `$0` | The Next.js website is hosted on the Vercel free tier               |
| Supabase            |     `$0` | Article storage uses the Supabase free tier                         |
| Cloudflare Workers  |     `$0` | Scheduled RSS automation runs on the Cloudflare free tier           |
| Better Stack Uptime |     `$0` | Site availability monitoring uses the Better Stack Uptime free tier |

**Total current fixed cost:** `$11.95`

Everything except the domain is currently intended to run on free-tier services.

OpenAI cost is variable and depends on the number of article reviews sent to the API.

---

## Project Benefits

### Fully automated news agency

The platform can discover, filter, summarize, store, and publish stories automatically without a traditional editorial production team.

### Low operating cost

Using free-tier cloud services keeps the project inexpensive to launch and easy to experiment with.

### Always-fresh content

Scheduled or controller-triggered automation refreshes the article queue throughout the day.

### Better production visibility

Better Stack Uptime provides external uptime monitoring so the project owner can see when the public website is available or unavailable.

### Focused editorial voice

AI filtering helps keep the product aligned with a peaceful, uplifting, and positive content strategy.

### Mobile-first experience

The site is designed around a simple scrolling feed that feels natural on phones.

### Scalable architecture

The system separates the frontend, database, AI workflow, controller, and Worker shards so each part can grow independently.

### Fast experimentation

New RSS sources, categories, prompts, and layout ideas can be tested quickly without rebuilding the whole platform.

### Source-friendly publishing

The site avoids republishing full articles and links readers back to the original publishers.

---

## Roadmap

Potential improvements:

* Add a shared controller token so only the controller can trigger shard Workers
* Add feed health tracking in Supabase
* Track failed feed fetches by source
* Add a dedicated `/health` endpoint for the website
* Add controller and shard health endpoints
* Add Better Stack monitors for the controller Worker and selected shard Workers
* Add uptime/status link to the website footer or About page
* Build an admin dashboard for RSS feed management
* Add manual review for borderline articles
* Improve duplicate detection across syndicated stories
* Improve Google News RSS handling and fallback behavior
* Add source reliability scoring
* Add per-source AI review caps
* Add automatic backoff for blocked or failing feeds
* Add richer generated fallback thumbnails
* Add Open Graph image generation
* Add newsletter support
* Add category analytics
* Add article-level engagement analytics
* Add a moderation queue for future editorial control

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

---

## Status

NutsNews is an active experimental platform for automated uplifting-news discovery, AI-assisted editorial filtering, mobile-first publishing, and externally monitored site availability.
