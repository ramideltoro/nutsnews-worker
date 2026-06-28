# NutsNews

**NutsNews is a calm, mobile-first positive news platform.**

It collects uplifting stories from trusted RSS feeds, filters and summarizes them with AI, and sends readers back to the original publishers.

The project is built to stay simple, inexpensive, observable, and easy to operate.

---

## What NutsNews Does

| Area | Summary |
| --- | --- |
| Reader app | Positive news feed with search, translations, and fast article cards |
| Ingestion | Cloudflare Worker shards collect and process RSS feeds |
| AI review | Local AI first, with optional OpenAI fallback |
| Database | Supabase stores articles, feeds, reviews, usage, and snapshots |
| Admin | Protected dashboards for articles, feeds, Workers, AI, and guardrails |
| Reliability | CDN caching, public feed snapshots, monitoring, backups, and E2E tests |
| Cost model | Designed around free-tier services and local AI where possible |

---

## Repository Map

```text
nutsnews/
├── web/              # Next.js public site and admin portal
├── worker/           # Cloudflare Worker RSS ingestion engine
├── controller/       # Cloudflare Worker shard controller
├── local-ai-service/ # Home-server local AI endpoint
├── supabase/         # Database config, migrations, and restore validation
├── scripts/          # Operational and regression-test scripts
├── docs/             # Project documentation
├── README.md         # Project landing page
└── LICENSE           # MIT license
```

---

## Documentation

Start with the main docs index:

**[Open the NutsNews documentation map](docs/README.md)**

Common entry points:

| Need | Go to |
| --- | --- |
| Understand the product | [Project Overview](docs/PROJECT.md) |
| Understand the system | [Architecture](docs/ARCHITECTURE.md) |
| Run or maintain the app | [Operations](docs/OPERATIONS.md) |
| Deploy safely | [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) |
| Debug production issues | [Troubleshooting](docs/TROUBLESHOOTING.md) |
| Monitor free-tier risk | [Free-Tier Guardrails](docs/FREE_TIER_GUARDRAILS.md) |
| Use local AI | [Home Server Local AI](docs/HOME_SERVER_LOCAL_AI.md) |
| Validate public web flows | [Web Offline E2E Test](docs/WEB_OFFLINE_E2E_REGRESSION_TEST.md) |
| Validate Worker flows | [Worker Offline E2E Test](docs/WORKER_OFFLINE_E2E_REGRESSION_TEST.md) |

---

## Main Dashboards

| Dashboard | Route |
| --- | --- |
| Admin home | `/admin` |
| Article reviews | `/admin/articles` |
| AI usage | `/admin/ai-usage` |
| Local AI | `/admin/local-ai` |
| Home server | `/admin/home-server` |
| Worker shards | `/admin/shards` |
| Feed health | `/admin/feed-health` |
| Feed management | `/admin/feeds` |
| Free-tier guardrails | `/admin/guardrails` |

---

## Current Status

NutsNews includes:

- Mobile-first public feed
- Full archive search
- Multi-language article summaries
- Local AI review and summary support
- OpenAI fallback support
- Cloudflare Worker shard processing
- Supabase public feed snapshots
- Protected admin dashboards
- CDN caching and image delivery controls
- Better Stack, Sentry, UptimeRobot, Grafana, Lighthouse, PageSpeed, and accessibility documentation
- Supabase backup and restore runbooks
- Offline mocked E2E tests for the web app and Worker

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
