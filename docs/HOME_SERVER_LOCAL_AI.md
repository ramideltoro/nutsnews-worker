# Home Server Local AI Provider

NutsNews can now review candidate RSS articles using a home-server local AI stack instead of sending every candidate directly to OpenAI.

The current production rollout uses a private home server, Ollama, qwen2.5:3b, Cloudflare Tunnel, Cloudflare Worker shards, Cloudflare Secrets Store, Supabase tracking, and OpenAI fallback.

```text
Cloudflare Worker Shards
  ↓ HTTPS + x-nutsnews-ai-key
https://ai.nutsnews.com
  ↓ Cloudflare Tunnel
Home server: chingadera
  ↓ localhost only
local-ai-service on 127.0.0.1:8788
  ↓ localhost only
Ollama on 127.0.0.1:11434
  ↓ qwen2.5:3b
Supabase article_ai_reviews / articles / ai_usage_runs / worker_runs
```

OpenAI remains available as a safety fallback. If the home AI service is offline, slow, or returns an invalid response, the Worker can fall back to OpenAI rather than losing the article review run.

---

## Current Production Status

The home-server local AI path has been tested end to end.

Verified worker run result from shard 1:

```json
{
  "feedCount": 10,
  "feedFetchSuccessCount": 10,
  "fetchedCount": 166,
  "unreviewedCount": 98,
  "eligibleForAiCount": 35,
  "aiReviewedCount": 1,
  "aiProvider": "local",
  "localAiModel": "qwen2.5:3b",
  "localAiCallCount": 1,
  "localAiPromptTokens": 299,
  "localAiCompletionTokens": 72,
  "localAiTotalTokens": 371,
  "localAiAcceptedCount": 1,
  "localAiRejectedCount": 0,
  "localAiDurationMs": 4806,
  "acceptedCount": 1,
  "openAiCallCount": 0,
  "estimatedOpenAiCostUsd": 0,
  "durationMs": 8873
}
```

That confirms this full path works:

```text
Cloudflare Worker → Secrets Store → ai.nutsnews.com → Cloudflare Tunnel → home server → Ollama/qwen2.5:3b → Supabase
```

---

## Why This Exists

The original local-AI plan considered an Oracle Always Free A1 VM. Oracle capacity was not available in the tested regions, and the home server is significantly stronger than the free Oracle VM target.

The home-server approach gives NutsNews:

* Lower OpenAI usage and cost.
* Local control of the model runtime.
* Better hardware than the unavailable free Oracle A1 capacity.
* A safe fallback path to OpenAI.
* A real production-quality test of hybrid serverless plus self-hosted AI.

This is not a user-facing dependency. It is a background Worker review path. The public NutsNews site can keep serving cached and stored stories even if the local AI service is temporarily offline.

---

## Server Inventory

Current server details:

```text
Hostname: chingadera
User: rami
LAN IP: 192.168.1.115
Network interface: enp1s0
Ethernet MAC: b0:41:6f:0d:66:26
OS: Ubuntu Server 26.04 LTS
CPU: AMD Ryzen 7 5800H
CPU layout: 8 cores / 16 threads
RAM: about 58 GiB
Disk: about 1.8 TiB NVMe
```

Security baseline:

```text
SSH key login: enabled
SSH password login: disabled
UFW firewall: enabled
UFW incoming default: deny
UFW outgoing default: allow
Allowed inbound service: OpenSSH only
AI service public access: through Cloudflare Tunnel only
AI service local bind: localhost
```

The server has a router DHCP reservation so `192.168.1.115` remains stable after reboot.

---

## Local Services

### Ollama

Ollama runs as a system service and hosts the local model.

Current model:

```text
qwen2.5:3b
```

Useful commands on the server:

```bash
systemctl status ollama --no-pager
ollama list
ollama run qwen2.5:3b "Reply with exactly one word: ready"
```

Local HTTP test:

```bash
curl -s http://localhost:11434/api/generate \
  -d '{"model":"qwen2.5:3b","prompt":"Reply with exactly one word: ready","stream":false}' \
  | python3 -m json.tool
```

