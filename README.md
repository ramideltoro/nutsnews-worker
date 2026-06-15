# NutsNews

**A calm, mobile-first positive news platform powered by RSS automation, AI curation, serverless infrastructure, CDN caching, centralized observability, and private admin dashboards.**

NutsNews collects uplifting stories from trusted RSS feeds, filters out stressful topics, creates short cheerful summaries, and links readers back to the original publishers.

The project is designed to be simple to use, inexpensive to operate, easy to maintain, observable in production, and scalable enough to grow from a small experiment into a fully automated positive-news platform.

---

## Highlights

| Area | Summary |
| --- | --- |
| Product | Mobile-first positive news feed |
| Mission | Give readers a calmer alternative to stressful news |
| Frontend | Next.js app hosted on Vercel |
| Automation | Cloudflare Worker shards fetch and process RSS feeds |
| Controller | Controller Worker coordinates shard execution |
| Database | Supabase Postgres stores articles, feeds, review history, and operational data |
| AI | OpenAI classifies, scores, and summarizes candidate stories |
| Admin | Google-protected admin dashboards for internal operations |
| CDN | Cloudflare caches public reader routes and article API responses |
| Observability | Better Stack logs and uptime, Sentry errors, admin health dashboards |
| Cost model | Built around free-tier cloud services with OpenAI as the main variable cost |

---

## Documentation

The full project documentation lives in [`docs/`](docs/).

| Document | Purpose |
| --- | --- |
| [Docs Index](docs/README.md) | Start here for all project docs |
| [Project Overview](docs/PROJECT.md) | Product story, mission, reader experience, and benefits |
| [Architecture](docs/ARCHITECTURE.md) | System design, major components, and data flow |
| [Operations](docs/OPERATIONS.md) | Admin portal, deployment, maintenance, and operational workflows |
| [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) | Repeatable web, Worker shard, controller, Cloudflare cache purge, and post-deploy verification checklist |
| [Controller and Shards](docs/CONTROLLER_AND_SHARDS.md) | Manual controller triggers, shard tests, Wrangler tail, and expected response fields |
| [Performance and Resiliency](docs/PERFORMANCE_AND_RESILIENCY.md) | CDN, caching, Worker sharding, indexes, failure handling, and cost controls |
| [Observability](docs/OBSERVABILITY.md) | Better Stack, Sentry, dashboards, structured logs, and health checks |
| [Troubleshooting Guide](docs/TROUBLESHOOTING.md) | Diagnose common production problems from one document |

---

## Repository Structure

```text
nutsnews/
├── web/          # Next.js public site and admin portal
├── worker/       # Cloudflare Worker RSS ingestion engine
├── controller/   # Cloudflare Worker shard controller
├── supabase/     # Supabase migrations and database configuration
├── docs/         # GitHub documentation
├── scripts/      # Project utility scripts
├── README.md     # Short project entry point
└── LICENSE       # MIT license
```

---

## Quick Links

| Area | Link |
| --- | --- |
| Public site | https://www.nutsnews.com |
| Admin portal | `/admin` |
| AI usage dashboard | `/admin/ai-usage` |
| Worker health dashboard | `/admin/shards` |
| Feed health dashboard | `/admin/feed-health` |
| Feed management dashboard | `/admin/feeds` |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Deployment checklist | [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) |

---

## Current Status

NutsNews currently includes:

* Mobile-first public article feed
* RSS-based content discovery
* AI-assisted article filtering and summaries
* Thumbnail quality controls
* Supabase article, feed, review, AI usage, Worker run, and feed health tables
* Cloudflare Worker sharding
* Controller Worker orchestration
* Cloudflare CDN caching for public reader routes
* Better Stack uptime monitoring and centralized logs
* Sentry error monitoring
* Google-protected admin portal
* AI usage dashboard
* Worker shard health dashboard
* RSS feed health and feed management dashboards
* Database indexes for feed/API performance
* GitHub documentation in `docs/`
* Production troubleshooting guide for issue #30
* Deployment checklist for issue #29
* Controller and shard operations guide for issue #37
* MIT license

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.
