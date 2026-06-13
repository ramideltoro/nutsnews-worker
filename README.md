# NutsNews

**A calm, mobile-first positive news platform powered by automation, AI curation, serverless infrastructure, CDN caching, and centralized observability.**

NutsNews collects uplifting stories from trusted RSS feeds, filters out stressful topics, creates short cheerful summaries, and links readers back to the original publishers.

The project is designed to be simple to use, inexpensive to operate, easy to maintain, and scalable enough to grow from a small experiment into a fully automated positive-news platform.

---

## Project Snapshot

| Area          | Highlight                                                                        |
| ------------- | -------------------------------------------------------------------------------- |
| Product       | Mobile-first positive news feed                                                  |
| Mission       | Give readers a calmer alternative to stressful news                              |
| Content model | RSS discovery, AI-assisted filtering, short summaries, source links              |
| Frontend      | Next.js website hosted on Vercel                                                 |
| Automation    | Cloudflare Workers process RSS feeds                                             |
| AI            | OpenAI classifies, scores, and summarizes candidate articles                     |
| Database      | Supabase Postgres stores articles and review history                             |
| CDN           | Cloudflare caches public pages and API responses                                 |
| Logging       | Better Stack centralizes structured logs                                         |
| Monitoring    | Sentry tracks application errors; Better Stack tracks uptime                     |
| Cost model    | Designed around free-tier cloud services, with the domain as the main fixed cost |

---

## The Story Behind NutsNews

Most news products are built around urgency. They compete for attention with conflict, fear, politics, money, and breaking events.

NutsNews takes a different direction.

The goal is to create a peaceful place where readers can quickly find stories that feel encouraging, warm, interesting, and human. Instead of replacing publishers, NutsNews helps readers discover positive stories and then sends them back to the original source.

A reader should be able to open NutsNews and immediately understand the feeling of the product:

> “Here is something good happening in the world.”

That product idea drives the technical design.

The platform is built to automatically discover articles, filter them, summarize them, publish them, cache them, monitor them, and log what happened — all while staying inexpensive and easy to extend.

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

The goal is not to become a traditional newsroom. The goal is to become a fully automated positive-news discovery layer that helps readers find uplifting stories from around the web.

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

And application errors are monitored through:

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

The project is built around free or low-cost cloud services.

### 4. Keep the architecture modular

The frontend, database, AI workflow, Workers, controller, logging, and monitoring are separated so each layer can improve independently.

### 5. Keep publishers respected

NutsNews does not republish full articles. It uses short summaries and sends readers to the original publishers.

### 6. Keep the system observable

Centralized logs, uptime monitoring, CDN visibility, and error tracking make it easier to understand the health of the platform.

---

## Performance Highlights

Performance is handled at several layers.

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

| Service             | Role                            | Cost Goal         |
| ------------------- | ------------------------------- | ----------------- |
| Vercel              | Hosts the Next.js website       | Free tier         |
| Cloudflare CDN      | DNS, cache, and edge protection | Free tier         |
| Cloudflare Workers  | RSS automation and controller   | Free tier         |
| Supabase            | Postgres database               | Free tier         |
| Better Stack Uptime | External uptime monitoring      | Free tier         |
| Better Stack Logs   | Centralized structured logs     | Free tier         |
| Sentry              | Error monitoring                | Free tier         |
| GitHub              | Source control                  | Free              |
| OpenAI              | AI review and summaries         | Usage-based       |
| Domain              | Public site domain              | Fixed yearly cost |

The current fixed cost is designed to stay very low, with the domain as the main predictable expense.

OpenAI is the main variable cost, so the system includes several protections:

* Local filtering before AI
* Duplicate URL detection
* Accepted article review caching
* Rejected article review caching
* Shard-level review limits
* Batch database operations

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

### Logs are structured

Structured logs make maintenance easier because events can be searched by known fields like:

* `service`
* `level`
* `event`
* `shardIndex`
* `durationMs`
* `status`

This is much easier to search than plain text logs.

### Monitoring is layered

NutsNews uses multiple observability layers:

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

### Add an editorial dashboard

A future dashboard could allow manual review, feed management, source scoring, and article moderation.

### Add multi-language support

The platform could eventually translate summaries or support uplifting stories from other regions.

The important point is that the current architecture does not lock the project into one narrow use case. It creates a foundation.

---

## Tech Stack

### Frontend

| Technology   | Purpose                          |
| ------------ | -------------------------------- |
| Next.js      | Public website and article pages |
| React        | Interactive feed experience      |
| TypeScript   | Safer application code           |
| Tailwind CSS | Mobile-first styling             |
| Vercel       | Frontend hosting and deployment  |

### Automation

| Technology               | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| Cloudflare Workers       | RSS ingestion and automation             |
| Cloudflare Worker Shards | Split RSS processing across many workers |
| Controller Worker        | Coordinates shard execution              |
| Wrangler                 | Worker deployment and configuration      |
| Cloudflare Secrets Store | Shared secrets for Worker shards         |

### Data