### NutsNews Local AI Service

Service path:

```text
/opt/nutsnews/local-ai-service
```

Systemd service:

```text
nutsnews-local-ai.service
```

Service runtime:

```text
Node.js service wrapping Ollama with a NutsNews-compatible /review API
```

Current `.env` shape:

```bash
PORT=8788
LOCAL_AI_API_KEY=<redacted>
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
REQUEST_TIMEOUT_MS=120000
MAX_ARTICLE_CHARS=3000
ACCEPTED_SUMMARY_MIN_CHARS=260
ACCEPTED_SUMMARY_MAX_CHARS=340
TRANSLATION_SUMMARY_MAX_CHARS=250
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_PREDICT=320
OLLAMA_TEMPERATURE=0
```

Never commit or paste the real `LOCAL_AI_API_KEY`.

Useful commands on the server:

```bash
sudo systemctl status nutsnews-local-ai --no-pager
sudo systemctl restart nutsnews-local-ai
sudo journalctl -u nutsnews-local-ai -n 100 --no-pager
curl -s http://127.0.0.1:8788/health | python3 -m json.tool
```

The service now exposes two Worker-facing AI endpoints:

```text
POST /review
POST /translate
```

`POST /translate` is used for article card translations. The Worker calls it before OpenAI, retries once if it fails, and then falls back to OpenAI so missing home-server translations do not block new articles.

Local translation test from the home server:

```bash
AI_KEY="$(sudo grep '^LOCAL_AI_API_KEY=' /opt/nutsnews/local-ai-service/.env | cut -d= -f2-)"

curl -s -X POST http://127.0.0.1:8788/translate \
  -H "content-type: application/json" \
  -H "x-nutsnews-ai-key: ${AI_KEY}" \
  -d '{
    "model":"qwen2.5:3b",
    "language_code":"fr",
    "source":"NutsNews Test",
    "title":"Community garden brings neighbors together",
    "summary":"A neighborhood garden is helping families spend time outside, learn about plants, and share peaceful moments together.",
    "category":"Community"
  }' | python3 -m json.tool
```

---

### AI Summary Length

Accepted Qwen/Ollama article reviews now return site summaries in the 260-340 character range. The local AI prompt explicitly rejects the old 150-160 character pattern, and the Node service normalizes accepted responses before sending them back to the Worker. Rejected articles still return an empty summary.

The `/review` response also includes these debugging fields so it is obvious which code is running on the home server:

```json
{
  "summary_length": 286,
  "accepted_summary_min_chars": 260,
  "accepted_summary_max_chars": 340
}
```

If `summary_length` is missing, or the min/max values still show `240` and `300`, the home server is still running an older copy of `local-ai-service/server.mjs` or an older `.env`.

The default limits are configurable from the local AI service environment:

```bash
ACCEPTED_SUMMARY_MIN_CHARS=260
ACCEPTED_SUMMARY_MAX_CHARS=340
OLLAMA_NUM_PREDICT=320
```

`OLLAMA_NUM_PREDICT` is set higher than before so the JSON response has enough room for the longer summary, category, score, reason, and summary length metadata.

---

## Public Access Through Cloudflare Tunnel

The AI service is not exposed by opening router ports. Cloudflare Tunnel connects outbound from the home server to Cloudflare and maps a public hostname to the local service.

Current tunnel details:

```text
Tunnel name: nutsnews-home-ai
Tunnel ID: d3b713fa-266c-46d6-93ef-bd2998ab9b49
Public hostname: ai.nutsnews.com
Tunnel service target: http://localhost:8788
```

Public health check:

```bash
curl -s https://ai.nutsnews.com/health | python3 -m json.tool
```

Expected shape:

```json
{
  "ok": true,
  "service": "nutsnews-local-ai-service",
  "ollamaUrl": "http://127.0.0.1:11434",
  "defaultModel": "qwen2.5:3b",
  "availableModels": ["qwen2.5:3b"]
}
```

---

## Home Server Dashboard

