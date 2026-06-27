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
| AI | Home-server local AI with Ollama/qwen classifies, scores, and summarizes candidate stories, with OpenAI fallback |
| Admin | Google-protected admin dashboards for article review, source health, worker health, and internal operations |
| CDN | Cloudflare caches public reader routes and article API responses |
| Feed Snapshot | Supabase materialized public feed snapshot speeds homepage/API reads |
| Observability | Better Stack logs and uptime, UptimeRobot public uptime checks, Lighthouse CI web quality checks, Sentry errors, Grafana Cloud Prometheus backup monitoring, admin health dashboards |
| Dependency Maintenance | Repeatable npm audit, safe update, and build validation routine |
| Source Quality | Supabase feed quality scoring ranks RSS sources by useful output |
| Recovery | Automated Supabase backups to encrypted OneDrive plus documented restore runbook with validation SQL |
| Cost model | Built around free-tier cloud services, local AI support, and optional OpenAI fallback |

---

## Documentation

The full project documentation lives in [`docs/`](docs/).

| Document | Purpose |
| --- | --- |
| [Docs Index](docs/README.md) | Start here for all project docs |
| [Project Overview](docs/PROJECT.md) | Product story, mission, reader experience, and benefits |
| [Architecture](docs/ARCHITECTURE.md) | System design, major components, and data flow |
| [Operations](docs/OPERATIONS.md) | Admin portal, deployment, maintenance, and operational workflows |
| [Admin Article Reviews](docs/ADMIN_ARTICLE_REVIEWS.md) | Article review dashboard, filters, time sorting, rejection reasons, provider/model tracking, and investigation workflow |
| [Responsive Admin Dashboards](docs/ADMIN_RESPONSIVE_DASHBOARDS.md) | Mobile responsiveness layer for protected admin dashboards, tables, cards, headings, and touch controls |
| [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) | Repeatable release checklist |
| [Home Server Local AI](docs/HOME_SERVER_LOCAL_AI.md) | Current production home-server local AI setup with Cloudflare Tunnel, Ollama/qwen, Worker Secrets Store, monitoring, troubleshooting, and rollback |
| [Home Server Dashboard](docs/HOME_SERVER_DASHBOARD.md) | Protected `/admin/home-server` dashboard, `/stats` endpoint, instance metrics, Vercel env vars, deployment, and troubleshooting |
| [Grafana Backup Monitoring](docs/GRAFANA_BACKUP_MONITORING.md) | Grafana Cloud Explore, PromQL queries, dashboard panels, and alerts for home-server backup success, freshness, count, and next run |
| [NutsNews Supabase Backup Automation](docs/NUTSNEWS_DB_BACKUPS.md) | Home-server Supabase backups to encrypted OneDrive, daily schedule, retention, on-demand commands, metrics, and restore notes |
| [Oracle Local AI Alternative](docs/ORACLE_LOCAL_AI.md) | Earlier Oracle Free Tier local AI design and fallback option if Oracle capacity becomes available later |
| [Dependency Updates](docs/DEPENDENCY_UPDATES.md) | Repeatable npm audit, safe patch/minor update, and validation routine |
| [Controller and Shards](docs/CONTROLLER_AND_SHARDS.md) | Manual controller triggers, shard tests, Wrangler tail, and expected response fields |
| [Performance and Resiliency](docs/PERFORMANCE_AND_RESILIENCY.md) | CDN, caching, Worker sharding, indexes, image delivery, failure handling, and cost controls |
| [Image Delivery](docs/IMAGE_DELIVERY.md) | Next Image optimization, responsive article thumbnails, cache TTL, placeholders, and raw-image fallback behavior |
| [Public Feed Snapshot](docs/PUBLIC_FEED_SNAPSHOT.md) | Materialized homepage/API feed snapshot, Worker refresh flow, fallback behavior, and validation checks |
| [Observability](docs/OBSERVABILITY.md) | Better Stack, Sentry, dashboards, structured logs, and health checks |
| [UptimeRobot Onboarding](docs/UPTIMEROBOT_ONBOARDING.md) | Step-by-step public uptime, keyword, API, privacy/contact page, alert contact, and safe health-check monitor setup |
| [Lighthouse CI Onboarding](docs/LIGHTHOUSE_CI_ONBOARDING.md) | Step-by-step GitHub Actions setup for Google Lighthouse CI checks from the `web/` app, including thresholds, secrets, validation, and safe audited URLs |
| [RSS Source Quality](docs/RSS_SOURCE_QUALITY.md) | Quality score formula, Supabase ranking query, admin dashboard behavior, and feed promotion/disable rules |
| [Supabase Restore Procedure](docs/SUPABASE_RESTORE.md) | Backup locations, restore order, SQL import commands, validation queries, and restore-test checklist |
| [Troubleshooting Guide](docs/TROUBLESHOOTING.md) | Diagnose common production problems from one document |

