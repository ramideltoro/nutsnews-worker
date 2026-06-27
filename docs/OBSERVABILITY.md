# Observability

NutsNews is built with observability from the start.

A fully automated system needs visibility. If no human manually publishes every article, the platform needs to explain what it is doing.

---

## Observability Layers

NutsNews uses multiple observability layers:

| Layer | Purpose |
| --- | --- |
| Admin Portal | Internal operational dashboards |
| AI Usage Dashboard | OpenAI usage and cost visibility |
| Worker Shard Dashboard | Worker health and failed run visibility |
| Feed Health Dashboard | RSS source quality visibility |
| Better Stack Uptime | External availability monitoring |
| UptimeRobot | Additional external availability, keyword, API, and public page monitoring |
| Lighthouse CI | GitHub Actions quality checks for public web performance, accessibility, SEO, best practices, and Core Web Vitals-style regressions |
| Better Stack Logs | Centralized structured logs |
| Grafana Cloud | Prometheus metrics, Explore queries, backup dashboard panels, and backup alerts |
| Sentry | Application error monitoring |
| Cloudflare | CDN and Worker visibility |
| Vercel | Deployment and frontend runtime visibility |
| Supabase | Database state and operational tables |

---

## Centralized Logging

NutsNews sends structured logs to Better Stack.

Service names:

```text
nutsnews-web
nutsnews-worker
nutsnews-controller
```

Important log fields:

| Field | Purpose |
| --- | --- |
| `level` | Severity such as info, warn, or error |
| `service` | Which part of the platform created the log |
| `event` | What happened |
| `message` | Human-readable summary |
| `environment` | Production, preview, or local |
| `shardIndex` | Which Worker shard produced the log |
| `durationMs` | How long an operation took |
| `status` | Request or operation status |
| `acceptedCount` | Number of accepted articles |
| `rejectedCount` | Number of rejected articles |

---

## Better Stack Uptime

Better Stack Uptime checks whether the public site is reachable from outside the platform.

Use it to answer:

```text
Is the site reachable?
```

---

## UptimeRobot

UptimeRobot is an additional external monitoring layer for simple public uptime and content checks.

Recommended first monitors:

| Monitor name | Type | URL |
| --- | --- | --- |
| `NutsNews Website` | HTTP(s) | `https://www.nutsnews.com` |
| `NutsNews Homepage Content` | Keyword | `https://www.nutsnews.com` |
| `NutsNews Articles API` | HTTP(s) or API GET | `https://www.nutsnews.com/api/articles?limit=1` |
| `NutsNews Privacy Page` | HTTP(s) | `https://www.nutsnews.com/privacy` |
| `NutsNews Contact Page` | HTTP(s) | `https://www.nutsnews.com/contact` |

The homepage keyword monitor should alert when this keyword is missing:

```text
NutsNews
```

Important safety rule: do not monitor refresh-triggering Worker or controller URLs such as `/?limit=1` or `/?shard=0`. Those URLs can run production ingestion work. Only add Worker/controller monitors after safe read-only `/health` routes exist.

Detailed setup lives in:

```text
docs/UPTIMEROBOT_ONBOARDING.md
```

## Lighthouse CI

Lighthouse CI is the automated web quality gate for NutsNews public pages.

It runs in GitHub Actions and checks:

* Performance
* Accessibility
* Best practices
* SEO
* Largest Contentful Paint
* Cumulative Layout Shift
* Total Blocking Time

Repository-layout rule:

```text
GitHub Actions workflow: .github/workflows/lighthouse-ci.yml
Lighthouse config: web/lighthouserc.js
NPM install/build/start commands: run from web/
```

Recommended first audited URLs:

```text
http://localhost:3000/
http://localhost:3000/privacy
http://localhost:3000/contact
```

Do not audit Worker refresh URLs, controller trigger URLs, admin pages, OAuth routes, or any route that can perform ingestion, AI review, translation, refresh work, database writes, or authenticated work.

Detailed setup lives in:

```text
docs/LIGHTHOUSE_CI_ONBOARDING.md
```

## axe Playwright Accessibility CI

axe Playwright Accessibility CI answers:

```text
Did a public NutsNews page introduce a serious or critical automated accessibility regression?
```

It runs from GitHub Actions using Playwright and `@axe-core/playwright`.

Checked pages:

```text
http://127.0.0.1:3100/
http://127.0.0.1:3100/about
http://127.0.0.1:3100/privacy
http://127.0.0.1:3100/contact
```

