# NutsNews Documentation

This folder contains the long-form GitHub documentation for NutsNews.

The root `README.md` is intentionally short. It acts as the project landing page. Detailed product, architecture, operations, observability, performance, recovery, and troubleshooting documentation lives here.

---

## Documentation Map

| Document | Purpose |
| --- | --- |
| [Project Overview](PROJECT.md) | Product story, mission, reader experience, editorial direction, benefits, and status |
| [Architecture](ARCHITECTURE.md) | System design, components, data flow, data model, and repository layout |
| [Operations](OPERATIONS.md) | Admin portal, deployment, maintenance workflows, environment variables, and operating model |
| [Admin Article Reviews](ADMIN_ARTICLE_REVIEWS.md) | Article review dashboard, filters, time sorting, rejection reasons, provider/model tracking, and investigation workflow |
| [Home Server Local AI](HOME_SERVER_LOCAL_AI.md) | Current production home-server local AI setup with Cloudflare Tunnel, Ollama/qwen, Worker Secrets Store, monitoring, troubleshooting, and rollback |
| [Oracle Local AI Alternative](ORACLE_LOCAL_AI.md) | Earlier Oracle Free Tier local AI design and fallback option if Oracle capacity becomes available later |
| [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) | Repeatable web, Worker shard, controller, Cloudflare cache purge, and post-deploy verification checklist |
| [Dependency Updates](DEPENDENCY_UPDATES.md) | Repeatable npm audit, safe patch/minor update, Dependabot, and validation routine |
| [Controller and Shards](CONTROLLER_AND_SHARDS.md) | Manual controller triggers, shard tests, Wrangler tail, and expected response fields |
| [Performance and Resiliency](PERFORMANCE_AND_RESILIENCY.md) | CDN, caching, pagination, database indexes, Worker sharding, failure handling, and cost controls |
| [Public Feed Snapshot](PUBLIC_FEED_SNAPSHOT.md) | Materialized homepage/API feed snapshot, Worker refresh flow, fallback behavior, and validation checks |
| [Observability](OBSERVABILITY.md) | Better Stack, Sentry, dashboards, structured logs, monitoring, and health checks |
| [RSS Source Quality](RSS_SOURCE_QUALITY.md) | Feed quality score formula, ranking SQL, admin display, and promotion/disable rules |
| [Supabase Restore Procedure](SUPABASE_RESTORE.md) | Backup locations, restore order, SQL import commands, validation queries, and restore-test checklist |
| [Troubleshooting Guide](TROUBLESHOOTING.md) | Common production problems and how to diagnose them from one place |
| [Archived Root Update Notes](archive/) | Older one-off update notes moved out of the repository root |

---

## How to Use These Docs

Use the docs like this:

* Start with `PROJECT.md` when explaining what NutsNews is.
* Use `ARCHITECTURE.md` when making system or code changes.
* Use `OPERATIONS.md` when deploying or maintaining the platform.
* Use `ADMIN_ARTICLE_REVIEWS.md` when reviewing accepted/rejected story decisions or investigating AI review mistakes.
* Use `HOME_SERVER_LOCAL_AI.md` when setting up, operating, debugging, or rolling back the current home-server local AI provider.
* Use `ORACLE_LOCAL_AI.md` only as the older Oracle Free Tier alternative design if Oracle capacity becomes available later.
* Use `DEPLOYMENT_CHECKLIST.md` when releasing web, Worker, controller, database, or cache changes.
* Use `DEPENDENCY_UPDATES.md` when reviewing npm audit output, applying safe dependency updates, or validating Dependabot PRs.
* Use `CONTROLLER_AND_SHARDS.md` when manually testing the controller or individual Worker shards.
* Use `PERFORMANCE_AND_RESILIENCY.md` when improving speed, cache HIT rate, database performance, Worker throughput, or reliability.
* Use `PUBLIC_FEED_SNAPSHOT.md` when validating the optimized homepage/API data source or debugging snapshot fallback behavior.
* Use `OBSERVABILITY.md` when debugging logs, dashboards, monitoring, or errors.
* Use `RSS_SOURCE_QUALITY.md` when deciding which feeds to promote, keep, review, disable, or replace.
* Use `SUPABASE_RESTORE.md` when recovering from a bad deploy, accidental delete, hacked data, broken migration, or database crash.
* Use `TROUBLESHOOTING.md` when something is broken in production.

---

## Documentation Principles

The docs should stay:

* Practical
* Current
* Easy to scan
* Friendly to future contributors
* Useful during production incidents
* Linked from the root README

Whenever a GitHub issue adds a meaningful operational feature, update the relevant doc in this folder.