---

## Repository Structure

```text
nutsnews/
├── web/          # Next.js public site and admin portal
├── worker/       # Cloudflare Worker RSS ingestion engine
├── controller/   # Cloudflare Worker shard controller
├── local-ai-service/ # Home-server/Ollama local AI review endpoint
├── supabase/     # Supabase migrations, restore validation SQL, and database configuration
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
| Article review dashboard | `/admin/articles` |
| AI usage dashboard | `/admin/ai-usage` |
| Local AI dashboard | `/admin/local-ai` |
| Home server dashboard | `/admin/home-server` |
| Grafana backup monitoring | [docs/GRAFANA_BACKUP_MONITORING.md](docs/GRAFANA_BACKUP_MONITORING.md) |
| UptimeRobot onboarding | [docs/UPTIMEROBOT_ONBOARDING.md](docs/UPTIMEROBOT_ONBOARDING.md) |
| NutsNews DB backups | [docs/NUTSNEWS_DB_BACKUPS.md](docs/NUTSNEWS_DB_BACKUPS.md) |
| Worker health dashboard | `/admin/shards` |
| Feed health dashboard | `/admin/feed-health` |
| Feed management dashboard | `/admin/feeds` |
| Dependency update guide | [docs/DEPENDENCY_UPDATES.md](docs/DEPENDENCY_UPDATES.md) |
| RSS source quality guide | [docs/RSS_SOURCE_QUALITY.md](docs/RSS_SOURCE_QUALITY.md) |
| Public feed snapshot guide | [docs/PUBLIC_FEED_SNAPSHOT.md](docs/PUBLIC_FEED_SNAPSHOT.md) |
| Supabase restore runbook | [docs/SUPABASE_RESTORE.md](docs/SUPABASE_RESTORE.md) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |

---

## Current Status

NutsNews currently includes:

* Mobile-first public article feed with automatic scroll loading
* RSS-based content discovery
* AI assisted article filtering and summaries
* Home-server local AI provider support with qwen/Ollama, Cloudflare Tunnel, and optional OpenAI fallback
* Thumbnail quality controls
* Supabase article, feed, review, AI usage, Worker run, and feed health tables
* Cloudflare Worker sharding
* Controller Worker orchestration
* Supabase public feed snapshot for faster homepage/API reads
* Optimized article image delivery with responsive Next Image thumbnails, AVIF/WebP support, and safe raw-image fallback
* Cloudflare CDN caching for public reader routes
* Better Stack uptime monitoring and centralized logs
* UptimeRobot public website, homepage keyword, article API, privacy page, and contact page monitoring documentation
* Grafana Cloud Prometheus backup monitoring for the home server
* Automated NutsNews Supabase backups to encrypted OneDrive from the home server
* Sentry error monitoring
* Google-protected admin portal
* Responsive admin dashboard shell for mobile-friendly protected dashboard pages
* Article review dashboard for accepted/rejected story decisions with AI provider/model visibility
* AI usage dashboard
* Local AI dashboard for home-server/Ollama model activity, fallback usage, latency, and recent decisions
* Home server dashboard for CPU, memory, disk, uptime, critical service status, Ollama models, and local AI runtime configuration
* Worker shard health dashboard
* RSS feed health and feed management dashboards
* RSS source quality scoring with 0-100 feed rankings
* Repeatable dependency update routine with npm audit/outdated reports and safe patch/minor updates
* Dependabot npm monitoring for web, Worker, and controller projects
* Database indexes for feed/API and article review dashboard performance
* GitHub documentation in `docs/`
* Production troubleshooting guide for issue #30
* Controller and shard operations guide for issue #37
* Worker article recovery improvements for no-thumbnail retries and image hydration
* Truncated failed-feed error previews for cleaner Worker and controller responses
* Supabase restore runbook, restore validation SQL, and restore verification helper script
* NutsNews Supabase backup automation docs for encrypted OneDrive backups, daily schedule, retention, on-demand helper commands, and Grafana metrics
* MIT license

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.