Repository-layout rule:

```text
GitHub Actions workflow: .github/workflows/accessibility-ci.yml
Playwright config: web/playwright.config.ts
axe test file: web/tests/accessibility.spec.ts
NPM install/build/test commands: run from web/
```

The first threshold fails on only serious and critical axe violations. This keeps CI practical while still catching the issues most likely to hurt launch quality, App Store review polish, and reader usability.

Do not audit Worker refresh URLs, controller trigger URLs, admin pages, OAuth routes, or routes that can perform ingestion, AI review, translation, refresh work, database writes, or authenticated work.

Detailed setup lives in:

```text
docs/AXE_PLAYWRIGHT_ACCESSIBILITY_CI.md
```

Manual WAVE browser-extension checks should still be run before App Store review and major public launches.

## Better Stack Logs

Better Stack Logs answer:

```text
What happened inside the app, Worker, or controller?
```

Useful searches:

```text
service:nutsnews-web
service:nutsnews-worker
service:nutsnews-controller
level:error
shardIndex:0
event:api.log_test.completed
```

---

## Grafana Cloud

Grafana Cloud is used for Prometheus metrics that are better represented as time series than logs.

Current home-server backup monitoring uses this Prometheus data source:

```text
grafanacloud-kindcantaloupe2036-prom
```

Confirmed backup metric query:

```promql
home_server_backup_last_success{instance="chingadera", job="integrations/unix"}
```

Confirmed value meaning:

```text
1 = last backup succeeded
0 = last backup failed
```

Detailed Grafana Explore queries, dashboard setup, and alert ideas live in:

```text
docs/GRAFANA_BACKUP_MONITORING.md
```

---

## Sentry

Sentry tracks frontend, runtime, and Worker errors.

Use it to answer:

```text
What errors happened in production?
```

Important env vars:

```text
NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
SENTRY_DSN
```

---

## Admin Dashboards

### `/admin/ai-usage`

Answers:

* Is OpenAI usage controlled?
* What is the estimated cost?
* Which shards are using AI?
* Did cost protection trigger?

### `/admin/shards`

Answers:

* Are Worker shards healthy?
* Which shards are stale?
* Which runs failed?
* What was the latest error?

### `/admin/feed-health`

Answers:

* Which feeds fail often?
* Which feeds lack thumbnails?
* Which feeds produce accepted articles?

### `/admin/feeds`

Answers:

* Which feeds are active?
* Which feeds are disabled?
* Which feeds should be enabled or disabled?

### Grafana Cloud: `Home Server Backups`

Answers:

* Did the last backup succeed?
* When was the last successful backup?
* How old is the newest successful backup?
* How many backups are available now?
* When is the next backup expected, if exported by the backup script?

---

## Health Check Commands

### Public site

```bash
curl -I "https://www.nutsnews.com/"
```

### Article API

```bash
curl -s "https://www.nutsnews.com/api/articles?page=0"
```

### UptimeRobot validation set

```bash
curl -I "https://www.nutsnews.com/"
curl -s "https://www.nutsnews.com/" | grep -i "NutsNews"
curl -s "https://www.nutsnews.com/api/articles?limit=1"
curl -I "https://www.nutsnews.com/privacy"
curl -I "https://www.nutsnews.com/contact"
```

### Cache

```bash
./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com
```

### Worker

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

### Controller

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
```

### Better Stack web log test

```bash
curl "https://www.nutsnews.com/api/log-test"
```

### Grafana backup metric discovery

Run this in Grafana Cloud Explore, not in the terminal:

```promql
{__name__=~"home_server_backup_.*", instance="chingadera", job="integrations/unix"}
```

### Grafana last backup success

Run this in Grafana Cloud Explore:

```promql
home_server_backup_last_success{instance="chingadera", job="integrations/unix"}
```

---

## Controller and Shard Debugging

Detailed manual commands live in:

```text
docs/CONTROLLER_AND_SHARDS.md
```

Useful Better Stack searches:

```text
service:nutsnews-controller
service:nutsnews-controller level:warn
service:nutsnews-controller level:error
service:nutsnews-worker shardIndex:0
service:nutsnews-worker level:error
```

Useful Wrangler tail commands:

```bash
cd controller && npx wrangler tail nutsnews-controller
cd worker && npx wrangler tail --config generated-wrangler/wrangler.shard0.jsonc
```
