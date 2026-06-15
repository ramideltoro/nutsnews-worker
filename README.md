# NutsNews

**A calm, mobile-first positive news platform powered by automation, AI curation, serverless infrastructure, CDN caching, centralized observability, and a private admin portal.**

NutsNews collects uplifting stories from trusted RSS feeds, filters out stressful topics, creates short cheerful summaries, and links readers back to the original publishers.

The project is designed to be simple to use, inexpensive to operate, easy to maintain, and scalable enough to grow from a small experiment into a fully automated positive-news platform.

---

## Project Snapshot

| Area               | Highlight                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Product            | Mobile-first positive news feed                                                                                |
| Mission            | Give readers a calmer alternative to stressful news                                                            |
| Content model      | RSS discovery, AI-assisted filtering, short summaries, source links                                            |
| Social previews    | Dynamic Open Graph images for the homepage and article pages                                                   |
| Frontend           | Next.js website hosted on Vercel with a mostly server-rendered public homepage                                 |
| Automation         | Cloudflare Workers process RSS feeds                                                                           |
| AI                 | OpenAI classifies, scores, and summarizes candidate articles                                                   |
| Database           | Supabase Postgres stores articles, review history, feeds, and operational data                                 |
| Admin Portal       | Private Google-protected admin area for internal dashboards                                                    |
| AI Usage Dashboard | Admin dashboard for exact OpenAI usage, token tracking, cost, accepted reviews, rejected reviews, and spike warnings |
| Worker Health Dashboard | Admin dashboard for Worker shard health, failed executions, latest errors, stale shards, and consecutive failures |
| Partial Failure Handling | Worker runs continue when individual RSS feeds, OpenAI calls, or Supabase saves fail safely |
| Lightweight Homepage | Public feed, category filters, article cards, and pagination render on the server to reduce client-side JavaScript |
| Failed Run Tracking | Dedicated Worker run table stores successful and failed shard executions |
| CDN                | Cloudflare caches public pages and API responses                                                               |
| Logging            | Better Stack centralizes structured logs                                                                       |
| Monitoring         | Sentry tracks application errors; Better Stack tracks uptime                                                   |
| Cost model         | Designed around free-tier cloud services, with OpenAI as the main usage-based cost                             |

---

## The Story Behind NutsNews

Most news products are built around urgency.

They compete for attention with conflict, fear, politics, money, and breaking events.

NutsNews takes a different direction.

The goal is to create a peaceful place where readers can quickly find stories that feel encouraging, warm, interesting, and human. Instead of replacing publishers, NutsNews helps readers discover positive stories and then sends them back to the original source.

A reader should be able to open NutsNews and immediately understand the feeling of the product:

> “Here is something good happening in the world.”

That product idea drives the technical design.

The platform is built to automatically discover articles, filter them, summarize them, publish them, cache them, monitor them, log what happened, and expose private operational dashboards — all while staying inexpensive and easy to extend.

---

## Open Graph Image Generation

NutsNews includes branded Open Graph image generation for social sharing.

The homepage has a dynamic social preview image at:

```text
/opengraph-image
```

Each article page also has a dynamic social preview image at:

```text
/articles/[id]/opengraph-image
```

The generated images use the NutsNews dark-and-amber visual system and are sized for large social previews:

```text
1200 × 630
```

Homepage previews include:

* NutsNews branding
* Product tagline
* Positive-news positioning
* Amber visual treatment

Article previews include:

* Article title
* Article summary
* Source name
* Category badge when available
* NutsNews branding

This helps shared links look cleaner on platforms that read Open Graph and Twitter card metadata.

---

## Mission

NutsNews exists to make positive stories easier to find.

The platform focuses on stories about:

* Community
* Wellness
* Science
* Culture
* Animals
* Travel
* Lifestyle
* Nature
* Space
* Creativity
* Human achievement
* Inspiring people
* Helpful discoveries
* Remarkable moments

The goal is not to become a traditional newsroom.

The goal is to become a fully automated positive-news discovery layer that helps readers find uplifting stories from around the web.

---

## What NutsNews Avoids

NutsNews intentionally avoids content that creates stress or conflict.

The platform is designed to filter out stories mainly focused on:

* Politics
* War
* Crime
* Tragedy
* Violence
* Fear
* Market panic
* Financial stress
* Election conflict
* Government conflict
* Outrage-driven news

This editorial direction keeps the product focused and gives the site a clear identity.

---

## Product Experience

NutsNews is designed for quick mobile reading.

Each story card gives the reader:

* A clear title
* A short cheerful summary
* A source label
* A published date
* Category badges
* A story image or fallback visual
* A link to the original publisher