The local AI home server is also monitored from a protected NutsNews admin dashboard:

```text
/admin/home-server
```

The dashboard reads from the protected local AI service stats endpoint:

```text
GET https://ai.nutsnews.com/stats
Header: x-nutsnews-ai-key: <HOME_SERVER_STATS_API_KEY>
```

It shows server identity, uptime, CPU load, memory usage, root disk usage, critical systemd services, Ollama status, installed models, and local AI runtime settings.

Required web environment variables:

```text
HOME_SERVER_STATS_URL=https://ai.nutsnews.com/stats
HOME_SERVER_STATS_API_KEY=<same value as LOCAL_AI_API_KEY on the home server>
```

For full setup, deployment, and troubleshooting details, see [Home Server Admin Dashboard](HOME_SERVER_DASHBOARD.md).

---

## Local AI Review API

The Worker calls:

```text
POST https://ai.nutsnews.com/review
Header: x-nutsnews-ai-key: <LOCAL_AI_API_KEY>
```

Example request from a trusted machine:

```bash
LOCAL_AI_API_KEY="$(ssh rami@192.168.1.115 "grep '^LOCAL_AI_API_KEY=' /opt/nutsnews/local-ai-service/.env | cut -d= -f2-")"

curl -s -X POST https://ai.nutsnews.com/review \
  -H "content-type: application/json" \
  -H "x-nutsnews-ai-key: $LOCAL_AI_API_KEY" \
  --data '{
    "title": "Students build free library boxes for their neighborhood",
    "source": "NutsNews Speed Test",
    "url": "https://www.nutsnews.com/test-speed",
    "excerpt": "A group of students worked together to build and paint small free library boxes for their neighborhood, giving families easier access to books and encouraging children to read more."
  }' | python3 -m json.tool
```

Expected response shape:

```json
{
  "provider": "local",
  "ai_provider": "local",
  "model": "qwen2.5:3b",
  "ai_model": "qwen2.5:3b",
  "decision": "accept",
  "category": "community-focused",
  "positivity_score": 9,
  "summary": "Students built free book libraries in their community, promoting reading and literacy.",
  "reason": "Positive, uplifting story about students contributing to their community.",
  "prompt_tokens": 266,
  "completion_tokens": 64,
  "total_tokens": 330,
  "duration_ms": 8236
}
```

Actual speed varies by article length, model load state, and server load. In production testing, the local model path has completed in about 4.8 seconds for a Worker review and about 8.2 seconds for a direct public endpoint test.

---

## Cloudflare Worker Configuration

The Worker supports both OpenAI and local AI providers.

Current production Worker variables:

```text
AI_PROVIDER=local
LOCAL_AI_URL=https://ai.nutsnews.com
LOCAL_AI_MODEL=qwen2.5:3b
AI_PROVIDER_FALLBACK_TO_OPENAI=true
AI_REVIEW_CONCURRENCY=1
```

Current production Worker secret binding:

```text
LOCAL_AI_API_KEY
```

The secret is stored in Cloudflare Secrets Store:

```text
Secrets Store ID: 0d4e0e193d414b9f8bcbca44c6af24f9
Secret name: LOCAL_AI_API_KEY
```

The generated Wrangler configs bind the secret without storing the secret value in Git.

---

## Regenerate Worker Shard Configs

From the Mac repo:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

export NUTSNEWS_SECRETS_STORE_ID="0d4e0e193d414b9f8bcbca44c6af24f9"
export ENABLE_LOCAL_AI_SECRET_BINDING="true"
export AI_PROVIDER="local"
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_MODEL="qwen2.5:3b"
export AI_PROVIDER_FALLBACK_TO_OPENAI="true"
export AI_REVIEW_CONCURRENCY="1"

npm run generate:wrangler
```

Verify shard config:

```bash
grep -n "AI_PROVIDER\|LOCAL_AI_URL\|LOCAL_AI_MODEL\|AI_PROVIDER_FALLBACK_TO_OPENAI\|AI_REVIEW_CONCURRENCY\|LOCAL_AI_API_KEY" \
  generated-wrangler/wrangler.shard0.jsonc
