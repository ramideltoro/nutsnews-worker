# Home Server Admin Dashboard

NutsNews includes a protected admin dashboard for monitoring the home server that runs local AI.

Dashboard route:

```text
/admin/home-server
```

Stats source:

```text
GET https://ai.nutsnews.com/stats
Header: x-nutsnews-ai-key: <HOME_SERVER_STATS_API_KEY>
```

The dashboard is designed for owner/admin use only. The browser never receives the API key. The Next.js admin page fetches stats server-side using server-only environment variables.

Related monitoring:

```text
docs/GRAFANA_BACKUP_MONITORING.md
```

Use Grafana Cloud for backup time-series metrics such as last backup success, last successful backup time, backup age, available backup count, and next scheduled backup time. Use `/admin/home-server` for live instance/service health.

---

## What the Dashboard Shows

The first version focuses on instance-level health and the local AI runtime:

```text
Server identity:
- hostname
- OS platform
- CPU architecture
- Linux kernel
- server uptime
- local AI service process start time

CPU:
- CPU model
- CPU thread count
- 1-minute load average
- 5-minute load average
- 15-minute load average
- normalized load percentage

Memory:
- total memory
- used memory
- available memory
- memory usage percentage
- swap total/free/used

Disk:
- root filesystem
- root mount point
- total root disk size
- used root disk size
- available root disk size
- disk usage percentage

Services:
- ollama
- nutsnews-local-ai
- cloudflared

Local AI runtime:
- service port
- Ollama URL
- default model
- request timeout
- max article character cap
- model keep-alive
- context size
- output token cap
- temperature

Ollama:
- Ollama HTTP health
- installed models
- model sizes
- model modified time

Node process:
- Node.js version
- process ID
- process uptime
- process memory usage
```

---

## Architecture

```text
NutsNews admin user
  ↓ browser session
/admin/home-server
  ↓ server-side Next.js fetch
HOME_SERVER_STATS_URL + HOME_SERVER_STATS_API_KEY
  ↓ HTTPS + x-nutsnews-ai-key
https://ai.nutsnews.com/stats
  ↓ Cloudflare Tunnel
home server: chingadera
  ↓ localhost
local-ai-service /stats
  ↓ local system files + systemctl + Ollama tags
CPU / memory / disk / services / models
```

The public browser request only reaches the protected NutsNews admin page. The sensitive stats API key stays in server-side environment variables.

---

## Files Added or Updated

```text
local-ai-service/server.mjs
local-ai-service/.env.example
web/lib/adminHomeServer.ts
web/app/admin/(protected)/home-server/page.tsx
web/app/admin/(protected)/page.tsx
```

### `local-ai-service/server.mjs`

Adds:

```text
GET /stats
```

The stats route:

* Requires `x-nutsnews-ai-key`.
* Uses the same secret as `/review`.
* Returns JSON only.
* Does not expose shell access.
* Reads basic Linux health data.
* Checks critical systemd services.
* Checks Ollama model availability.

### `web/lib/adminHomeServer.ts`

Adds the server-side helper used by the admin page.

It reads:

```text
HOME_SERVER_STATS_URL
HOME_SERVER_STATS_API_KEY
```

Fallback behavior:

```text
HOME_SERVER_STATS_URL defaults to https://ai.nutsnews.com/stats
HOME_SERVER_STATS_API_KEY can fall back to LOCAL_AI_API_KEY if present
```

The helper normalizes the stats payload before the admin page renders it.

### `web/app/admin/(protected)/home-server/page.tsx`

Adds the protected dashboard page.

The page is dynamic and runs on Node.js:

```ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
```

This keeps the stats fresh and allows secure server-side environment access.

### `web/app/admin/(protected)/page.tsx`

Adds a new live admin card:

```text
Home Server → /admin/home-server
```

---

## Local AI Service `/stats` Endpoint

### Request

```bash
LOCAL_AI_API_KEY="$(ssh rami@192.168.1.115 "grep '^LOCAL_AI_API_KEY=' /opt/nutsnews/local-ai-service/.env | cut -d= -f2-")"

curl -s https://ai.nutsnews.com/stats \
  -H "x-nutsnews-ai-key: $LOCAL_AI_API_KEY" \
  | python3 -m json.tool
```