The reading experience is intentionally simple. The homepage behaves like a calm feed of uplifting stories rather than a noisy news portal.

---

## Lightweight Homepage Rendering

The public homepage is intentionally kept lightweight.

The story feed, category filter, article cards, and page navigation are rendered on the server instead of being controlled by a large client-side React component.

This reduces unnecessary browser JavaScript while keeping the mobile experience simple and readable.

The homepage now uses:

* Server-rendered article cards
* Server-rendered category links
* URL-based category filtering
* URL-based older/newer pagination
* Native HTML disclosure behavior for the filter menu
* No homepage infinite-scroll client state
* No extra frontend libraries

Examples:

```text
/
/?category=Science
/?category=Community&page=1
```

This supports issue #10 by keeping static and mostly static content on the server, avoiding unnecessary client-side state, and preserving CDN-friendly public pages.

---

## Admin Portal

NutsNews includes a private admin portal that acts as the internal control center for operating the platform.

The admin portal lives at:

```text
/admin
```

It is designed to behave like an internal homepage for the operator. Instead of placing every dashboard directly on one page, `/admin` acts as a landing page that links to focused admin dashboards.

Current admin structure:

```text
/admin
  Admin home and dashboard directory

/admin/ai-usage
  AI usage and estimated OpenAI cost dashboard

/admin/shards
  Worker health, failed shard executions, stale shard detection, and latest errors

/admin/login
  Google login page

/admin/access-denied
  Access denied page for unauthorized Google accounts
```

The admin portal is protected by Google login and an approved email allowlist.

Only the configured admin Google account can access protected admin pages. Unauthorized accounts are redirected to an access denied page.

This gives NutsNews a safer foundation for future operational controls such as:

* AI usage monitoring
* Worker shard monitoring
* RSS feed management
* Article review tools
* Backup status
* Manual refresh controls
* Pause or maintenance controls
* Operational health dashboards

The admin portal is intentionally being built in phases. It starts with read-only dashboards before adding more powerful write controls.

---

## AI Usage Dashboard

One admin dashboard is the AI Usage dashboard.

It lives at:

```text
/admin/ai-usage
/admin/shards
/admin/feed-health
```

The goal of this dashboard is to make OpenAI usage visible and reduce the risk of surprise AI spend.

The dashboard shows:

* Exact OpenAI prompt tokens
* Exact OpenAI completion tokens
* Exact total tokens
* Estimated OpenAI cost per Worker run
* OpenAI call count
* Accepted AI-reviewed articles
* Rejected AI-reviewed articles
* Cost protection hits
* Spike warning status
* Daily usage trend
* Shard usage
* Latest Worker AI usage runs

This is important because OpenAI is the main usage-based cost in the platform.

The dashboard reads saved Worker usage rows from Supabase. This makes AI usage visible by run and by shard, rather than relying only on rough review-history estimates.

The Worker saves run-level usage metrics such as:

* Shard index
* OpenAI model
* Prompt tokens
* Completion tokens
* Total tokens
* Estimated cost per run
* AI reviewed count
* Accepted count
* Rejected count
* Cost protection limit hits

---

## Worker Shard Health Dashboard

The Worker Shard Health dashboard lives at:

```text
/admin/shards
```

The goal of this dashboard is to show whether Worker ingestion is healthy across all Cloudflare Worker shards.

The dashboard shows:

* Fleet health
* Worker ingestion summary
* Feed fetch success and failure counts
* Failed RSS feed details
* Worker error counts
* Failed shards
* Failed Worker runs
* Latest failure time
* Latest error message
* Consecutive failure counts
* Stale shards
* Missing shards
* No-feed shards
* Warning shards
* Accepted and rejected counts
* No-thumbnail rejection counts
* Image hydration lookup and found counts
* Duration by shard
* Recent Worker execution rows

The admin portal also includes an RSS Feed Health dashboard for source quality, repeated feed failures, thumbnail coverage, accepted output, and Supabase disable actions.

The dashboard uses a dedicated `worker_runs` table. Successful Worker executions and failed Worker executions are saved as first-class run records.

This makes the dashboard able to distinguish between:

* Healthy shards
* Warning shards
* Failed shards
* Stale shards
* No-feed shards
* Missing shards

A failed run stores:

* `success = false`
* `error_name`
* `error_message`
* `run_source`
* `request_id`
* `shard_index`
* `duration_ms`

This allows the operator to see exactly which shard failed, what the latest error was, and how many times the shard has failed consecutively.

---

## Worker Retry and Partial Failure Behavior

The Worker is designed to complete a useful run even when some external services fail.

