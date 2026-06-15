# NutsNews Documentation

This folder contains the long-form GitHub documentation for NutsNews.

The root `README.md` is now intentionally short. It acts as the project landing page. Detailed product, architecture, operations, observability, performance, and troubleshooting documentation lives here.

---

## Documentation Map

| Document | Purpose |
| --- | --- |
| [Project Overview](PROJECT.md) | Product story, mission, reader experience, editorial direction, benefits, and status |
| [Architecture](ARCHITECTURE.md) | System design, components, data flow, data model, and repository layout |
| [Operations](OPERATIONS.md) | Admin portal, deployment, maintenance workflows, environment variables, and operating model |
| [Performance and Resiliency](PERFORMANCE_AND_RESILIENCY.md) | CDN, caching, pagination, database indexes, Worker sharding, failure handling, and cost controls |
| [Observability](OBSERVABILITY.md) | Better Stack, Sentry, dashboards, structured logs, monitoring, and health checks |
| [Troubleshooting Guide](TROUBLESHOOTING.md) | Common production problems and how to diagnose them from one place |

---

## How to Use These Docs

Use the docs like this:

* Start with `PROJECT.md` when explaining what NutsNews is.
* Use `ARCHITECTURE.md` when making system or code changes.
* Use `OPERATIONS.md` when deploying or maintaining the platform.
* Use `PERFORMANCE_AND_RESILIENCY.md` when improving speed, cache HIT rate, database performance, Worker throughput, or reliability.
* Use `OBSERVABILITY.md` when debugging logs, dashboards, monitoring, or errors.
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