### Successful Response Example

```json
{
  "ok": true,
  "service": "nutsnews-local-ai-service",
  "server": {
    "hostname": "chingadera",
    "platform": "linux",
    "arch": "x64",
    "kernel": "7.0.0-22-generic",
    "uptimeSeconds": 9778
  },
  "cpu": {
    "model": "AMD Ryzen 7 5800H with Radeon Graphics",
    "threads": 16,
    "loadAverage": {
      "oneMinute": 0.47,
      "fiveMinute": 0.28,
      "fifteenMinute": 0.27,
      "normalizedOneMinutePercent": 3
    }
  },
  "memory": {
    "totalBytes": 63092441088,
    "usedBytes": 1207713792,
    "availableBytes": 61884727296,
    "usagePercent": 2
  },
  "disk": {
    "filesystem": "/dev/nvme0n1p2",
    "mount": "/",
    "totalBytes": 1966736678912,
    "usedBytes": 20122255360,
    "availableBytes": 1846634172416,
    "usagePercent": 2
  },
  "services": [
    { "name": "ollama", "active": true, "status": "active" },
    { "name": "nutsnews-local-ai", "active": true, "status": "active" },
    { "name": "cloudflared", "active": true, "status": "active" }
  ],
  "localAi": {
    "defaultModel": "qwen2.5:3b",
    "maxArticleChars": 3000,
    "keepAlive": "30m",
    "numCtx": 2048,
    "numPredict": 180,
    "temperature": 0
  },
  "ollama": {
    "ok": true,
    "status": 200,
    "models": [
      {
        "name": "qwen2.5:3b",
        "size": 1929912432
      }
    ]
  }
}
```

---

## Required Environment Variables

### Local development

File:

```text
web/.env.local
```

Required values:

```text
HOME_SERVER_STATS_URL=https://ai.nutsnews.com/stats
HOME_SERVER_STATS_API_KEY=<same value as LOCAL_AI_API_KEY on the home server>
```

Safe local update command:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/web

export HOME_SERVER_STATS_API_KEY="$(ssh rami@192.168.1.115 "grep '^LOCAL_AI_API_KEY=' /opt/nutsnews/local-ai-service/.env | cut -d= -f2-")"

python3 <<'PY'
from pathlib import Path
import os

env_path = Path(".env.local")
existing = env_path.read_text().splitlines() if env_path.exists() else []

updates = {
    "HOME_SERVER_STATS_URL": "https://ai.nutsnews.com/stats",
    "HOME_SERVER_STATS_API_KEY": os.environ["HOME_SERVER_STATS_API_KEY"],
}

kept = []
seen = set()

for line in existing:
    if "=" not in line or line.strip().startswith("#"):
        kept.append(line)
        continue

    key = line.split("=", 1)[0]
    if key in updates:
        kept.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        kept.append(line)

for key, value in updates.items():
    if key not in seen:
        kept.append(f"{key}={value}")

env_path.write_text("\n".join(kept).rstrip() + "\n")
PY

grep -E '^HOME_SERVER_STATS_' .env.local | sed 's/^HOME_SERVER_STATS_API_KEY=.*/HOME_SERVER_STATS_API_KEY=<hidden>/'
```

Do not commit `.env.local`.

### Production on Vercel

Add both as Production environment variables:

```text
HOME_SERVER_STATS_URL=https://ai.nutsnews.com/stats
HOME_SERVER_STATS_API_KEY=<same value as LOCAL_AI_API_KEY on the home server>
```

Using Vercel CLI:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/web

vercel env add HOME_SERVER_STATS_URL production
vercel env add HOME_SERVER_STATS_API_KEY production
```

When entering `HOME_SERVER_STATS_API_KEY`, paste the secret value only into Vercel. Do not paste it into Git, docs, chat, or logs.

---

## Deploy the Updated Local AI Service

The dashboard requires the updated local AI service because `/stats` lives in `local-ai-service/server.mjs`.

