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
| Better Stack Logs | Centralized structured logs |
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