This matters because RSS feeds, publisher websites, OpenAI, Supabase, and log delivery are all external dependencies. A temporary problem in one dependency should not automatically stop the whole refresh cycle.

The Worker now handles partial failures in several places:

* A single RSS feed failure does not fail the full Worker run.
* Failed RSS feeds are reported in `failedFeeds`.
* Failed feed error bodies are truncated before being returned or logged, so a publisher HTML error page does not hide the rest of the Worker logs.
* Article-page image hydration is capped conservatively to keep the Worker below Cloudflare subrequest limits.
* Accepted article rows are saved before review-history rows so newly accepted stories have the best chance of reaching the public site first.
* High-volume RSS failure events stay visible in Worker tail logs but are not forwarded to Better Stack on every run, reducing subrequests.
* The Worker response includes `feedFetchSuccessCount`.
* The Worker response includes `feedFetchFailureCount`.
* OpenAI request failures become safe article rejections.
* OpenAI invalid responses become safe article rejections.
* Unexpected OpenAI review errors are converted to safe rejections.
* Supabase lookup failures are logged and the run continues with an empty reviewed URL set.
* Supabase save failures are logged clearly and returned as `false` status flags.
* Better Stack delivery failures are isolated from the Worker run.

Example Worker response when some feeds fail:

```json
{
  "message": "NutsNews refresh complete",
  "feedCount": 20,
  "feedFetchSuccessCount": 17,
  "feedFetchFailureCount": 3,
  "failedFeeds": [
    {
      "source": "Good News Network Good Earth",
      "url": "https://www.goodnewsnetwork.org/category/news/good-earth/feed/",
      "status": 404,
      "errorMessage": "Page not found"
    }
  ]
}
```

This makes the Worker more resilient because the operator can see exactly what failed while the run still completes and saves whatever useful work it can.

The next small cleanup is to truncate very large failed-feed error bodies so full HTML error pages do not make logs or manual curl responses noisy.


---

## RSS Feed Health Tracking

NutsNews now tracks RSS feed quality over time in Supabase and exposes it through a protected admin dashboard at:

```text
/admin/feed-health
```

This feature is designed for source quality management. The platform can now show which feeds are reliable, which feeds repeatedly fail, which feeds produce thumbnails, which feeds produce accepted articles, and which feeds should be disabled.

### What the Worker records

Every Worker run saves one feed health row per RSS feed in the current shard.

The `feed_health` table tracks:

* Feed source name
* Feed URL
* Last checked time
* Last successful fetch time
* Last failed fetch time
* Latest HTTP status
* Latest error message
* Latest article count
* Latest image count
* Latest accepted count
* Latest rejected count
* Consecutive failure count
* Total fetch count
* Total success count
* Total failure count
* Total article count
* Total image count
* Total accepted count
* Total rejected count

The Worker still saves accepted articles before review history and feed health rows, so accepted stories continue to have priority when Cloudflare subrequest limits are tight.

### Admin dashboard

The RSS Feed Health dashboard shows:

* Total feeds
* Active feeds
* Disabled feeds
* Weak feeds
* Best feeds
* Success rate
* Image rate
* Accepted article count
* Repeated failure count
* Last checked time
* Last success time
* Last failure time
* Last HTTP status
* Latest feed error message
* A full feed health table
* A Supabase SQL snippet to disable weak feeds without a code deploy

Dashboard route:

```text
/admin/feed-health
```

### Supabase views

The migration also creates two operational views:

```sql
select * from public.bad_feeds;
```

Use this to find weak feeds that repeatedly fail, produce no articles, or produce poor thumbnail coverage.

```sql
select * from public.best_feeds;
```

Use this to find feeds that produce the most accepted articles with good reliability and image coverage.

### Disable weak feeds without code changes

The Worker already selects only active feeds:

```sql
select *
from public.rss_feeds
where is_active = true;
```

To disable weak feeds, update Supabase data instead of changing Worker code:

```sql
update public.rss_feeds
set is_active = false
where url in (
  select feed_url
  from public.bad_feeds
  limit 25
);
```

This satisfies the RSS quality workflow: observe feed health, identify weak feeds, disable bad sources, and prioritize sources that actually produce usable uplifting stories.

---

## Architecture Overview

NutsNews uses a serverless architecture. Each part of the system has a focused role.

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

The admin and operations flow runs alongside the public product:

```text
Supabase Review Data
Worker Activity
Worker Run Success and Failure Records
AI Usage Metrics
Shard Health Metrics
Operational Signals
  ↓
Private Admin Portal
  ↓
Admin Dashboards
  ↓
Operator Visibility
```

The observability flow runs beside the product flow:

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
Worker Errors
Runtime Failures
  ↓