```

Expected values:

```text
AI_PROVIDER=local
LOCAL_AI_URL=https://ai.nutsnews.com
LOCAL_AI_MODEL=qwen2.5:3b
AI_PROVIDER_FALLBACK_TO_OPENAI=true
AI_REVIEW_CONCURRENCY=1
LOCAL_AI_API_KEY binding from Secrets Store
```

---

## Deploy Worker Shards

Deploy one shard first:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

npx wrangler deploy --config generated-wrangler/wrangler.shard0.jsonc
```

Deploy all 25 shards:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

for i in {0..24}; do
  echo "Deploying shard $i..."
  npx wrangler deploy --config "generated-wrangler/wrangler.shard${i}.jsonc" || exit 1
done
```

Each deployed shard should show bindings similar to:

```text
env.LOCAL_AI_API_KEY (...) Secrets Store Secret
env.AI_PROVIDER ("local")
env.LOCAL_AI_URL ("https://ai.nutsnews.com")
env.LOCAL_AI_MODEL ("qwen2.5:3b")
env.AI_PROVIDER_FALLBACK_TO_OPENAI ("true")
env.AI_REVIEW_CONCURRENCY ("1")
```

---

## Manual Worker Test

Run a shard manually:

```bash
curl "https://nutsnews-worker-1.nutsnews.workers.dev/?limit=1"
```

Successful local AI fields:

```json
{
  "aiProvider": "local",
  "localAiModel": "qwen2.5:3b",
  "localAiCallCount": 1,
  "localAiDurationMs": 4806,
  "openAiCallCount": 0,
  "estimatedOpenAiCostUsd": 0
}
```

If `localAiCallCount` is `0`, check the rest of the response before assuming local AI failed. Common legitimate reasons:

```text
unreviewedCount=0        → no new article URLs to review
eligibleForAiCount=0     → all new URLs were filtered out before AI
feedCount=0              → that shard has no active feeds
noThumbnailRejectedCount → articles were skipped because thumbnails were missing
```

---

## Feed Activation Used During Testing

At the time of rollout, the database had hundreds of RSS feed rows but only 20 active feeds. Since each shard uses `FEEDS_PER_SHARD=20`, shard 0 had feeds and shard 1 initially had no feeds.

A small set of existing inactive feeds was activated to give shard 1 real work:

```sql
update public.rss_feeds
set is_active = true,
    is_positive_source = true
where id in (
  528,
  529,
  535,
  536,
  537,
  539,
  540,
  545,
  557,
  560
);

select count(*) as active_feed_count
from public.rss_feeds
where is_active = true;

select id, source, url, is_active
from public.rss_feeds
where id in (528, 529, 535, 536, 537, 539, 540, 545, 557, 560)
order by id;
```

This made shard 1 fetch 10 feeds and successfully call local AI.

---

## Admin Dashboards

Relevant admin pages:

```text
/admin/local-ai      Local AI health, usage, fallback, latency, and model activity
/admin/articles      Accepted/rejected article decisions with provider/model metadata
/admin/ai-usage      OpenAI/local token and cost visibility
/admin/shards        Worker shard run status
/admin/feeds         Feed management
/admin/feed-health   RSS source health and output quality
```

The important fields to monitor are:

```text
ai_provider
ai_model
local_ai_call_count
local_ai_duration_ms
openai_call_count
estimated_openai_cost_usd
cost_protection_limit_reached
spike_warning_triggered
```

`spike_warning_triggered` can still be true during local AI mode when a run hits review-count alert thresholds. It does not automatically mean OpenAI was used. Check `openAiCallCount` and `estimatedOpenAiCostUsd`.

---

## Performance Notes

Current safe production defaults:

```text
Model: qwen2.5:3b
Worker AI review concurrency: 1
Service keep-alive: 30m
Article text cap: 3000 characters
Context window: 2048
Max generated tokens: 180
Temperature: 0
OpenAI fallback: enabled
```

Why concurrency is `1`:

* It protects the home server from many simultaneous model calls.
* It makes latency and failures easier to understand during rollout.
* The Worker can still process many RSS candidates, but AI reviews are capped per run.

Response time expectations:

```text
Under 3 seconds: excellent
3-8 seconds: good
8-15 seconds: acceptable for background processing
15+ seconds: investigate prompt size, model load, or server load
```

The local AI review does not need to be instant because it is a background ingestion task, not a user-facing page request.

---

## Security Notes

Important rules:

* Never commit `/opt/nutsnews/local-ai-service/.env`.
* Never paste the real `LOCAL_AI_API_KEY` into chat, Git, logs, or docs.
* Keep the local AI service bound to localhost behind Cloudflare Tunnel.
* Keep router inbound ports closed for the AI service.
* Keep UFW enabled.
* Keep `AI_PROVIDER_FALLBACK_TO_OPENAI=true` until local AI has been stable for a long time.
* Rotate `LOCAL_AI_API_KEY` if it is ever exposed.

---

## Rotate the Local AI API Key

On the server:

```bash
cd /opt/nutsnews/local-ai-service