From the Mac:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

rsync -av local-ai-service/ rami@192.168.1.115:/opt/nutsnews/local-ai-service/

ssh -t rami@192.168.1.115 "cd /opt/nutsnews/local-ai-service && npm install && sudo systemctl restart nutsnews-local-ai && sleep 3 && sudo systemctl status nutsnews-local-ai --no-pager"
```

Then verify:

```bash
LOCAL_AI_API_KEY="$(ssh rami@192.168.1.115 "grep '^LOCAL_AI_API_KEY=' /opt/nutsnews/local-ai-service/.env | cut -d= -f2-")"

curl -s https://ai.nutsnews.com/stats \
  -H "x-nutsnews-ai-key: $LOCAL_AI_API_KEY" \
  | python3 -m json.tool
```

---

## Local Dashboard Test

From the web app:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/web
npm run dev
```

Open:

```text
http://localhost:3000/admin/home-server
```

Expected dashboard cards:

```text
Hostname: chingadera
CPU Threads: 16
Memory Used
Disk Used
ollama: active
nutsnews-local-ai: active
cloudflared: active
Default Model: qwen2.5:3b
```

---

## Validation Commands

Before committing:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

node --check local-ai-service/server.mjs

cd web
npx tsc --noEmit
npm run build
```

A successful build should include:

```text
/admin/home-server
```

---

## Commit Checklist

Do commit:

```text
local-ai-service/.env.example
local-ai-service/server.mjs
web/lib/adminHomeServer.ts
web/app/admin/(protected)/home-server/page.tsx
web/app/admin/(protected)/page.tsx
docs/HOME_SERVER_DASHBOARD.md
docs/HOME_SERVER_LOCAL_AI.md
docs/README.md
README.md
```

Do not commit:

```text
web/.env.local
real HOME_SERVER_STATS_API_KEY value
real LOCAL_AI_API_KEY value
private SSH keys
Cloudflare API tokens
```

---

## Troubleshooting

### The dashboard says `Missing HOME_SERVER_STATS_API_KEY`

Add the server-side environment variable to local `.env.local` or Vercel Production env vars.

### The dashboard says `Unauthorized`

The value in `HOME_SERVER_STATS_API_KEY` does not match `LOCAL_AI_API_KEY` on the home server.

Fix by copying the current home-server key into the web environment variable.

### `https://ai.nutsnews.com/stats` returns 404

The updated `local-ai-service/server.mjs` has not been copied to the home server or the service has not been restarted.

Run:

```bash
rsync -av /Users/ramideltoro/WebstormProjects/nutsnews2/local-ai-service/ \
  rami@192.168.1.115:/opt/nutsnews/local-ai-service/

ssh -t rami@192.168.1.115 "sudo systemctl restart nutsnews-local-ai"
```

### `cloudflared` is inactive

Check the Cloudflare Tunnel service on the server:

```bash
ssh rami@192.168.1.115
systemctl status cloudflared --no-pager
```

If the tunnel is down, the Worker and admin dashboard cannot reach `ai.nutsnews.com` even if the local service is running.

### Memory or disk usage is high

Use:

```bash
ssh rami@192.168.1.115
htop
df -h /
free -h
```

The dashboard is a fast warning signal. Use SSH for deeper investigation.

---

## Security Notes

The stats endpoint reveals operational details about the home server, so it must remain protected.

Current protections:

```text
/stats requires x-nutsnews-ai-key
local service listens only on 127.0.0.1
public access goes through Cloudflare Tunnel
admin dashboard requires Google-protected NutsNews admin auth
stats API key is read server-side only
```

Do not make `/stats` public without authentication.

---

## Future Improvements

Possible future dashboard additions:

* CPU temperature.
* GPU/ROCm utilization if available.
* Ollama request queue depth.
* Last local AI review latency from Supabase.
* Historical charts stored in Supabase.
* Alerts when `ollama`, `cloudflared`, or `nutsnews-local-ai` goes inactive.
* Grafana Cloud backup freshness alerts.
* Better Stack heartbeat from the home server.