| Technology        | Purpose                           |
| ----------------- | --------------------------------- |
| Supabase          | Hosted Postgres database          |
| Postgres          | Article, feed, and review storage |
| Supabase REST API | Worker-to-database communication  |

### AI

| Technology | Purpose                                                                |
| ---------- | ---------------------------------------------------------------------- |
| OpenAI     | Article filtering, scoring, category selection, and summary generation |

### Performance and Delivery

| Technology          | Purpose                            |
| ------------------- | ---------------------------------- |
| Cloudflare CDN      | Public caching and edge delivery   |
| Vercel Edge Network | Frontend delivery                  |
| Cache headers       | Control freshness and CDN behavior |

### Observability

| Technology                  | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| Better Stack Uptime         | External uptime monitoring                 |
| Better Stack Telemetry Logs | Centralized structured logging             |
| Sentry                      | Application error monitoring               |
| Cloudflare Analytics        | CDN, security, and Worker visibility       |
| Vercel Logs                 | Deployment and frontend runtime visibility |

### Source Control

| Technology | Purpose                                        |
| ---------- | ---------------------------------------------- |
| GitHub     | Repository, collaboration, and version history |

---

## Core Components

### `web`

The public website.

It presents the mobile feed, article pages, About page, SEO metadata, structured data, CDN-friendly responses, frontend error tracking, and web application logs.

### `worker`

The automated ingestion engine.

It fetches RSS feeds, parses articles, filters unsuitable candidates, calls OpenAI for review, stores review decisions, publishes accepted articles, and logs structured activity.

### `controller`

The orchestration layer.

It can trigger Worker shards in a controlled way so the system does not need every shard to run at once.

### `supabase`

The data layer.

It stores RSS feeds, AI review history, accepted articles, rejected articles, categories, summaries, timestamps, and source links.

### `README.md`

The project guide.

It explains what NutsNews is, why it exists, how it is designed, and what makes the platform valuable.

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

Stores the AI decision for each reviewed article.

This includes whether the article was accepted or rejected, why it was classified that way, what category it belongs to, and what positivity score it received.

This is important because it prevents repeated AI review for the same story.

### Published articles

Stores the stories shown on the public website.

Each published article keeps the original source URL so readers can go back to the publisher.

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

The AI is not used to copy full publisher articles. It is used to create short original summaries and support discovery.

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

Performance is not handled by one tool. It is handled by the whole design.

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
* Tracking reviewed URLs to avoid repeated work
* Using a controller to coordinate shard execution
* Monitoring uptime externally
* Capturing application errors
* Logging Worker activity centrally
* Keeping the public website cacheable

The platform does not depend on one long-running server or one manual publishing process.

---

## Cost Story

NutsNews is designed to stay affordable.

The platform uses free-tier-friendly services wherever possible:

* Vercel for the website
* Cloudflare Workers for automation
* Cloudflare CDN for caching
* Supabase for the database
* Better Stack for uptime and logs
* Sentry for error monitoring
* GitHub for source control

OpenAI is the main usage-based cost, so the system is designed to reduce unnecessary AI calls.

The key cost-saving idea is simple:

> Review each article once, remember the decision, and avoid paying to review the same story again.

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
* Keeping the public site source-friendly and simple

The goal is not to create a complicated platform. The goal is to create a clean system that can run mostly on its own.

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
* Feed health dashboard
* Source scoring
* Automated cache purging
* Public API
* Native mobile app

Because the project already separates ingestion, storage, frontend, caching, logging, and monitoring, new features can be added without redesigning the entire system.

---

## Project Benefits

### For readers

NutsNews provides a calmer alternative to stressful news feeds.

### For publishers

NutsNews sends readers back to the original source instead of replacing the publisher’s content.

### For operators

The system is automated, monitored, logged, and designed to run at low cost.

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
* Controller Worker orchestration
* Cloudflare CDN caching
* Better Stack uptime monitoring
* Better Stack centralized structured logs
* Sentry error monitoring
* Source-friendly article linking
* MIT license

The project is active and designed to improve gradually.

---

## Roadmap

Planned or possible future improvements:

* Expand the RSS source list
* Improve article image extraction
* Add source quality scoring
* Add feed health tracking
* Add topic landing pages
* Add newsletter support
* Add search
* Add article engagement analytics
* Add manual review for borderline stories
* Add dashboard for feed management
* Add dashboard for Worker shard health
* Add Better Stack dashboards and alerts
* Add Sentry alert rules
* Add Open Graph image generation
* Add richer fallback thumbnails
* Add personalization
* Add multi-language support
* Add social sharing automation
* Add a native mobile app

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

---

## Summary

NutsNews is more than a positive-news website.

It is a low-cost, automated, observable, CDN-backed, AI-assisted publishing platform.

It combines a calm reader experience with a practical cloud architecture:

* Fast enough for readers
* Resilient enough for automation
* Cheap enough to experiment with
* Maintainable enough for a small team
* Extendable enough to grow into a larger product

The mission is simple:

> Help people find more good in the world, one uplifting story at a time.