Sentry
```

This keeps the platform lightweight while still giving visibility into what is happening.

---

## Key Design Principles

### 1. Keep the reader experience calm

The website is mobile-first, visually simple, and focused on one job: showing uplifting stories.

### 2. Keep the system automated

The platform automatically discovers, reviews, stores, and publishes stories with minimal manual work.

### 3. Keep operating costs low

The project is built around free or low-cost cloud services. AI usage is monitored because it is the main variable cost.

### 4. Keep the architecture modular

The frontend, database, AI workflow, Workers, controller, logging, monitoring, and admin portal are separated so each layer can improve independently.

### 5. Keep publishers respected

NutsNews does not republish full articles. It uses short summaries and sends readers to the original publishers.

### 6. Keep the system observable

Centralized logs, uptime monitoring, CDN visibility, error tracking, and admin dashboards make it easier to understand the health of the platform.

### 7. Keep admin controls protected

Admin dashboards and future controls are protected behind Google login and an approved email allowlist.

---

## Performance Highlights

Performance is handled at several layers.

### Reduced client-side JavaScript

The public homepage avoids shipping a large feed component to the browser.

Article cards, category filters, and pagination are server-rendered. The browser receives ready-to-read HTML for the feed, while navigation happens through normal links that Vercel and Cloudflare can cache.

This keeps the mobile frontend lighter and makes the homepage easier to reason about during Lighthouse testing.

### Cloudflare CDN

Cloudflare sits in front of the public site and caches eligible public pages and API responses.

This helps:

* Reduce repeated hits to Vercel
* Improve repeat response speed
* Lower origin load
* Handle traffic spikes better
* Serve common requests from the edge

### Cache-friendly frontend

The public pages and article API are configured with cache-friendly headers.

Important public routes include:

* Homepage
* About page
* Article pages
* Public article API

The homepage and API can stay fresh while still allowing short-term CDN caching.

### Vercel edge delivery

The Next.js app runs on Vercel, which provides fast global delivery for the frontend.

### Smaller server workload

Because Cloudflare can return cached responses, the application does not need to recompute or reload the same public feed for every visitor.

---

## Resiliency Highlights

NutsNews is designed so one failure does not bring down the whole system.

### Serverless infrastructure

The system avoids traditional always-on servers. The website, automation, and controller are deployed on managed serverless platforms.

### Worker sharding

RSS processing can be split across many Cloudflare Worker shards.

Instead of one Worker trying to process every feed, the work is divided.

Example:

```text
500 RSS feeds
20 feeds per shard
25 Worker shards
```

This makes the system easier to scale and reduces the chance that one large workload overwhelms a single Worker.

### Partial RSS feed failure isolation

A failed RSS feed no longer blocks the entire Worker run.

The Worker records how many feeds succeeded, how many feeds failed, and which feed URLs failed. This keeps the ingestion pipeline moving even when one publisher changes or breaks an RSS endpoint.

### Safe OpenAI failure handling

OpenAI failures are treated as safe article rejections instead of Worker crashes.

If OpenAI returns a non-OK response, an empty response, invalid JSON, or an unexpected request exception, the article is rejected with a clear reason and the run continues.

### Clear Supabase save failure logging

Supabase save failures are logged clearly and returned as status flags, such as `reviewSaveOk`, `articleSaveOk`, `aiUsageSaveOk`, and `workerRunSaveOk`.

This makes it easier to tell whether the Worker completed processing but failed to save a specific output.

### Controller Worker

A controller Worker can trigger one shard at a time.

This allows the system to spread work across time instead of running every shard at once.

### Duplicate review protection

NutsNews stores article review history.

That means previously reviewed stories do not need to be sent back to OpenAI repeatedly.

This improves reliability and reduces cost.

### Rejected article tracking

Rejected stories are also tracked.

This prevents the system from spending money and compute reviewing the same bad-fit article over and over.

### Local filtering before AI

The Worker applies local filters before sending articles to OpenAI.

This reduces unnecessary AI usage and helps keep costs under control.

### Admin visibility

The admin portal gives the operator a private place to view usage and operational health without relying only on external tools.

### External uptime monitoring

Better Stack Uptime checks whether the public site is reachable from outside the platform.

### Application error monitoring

Sentry tracks frontend, runtime, and Worker errors so failures can be investigated quickly.

### Structured centralized logs

Better Stack logs provide a searchable record of what the web app, Worker shards, and controller are doing.

---

## Cost Highlights

NutsNews is intentionally designed to be inexpensive to run.

The architecture uses free-tier or low-cost services where possible.

| Service             | Role                                       | Cost Goal         |
| ------------------- | ------------------------------------------ | ----------------- |
| Vercel              | Hosts the Next.js website and admin portal | Free tier         |
| Cloudflare CDN      | DNS, cache, and edge protection            | Free tier         |
| Cloudflare Workers  | RSS automation and controller              | Free tier         |
| Supabase            | Postgres database                          | Free tier         |
| Better Stack Uptime | External uptime monitoring                 | Free tier         |
| Better Stack Logs   | Centralized structured logs                | Free tier         |
| Sentry              | Error monitoring                           | Free tier         |
| GitHub              | Repository, issues, and version history    | Free              |
| OpenAI              | AI review and summaries                    | Usage-based       |
| Domain              | Public site domain                         | Fixed yearly cost |

The current fixed cost is designed to stay very low, with the domain as the main predictable expense.

OpenAI is the main variable cost, so the system includes several protections:

* Local filtering before AI
* Duplicate URL detection
* Accepted article review caching
* Rejected article review caching
* Shard-level review limits
* Batch database operations
* Admin AI usage dashboard
* Estimated OpenAI cost visibility

These choices help keep the platform affordable even as the number of RSS feeds grows.

---

## Maintenance Highlights

NutsNews is structured so the system can be maintained without constantly changing core code.

### RSS feeds live in the database

RSS feed configuration can be stored in Supabase.

This makes it possible to add, disable, or adjust feeds without rewriting the ingestion engine.

### Worker shards share one codebase

Each Worker shard runs the same source code.

Only the shard configuration changes.

This keeps the automation easier to maintain because improvements can be made once and deployed across all shards.

### Generated Worker configs

Shard Wrangler configs are generated from a script.

This avoids manually maintaining many nearly identical Cloudflare Worker configuration files.

### Secrets are centralized

Worker secrets can be stored in Cloudflare Secrets Store.

This allows the same secret values to be reused across many Worker shards without manually copying them into each Worker.

### Admin pages are organized by dashboard

The admin portal is structured so `/admin` is the landing page and each dashboard has its own route.

Example:

```text
/admin
/admin/ai-usage
/admin/shards
/admin/feed-health
```

Future dashboards can follow the same structure.

### Logs are structured

Structured logs make maintenance easier because events can be searched by known fields like:

* `service`
* `level`
* `event`
* `shardIndex`
* `durationMs`
* `status`
* `acceptedCount`
* `rejectedCount`

This is much easier to search than plain text logs.

### Monitoring is layered

NutsNews uses multiple observability layers:

* Admin Portal for private internal dashboards
* AI Usage dashboard for estimated OpenAI usage and cost
* Better Stack Uptime for availability
* Better Stack Logs for centralized activity logs
* Sentry for application errors
* Cloudflare for CDN and Worker visibility
* Vercel for deployment visibility
* Supabase for database visibility

Each tool answers a different operational question.

---

## Extendability Highlights

The project is built to grow gradually.

### Add more RSS feeds

The platform can expand by adding more sources.

As the source list grows, feeds can be spread across additional Worker shards.

### Add more categories

The AI classification workflow can support new editorial categories over time.

Possible future categories include:

* Good deeds
* Education
* Family
* Local heroes
* Environment
* Health breakthroughs
* Arts and creativity

### Add newsletters

The same article data can power a daily or weekly positive-news email digest.

### Add topic pages

Categories can become landing pages for readers who prefer specific types of uplifting stories.

### Add personalization

Future versions could allow readers to prefer topics like animals, science, travel, or wellness.

### Add social publishing

Approved stories could be repurposed into short posts for social channels.

### Add admin dashboards

The admin portal creates a foundation for future dashboards such as:

* Worker shard health
* RSS feed health dashboard
* Article review activity
* Source quality scoring
* Backup status
* Deployment status
* Error trends
* Cache status
* Manual operational controls

### Add multi-language support

The platform could eventually translate summaries or support uplifting stories from other regions.

The important point is that the current architecture does not lock the project into one narrow use case. It creates a foundation.

---

## Tech Stack

### Frontend

| Technology   | Purpose                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| Next.js      | Public website, article pages, admin portal, and server-rendered dashboards |
| React        | Interactive feed and admin UI                                               |
| TypeScript   | Safer application code                                                      |
| Tailwind CSS | Mobile-first styling                                                        |
| Vercel       | Frontend and admin hosting                                                  |

### Authentication and Admin Access

| Technology               | Purpose                                                |
| ------------------------ | ------------------------------------------------------ |
| Auth.js / NextAuth       | Google login for the admin portal                      |
| Google OAuth             | Admin sign-in provider                                 |
| Admin email allowlist    | Restricts admin access to approved Google accounts     |
| Server-side admin routes | Keeps private data and service keys out of the browser |

### Automation

| Technology               | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| Cloudflare Workers       | RSS ingestion and automation             |
| Cloudflare Worker Shards | Split RSS processing across many workers |
| Controller Worker        | Coordinates shard execution              |
| Wrangler                 | Worker deployment and configuration      |
| Cloudflare Secrets Store | Shared secrets for Worker shards         |

### Data

| Technology                | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| Supabase                  | Hosted Postgres database                            |
| Postgres                  | Article, feed, review, and operational data storage |
| Supabase REST API         | Worker-to-database communication                    |
| Supabase service role key | Server-side admin dashboard data access             |

### AI

| Technology         | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| OpenAI             | Article filtering, scoring, category selection, and summary generation |
| AI Usage Dashboard | Estimated OpenAI usage and cost visibility                             |

### Performance and Delivery

| Technology          | Purpose                            |
| ------------------- | ---------------------------------- |
| Cloudflare CDN      | Public caching and edge delivery   |
| Vercel Edge Network | Frontend delivery                  |
| Cache headers       | Control freshness and CDN behavior |

### Observability

| Technology                  | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| Admin Portal                | Internal operational dashboard home        |
| AI Usage Dashboard          | Estimated OpenAI usage and cost tracking   |
| Better Stack Uptime         | External uptime monitoring                 |
| Better Stack Telemetry Logs | Centralized structured logging             |
| Sentry                      | Application error monitoring               |
| Cloudflare Analytics        | CDN, security, and Worker visibility       |
| Vercel Logs                 | Deployment and frontend runtime visibility |

### Source Control

| Technology | Purpose                                                   |
| ---------- | --------------------------------------------------------- |
| GitHub     | Repository, issues, project planning, and version history |

---

## Core Components

### `web`

The public website and admin portal.

It presents the server-rendered mobile feed, article pages, About page, SEO metadata, structured data, dynamic Open Graph images, CDN-friendly responses, frontend error tracking, web application logs, Google-protected admin access, and server-rendered admin dashboards.

Important admin routes include:

```text
/admin
/admin/ai-usage
/admin/shards
/admin/login
/admin/access-denied
```

### `worker`

The automated ingestion engine.

It fetches RSS feeds, parses articles, filters unsuitable candidates, calls OpenAI for review, stores review decisions, publishes accepted articles, saves successful and failed Worker run records, reports partial feed failures, safely rejects articles when OpenAI fails, records Supabase save status, and logs structured activity.

### `controller`

The orchestration layer.

It can trigger Worker shards in a controlled way so the system does not need every shard to run at once.

### `supabase`

The data layer.

It stores RSS feeds, AI review history, accepted articles, rejected articles, categories, summaries, timestamps, source links, AI usage runs, Worker run records, and data used by admin dashboards.

### `README.md`

The project guide.

It explains what NutsNews is, why it exists, how it is designed, and what makes the platform valuable.

---

## Repository Structure

```text
nutsnews/
├── web/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── (public)/
│   │   │   └── (protected)/
│   │   ├── api/
│   │   ├── articles/
│   │   └── components/
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
│   └── database scripts and migrations
│
├── LICENSE
└── README.md
```

---

## Data Model Summary

NutsNews uses a simple data model.

### RSS feeds

Stores the sources that the platform reads from.

This allows feeds to be added, disabled, or organized without changing the whole system.

### Article AI reviews

Stores the AI or local-filter decision for each reviewed article.

This includes whether the article was accepted or rejected, why it was classified that way, what category it belongs to, and what positivity score it received.

This is important because it prevents repeated AI review for the same story.

The admin AI Usage dashboard also uses this review history to estimate OpenAI usage and cost.

### Published articles

Stores the stories shown on the public website.

Each published article keeps the original source URL so readers can go back to the publisher.

### AI usage runs

Stores run-level OpenAI usage metrics saved by the Worker.

This powers `/admin/ai-usage` and includes:

* Run started and completed timestamps
* Run source
* Request ID
* Shard index
* OpenAI model
* OpenAI call count
* Prompt tokens
* Completion tokens
* Total tokens
* Estimated OpenAI cost
* Accepted and rejected OpenAI decisions
* Cost protection limit status
* Spike warning status

### Worker runs

Stores successful and failed Worker shard executions.

This powers `/admin/shards` and includes:

* Run started and completed timestamps
* Run source
* Request ID
* Shard index
* Success status
* Error name
* Error message
* Feed count
* Fetched count
* Candidate count
* Accepted count
* Rejected count
* No-thumbnail rejection count
* Image hydration lookup count
* Image hydration found count
* Save status fields
* Duration

Failed runs are saved with `success = false`, which makes it possible to calculate consecutive failures and show the latest failure message for each shard.

---

## AI Curation Model

AI is used as a focused editorial assistant.

For each eligible article, the system asks whether the article fits the NutsNews mission.

The AI helps decide:

* Should this article be accepted?
* What category does it belong to?
* How positive is it?
* What short summary should appear on the site?
* Why was it accepted or rejected?

The AI is not used to copy full publisher articles.

It is used to create short original summaries and support discovery.

---

## AI Cost Protection Model

NutsNews treats AI usage as something that should be visible and controlled.

The system reduces unnecessary AI calls through:

* Local filtering before AI
* Duplicate review detection
* Accepted article review caching
* Rejected article review caching
* Shard-level review limits
* Stored review history
* Admin AI usage visibility

The AI Usage dashboard helps answer:

* How many articles likely reached OpenAI?
* How many were accepted?
* How many were rejected?
* How many were skipped before AI?
* What is the estimated OpenAI cost?
* Is usage trending upward?

This makes the platform safer to operate as the number of RSS feeds grows.

---

## Source-Friendly Publishing

NutsNews is intentionally source-friendly.

The platform does not try to replace the original article.

It stores and displays:

* The original title
* The source name
* A short original summary
* The category
* The article image when available
* The link back to the original publisher

This approach supports discovery while respecting the original publisher’s role.

---

## Observability Story

NutsNews is built with observability from the start.

A fully automated system needs visibility. If no human is manually publishing every article, the platform needs to explain what it is doing.

That is why NutsNews uses:

### Admin Portal

To answer:

> What is happening inside the platform right now?

### AI Usage Dashboard

To answer:

> Is OpenAI usage controlled?

### Better Stack Uptime

To answer:

> Is the site reachable?

### Better Stack Logs

To answer:

> What happened inside the app, Worker, or controller?

### Sentry

To answer:

> What errors happened in production?

### Cloudflare

To answer:

> Is traffic being cached? Are Workers running? Are edge errors happening?

### Supabase

To answer:

> What data was stored? Which articles were reviewed or published?

Together, these tools make the platform easier to operate and improve.

---

## Centralized Logging

NutsNews sends structured logs to Better Stack.

The current logging model separates services with a `service` field:

```text
nutsnews-web
nutsnews-worker
nutsnews-controller
```

This makes it easy to search for logs by application area.

Important log fields include:

| Field           | Purpose                                    |
| --------------- | ------------------------------------------ |
| `level`         | Severity such as info, warn, or error      |
| `service`       | Which part of the platform created the log |
| `event`         | What happened                              |
| `message`       | Human-readable summary                     |
| `environment`   | Production, preview, or local              |
| `shardIndex`    | Which Worker shard produced the log        |
| `durationMs`    | How long an operation took                 |
| `status`        | Request or operation status                |
| `acceptedCount` | Number of accepted articles                |
| `rejectedCount` | Number of rejected articles                |

This makes the system much easier to troubleshoot than plain text logs.

---

## Performance Story

Performance is not handled by one tool.

It is handled by the whole design.

NutsNews improves performance by:

* Caching public pages at Cloudflare
* Using Vercel for frontend delivery
* Keeping the mobile UI lightweight
* Avoiding unnecessary repeated AI calls
* Avoiding repeated database inserts
* Splitting RSS processing across Worker shards
* Returning cached API responses when possible

The result is a site that can stay simple while still being prepared for more traffic.

---

## Resiliency Story

Resiliency means the platform can keep working even when one part has a problem.

NutsNews improves resiliency by:

* Using managed hosting instead of self-managed servers
* Splitting RSS processing into Worker shards
* Allowing Worker runs to continue when individual feeds fail
* Converting OpenAI failures into safe article rejections
* Logging Supabase save failures without hiding partial results
* Tracking reviewed URLs to avoid repeated work
* Using a controller to coordinate shard execution
* Monitoring uptime externally
* Capturing application errors
* Logging Worker activity centrally
* Keeping the public website cacheable
* Keeping admin dashboards separate from public reader pages

The platform does not depend on one long-running server or one manual publishing process.

---

## Cost Story

NutsNews is designed to stay affordable.

The platform uses free-tier-friendly services wherever possible:

* Vercel for the website and admin portal
* Cloudflare Workers for automation
* Cloudflare CDN for caching
* Supabase for the database
* Better Stack for uptime and logs
* Sentry for error monitoring
* GitHub for source control

OpenAI is the main usage-based cost, so the system is designed to reduce unnecessary AI calls.

The key cost-saving idea is simple:

> Review each article once, remember the decision, and avoid paying to review the same story again.

The admin AI Usage dashboard supports this by making estimated OpenAI usage visible.

---

## Maintenance Story

NutsNews is meant to be maintainable by a small team or even one person.

The system supports this by:

* Keeping the frontend separate from the ingestion pipeline
* Keeping feed configuration in the database
* Using one Worker codebase for many shards
* Generating shard configs automatically
* Centralizing Worker secrets
* Centralizing logs
* Monitoring errors through Sentry
* Monitoring uptime through Better Stack
* Providing a private admin portal for internal visibility
* Keeping the public site source-friendly and simple

The goal is not to create a complicated platform.

The goal is to create a clean system that can run mostly on its own.

---

## Extendability Story

NutsNews can grow in many directions.

Future possibilities include:

* More RSS sources
* More positive-news categories
* Search
* Topic pages
* Newsletters
* Social media publishing
* Personalization
* Multi-language summaries
* Editorial review dashboard
* Feed health dashboard with Supabase disable actions
* Worker shard health dashboard
* Source scoring
* Automated cache purging
* Public API
* Native mobile app
* More admin dashboards
* Admin controls for operational tasks

Because the project already separates ingestion, storage, frontend, caching, logging, monitoring, and admin visibility, new features can be added without redesigning the entire system.

---

## Project Benefits

### For readers

NutsNews provides a calmer alternative to stressful news feeds.

### For publishers

NutsNews sends readers back to the original source instead of replacing the publisher’s content.

### For operators

The system is automated, monitored, logged, protected, and designed to run at low cost.

### For developers

The architecture is modular, serverless, and easy to extend.

### For the business

The platform can become the foundation for a fully automated positive-news agency.

---

## Current Status

NutsNews currently includes:

* A public mobile-first website
* RSS-based content discovery
* AI-assisted article filtering
* AI-generated short summaries
* Supabase article storage
* Cloudflare Worker automation
* Worker sharding
* Worker partial failure handling
* RSS feed success and failure counts
* Safe OpenAI failure rejection behavior
* Clear Supabase save failure logging
* Controller Worker orchestration
* Cloudflare CDN caching
* Better Stack uptime monitoring
* Better Stack centralized structured logs
* Sentry error monitoring
* Google-protected admin portal
* Admin landing page at `/admin`
* AI Usage dashboard at `/admin/ai-usage`
* Worker Health dashboard at `/admin/shards`
* Exact OpenAI token and cost visibility
* Dedicated Worker run tracking
* Failed Worker execution tracking
* Partial RSS feed failure visibility
* Latest Worker error visibility
* Consecutive shard failure counts
* Source-friendly article linking
* Dynamic Open Graph image generation
* Branded social previews for homepage and article pages
* MIT license

The project is active and designed to improve gradually.

---

## Roadmap

Planned or possible future improvements:

* Expand the RSS source list
* Improve article image extraction
* Add source quality scoring
* Truncate failed feed error bodies in Worker responses and logs
* Add feed health tracking
* Add RSS feed management dashboard
* Add article review dashboard
* Add backup status dashboard
* Add admin controls for pausing AI reviews
* Add admin controls for disabling bad feeds
* Add Better Stack alert rules for AI usage spikes
* Add Better Stack dashboards and alerts
* Add alerting for repeated failed Worker runs
* Add Sentry alert rules
* Add topic landing pages
* Add newsletter support
* Add search
* Add article engagement analytics
* Add manual review for borderline stories
* Add richer fallback thumbnails
* Add personalization
* Add multi-language support
* Add social sharing automation
* Add a native mobile app

---

## Useful Admin Environment Variables

The admin dashboards support optional configuration.

```env
ADMIN_SHARD_COUNT=25
ADMIN_SHARD_STALE_MINUTES=180
ADMIN_SHARD_SLOW_RUN_MS=15000
```

Recommended shard stale timing depends on the controller schedule.

For the current design:

```text
25 shards × 5 minutes per shard = 125 minutes per full rotation
```

A stale threshold of 180 minutes gives the controller enough time to complete a normal rotation with buffer.

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

---

## Summary

NutsNews is more than a positive-news website.

It is a low-cost, automated, observable, CDN-backed, AI-assisted publishing platform with a private admin portal for operational visibility.

It combines a calm reader experience with a practical cloud architecture:

* Fast enough for readers
* Resilient enough for automation
* Cheap enough to experiment with
* Maintainable enough for a small team
* Observable enough to operate safely
* Extendable enough to grow into a larger product

The mission is simple:

> Help people find more good in the world, one uplifting story at a time.