NEW_LOCAL_AI_API_KEY="$(openssl rand -hex 32)"

awk -v key="$NEW_LOCAL_AI_API_KEY" 'BEGIN { FS=OFS="=" } $1=="LOCAL_AI_API_KEY" { $2=key } { print }' .env > .env.tmp
mv .env.tmp .env
chmod 600 .env

sudo systemctl restart nutsnews-local-ai

sed 's/^LOCAL_AI_API_KEY=.*/LOCAL_AI_API_KEY=<hidden>/' .env
```

Then update Cloudflare Secrets Store from the Mac. Copy the new key to the clipboard without printing it:

```bash
ssh rami@192.168.1.115 "grep '^LOCAL_AI_API_KEY=' /opt/nutsnews/local-ai-service/.env | cut -d= -f2-" | pbcopy
```

Update/create the Cloudflare secret:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

export NUTSNEWS_SECRETS_STORE_ID="0d4e0e193d414b9f8bcbca44c6af24f9"

npx wrangler secrets-store secret create "$NUTSNEWS_SECRETS_STORE_ID" \
  --name LOCAL_AI_API_KEY \
  --scopes workers \
  --remote
```

If the secret already exists and Wrangler refuses to create it again, delete or update it through Cloudflare’s dashboard/Secrets Store workflow, then redeploy one shard and test before redeploying all shards.

---

## Troubleshooting

### `https://ai.nutsnews.com/health` fails

Check the server:

```bash
ssh rami@192.168.1.115
systemctl is-active nutsnews-local-ai
systemctl is-active ollama
curl -s http://127.0.0.1:8788/health | python3 -m json.tool
sudo journalctl -u nutsnews-local-ai -n 100 --no-pager
```

Then check Cloudflare Tunnel health in Zero Trust.

### `/review` returns unauthorized

The Worker secret and home-server `.env` key do not match.

Fix by rotating or copying the current home-server key into Cloudflare Secrets Store.

### Worker shows `aiProvider: local` but `localAiCallCount: 0`

That can be normal. Check:

```text
unreviewedCount
eligibleForAiCount
noThumbnailRejectedCount
feedCount
alreadyReviewedCount
```

If there are no eligible new articles, the Worker will not call local AI.

### Worker falls back to OpenAI

Check:

```text
openAiCallCount
estimatedOpenAiCostUsd
localAiCallCount
```

Then check local AI service logs:

```bash
ssh rami@192.168.1.115
sudo journalctl -u nutsnews-local-ai -n 150 --no-pager
```

Common causes:

* Home server offline.
* Tunnel unhealthy.
* API key mismatch.
* Local model too slow on a large article.
* Invalid JSON from the local model.

### Local AI is slow

Start with:

```bash
ssh rami@192.168.1.115
htop
sudo journalctl -u ollama -n 120 --no-pager
sudo journalctl -u nutsnews-local-ai -n 120 --no-pager
```

Safe tuning options:

* Keep `MAX_ARTICLE_CHARS=3000`.
* Keep `OLLAMA_NUM_PREDICT=320` so Qwen has room for the 260-340 character summary plus JSON fields.
* Keep `AI_REVIEW_CONCURRENCY=1` until stable.
* Consider `qwen2.5:1.5b` only after comparing quality.

---

## Roll Back to OpenAI Mode

If the home-server AI path becomes unreliable, switch all Worker shards back to OpenAI mode.

From the Mac:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

export NUTSNEWS_SECRETS_STORE_ID="0d4e0e193d414b9f8bcbca44c6af24f9"
unset ENABLE_LOCAL_AI_SECRET_BINDING
export AI_PROVIDER="openai"
unset LOCAL_AI_URL
unset LOCAL_AI_MODEL
unset AI_PROVIDER_FALLBACK_TO_OPENAI
unset AI_REVIEW_CONCURRENCY

npm run generate:wrangler

for i in {0..24}; do
  echo "Deploying shard $i in OpenAI mode..."
  npx wrangler deploy --config "generated-wrangler/wrangler.shard${i}.jsonc" || exit 1
done
```

Then test:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Expected rollback signal:

```text
aiProvider: openai
```

---

## Recovery After Server Reboot

After rebooting the home server, verify:

```bash
ssh rami@192.168.1.115
systemctl is-active ollama
systemctl is-active nutsnews-local-ai
curl -s http://127.0.0.1:8788/health | python3 -m json.tool
```

From the Mac, verify public tunnel path:

```bash
curl -s https://ai.nutsnews.com/health | python3 -m json.tool
```

Then run one Worker shard:

```bash
curl "https://nutsnews-worker-1.nutsnews.workers.dev/?limit=1"
```

---

## What Should Stay in Git

Safe to commit:

```text
README.md
docs/HOME_SERVER_LOCAL_AI.md
docs/ORACLE_LOCAL_AI.md
docs/README.md
worker/generated-wrangler/wrangler.shard*.jsonc with secret binding names only
```

Do not commit:

```text
/opt/nutsnews/local-ai-service/.env
real LOCAL_AI_API_KEY values
machine-local .ai/ folders
Cloudflare account tokens
private SSH keys
```

## 2026-06 local-first review and translation fallback update

NutsNews can now run the full AI path through the home server first:

- Article review: Worker calls `POST /review` on the home server.
- If review fails, the Worker retries local review once.
- If local review still fails and fallback is enabled, the Worker calls OpenAI.
- Translation: Worker calls `POST /translate` on the home server, retries once if needed, then falls back to OpenAI.

Deploy with:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

export ENABLE_LOCAL_AI_SECRET_BINDING=true
export AI_PROVIDER="local"
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_MODEL="qwen2.5:3b"
export AI_PROVIDER_FALLBACK_TO_OPENAI=true
export AI_REVIEW_CONCURRENCY=1
export ENABLED_SUMMARY_LANGUAGES="fr,ja,de-CH,de,el"
export SUMMARY_TRANSLATION_LIMIT=12

npm ci
npx tsc --noEmit
npm run generate:wrangler
npm run deploy:all
```

Expected successful local-first logs:

```text
worker.local_ai.article_reviewed
worker.translation.local.article_summary_translated
worker.translation.local.article_summary_translated
```

Expected fallback logs only when the home server fails:

```text
worker.local_ai.fallback_to_openai
worker.openai.article_reviewed
```

## Deployment lock

Worker shard deployments are locked to local AI by default. Before deploying shards, confirm `worker/.env.deploy.local` contains `AI_PROVIDER=local`, `LOCAL_AI_URL`, `AI_PROVIDER_FALLBACK_TO_OPENAI=true`, `AI_REVIEW_CONCURRENCY=1`, and `ENABLE_LOCAL_AI_SECRET_BINDING=true`.

Use:

```bash
cd worker
npm run check:local-ai-config
npm run deploy:all
```

See [Local AI Deployment Lock](LOCAL_AI_DEPLOYMENT_LOCK.md) for the full guardrail and post-deploy checks.
