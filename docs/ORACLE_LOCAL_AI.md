# Oracle Local AI Provider

> **Current production note:** NutsNews currently uses the home-server local AI setup documented in [Home Server Local AI Provider](HOME_SERVER_LOCAL_AI.md). This Oracle document remains as an alternative runbook if Oracle Free Tier capacity becomes available later.

This document describes the Oracle Free Tier alternative for running article review through a local AI service instead of sending every candidate article directly to OpenAI.

The Oracle alternative design is intentionally simple:

```text
Cloudflare Worker Shards
  ↓ HTTPS + API key
Oracle Free Tier VM
  ↓ localhost
Ollama
  ↓
qwen2.5:3b or another local model
  ↓
Supabase article_ai_reviews / articles / ai_usage_runs
```

OpenAI support remains in place. The worker can run in OpenAI mode, local AI mode, or local AI mode with OpenAI fallback.

---

## What This Oracle Alternative Adds

### Worker

The Worker supports these variables:

```text
AI_PROVIDER=openai | local
LOCAL_AI_URL=https://ai.nutsnews.com
LOCAL_AI_MODEL=qwen2.5:3b
AI_REVIEW_CONCURRENCY=1
AI_PROVIDER_FALLBACK_TO_OPENAI=true | false
```

The Worker supports this secret:

```text
LOCAL_AI_API_KEY=long-random-secret-shared-with-oracle-service
```

When `AI_PROVIDER=local`, the Worker calls:

```text
POST {LOCAL_AI_URL}/review
Header: x-nutsnews-ai-key: {LOCAL_AI_API_KEY}
```

The local service returns the same decision shape used by the OpenAI review path:

```json
{
  "decision": "accept",
  "category": "Community",
  "positivity_score": 9,
  "summary": "Short summary here.",
  "reason": "Why the model accepted or rejected it.",
  "provider": "local",
  "model": "qwen2.5:3b",
  "prompt_tokens": 123,
  "completion_tokens": 45,
  "total_tokens": 168,
  "duration_ms": 21847
}
```

### Supabase

The migration `20260621090000_add_ai_provider_tracking.sql` adds provider/model tracking to:

```text
article_ai_reviews
articles
ai_usage_runs
```

Important new fields:

```text
ai_provider
ai_model
review_duration_ms
local_ai_model
local_ai_call_count
local_ai_prompt_tokens
local_ai_completion_tokens
local_ai_total_tokens
local_ai_accepted_count
local_ai_rejected_count
local_ai_duration_ms
```

### Admin

New admin visibility:

```text
/admin/articles
  Shows whether OpenAI, qwen/local AI, or local rules processed each article.

/admin/local-ai
  Shows Oracle/local AI usage, model breakdown, fallback calls, latency, recent runs, and recent decisions.
```

---

## Recommended Rollout

Do not flip all shards at once.

Use this rollout:

```text
Step 1: Deploy database migration.
Step 2: Deploy web/admin updates.
Step 3: Deploy worker updates still using AI_PROVIDER=openai.
Step 4: Create Oracle VM.
Step 5: Run Ollama and the local AI service.
Step 6: Test one shard manually with AI_PROVIDER=local.
Step 7: Watch /admin/local-ai.
Step 8: Roll out to all shards only after quality looks good.
```

---

## Oracle VM Shape

Recommended first VM:

```text
Shape: VM.Standard.A1.Flex
OCPU: 4
Memory: 24 GB
Boot volume: 100 GB or 150 GB
OS: Ubuntu ARM64
```

Use one larger VM instead of multiple small VMs. The model benefits from having all RAM and CPU available in one place.

---

## Local AI Service

The local service lives in:

```text
local-ai-service/
```

Files:

```text
local-ai-service/package.json
local-ai-service/server.mjs
local-ai-service/.env.example
```

Routes:

```text
GET /health
POST /review
```

The service listens on localhost only:

```text
127.0.0.1:8788
```

Caddy should be the public HTTPS reverse proxy. Ollama should also stay local-only on:

```text
127.0.0.1:11434
```

---

## Oracle Setup Steps

### Step 1 — Create the VM

In Oracle Cloud Console:

```text
Compute → Instances → Create instance
```

Use:

```text
Name: nutsnews-local-ai-prod
Image: Ubuntu 24.04 ARM64 or Ubuntu 22.04 ARM64
Shape: VM.Standard.A1.Flex
OCPU: 4
Memory: 24 GB
Boot volume: 100 GB or 150 GB
Networking: assign public IPv4
SSH key: upload or paste your public key
```

Keep the VM Always Free eligible.

### Step 2 — Open Required Ports

In the Oracle VCN security list or network security group, allow:

```text
22/tcp from your IP
80/tcp from 0.0.0.0/0
443/tcp from 0.0.0.0/0
```

Do not expose Ollama port 11434 publicly.

Do not expose Node port 8788 publicly if Caddy is reverse proxying locally.

### Step 3 — SSH Into the VM

From your Mac:

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

If you used Oracle Linux instead of Ubuntu, the username is usually:

```bash
ssh opc@YOUR_ORACLE_PUBLIC_IP
```

### Step 4 — Update the VM

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates gnupg unzip
```

### Step 5 — Install Node 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### Step 6 — Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama --version
```

### Step 7 — Pull the First Model

Start with the small model:

```bash
ollama pull qwen2.5:3b
ollama run qwen2.5:3b 'Return only JSON: {"ok":true}'
```

If quality is not good enough and speed is acceptable, test later:

```bash
ollama pull qwen2.5:7b
```

### Step 8 — Copy the Local AI Service

From your Mac, inside the NutsNews repo:

```bash
rsync -av local-ai-service/ ubuntu@YOUR_ORACLE_PUBLIC_IP:/tmp/nutsnews-local-ai-service/
```

On Oracle:

```bash
sudo mkdir -p /opt/nutsnews/local-ai-service
sudo rsync -av /tmp/nutsnews-local-ai-service/ /opt/nutsnews/local-ai-service/
sudo chown -R ubuntu:ubuntu /opt/nutsnews
cd /opt/nutsnews/local-ai-service
cp .env.example .env
nano .env
```

Set:

```text
PORT=8788
LOCAL_AI_API_KEY=make-this-a-long-random-secret
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
REQUEST_TIMEOUT_MS=120000
MAX_ARTICLE_CHARS=6000
```

Test it:

```bash
cd /opt/nutsnews/local-ai-service
node server.mjs
```

In another SSH session:

```bash
curl http://127.0.0.1:8788/health
```

Stop the test server with `Ctrl+C`.

### Step 9 — Run the Service With systemd

Create the service:

```bash
sudo nano /etc/systemd/system/nutsnews-local-ai.service
```

Paste:

```ini
[Unit]
Description=NutsNews Local AI Service
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/nutsnews/local-ai-service
EnvironmentFile=/opt/nutsnews/local-ai-service/.env
ExecStart=/usr/bin/node /opt/nutsnews/local-ai-service/server.mjs
Restart=always
RestartSec=5
User=ubuntu
Group=ubuntu
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nutsnews-local-ai
sudo systemctl status nutsnews-local-ai --no-pager
journalctl -u nutsnews-local-ai -f
```

### Step 10 — Install Caddy for HTTPS

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Create a DNS record first:

```text
ai.nutsnews.com → YOUR_ORACLE_PUBLIC_IP
```

Then configure Caddy:

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste:

```text
ai.nutsnews.com {
  reverse_proxy 127.0.0.1:8788
}
```

Reload:

```bash
sudo systemctl reload caddy
curl https://ai.nutsnews.com/health
```

### Step 11 — Enable the Worker Local AI Provider

The generated Wrangler config can include local AI variables when these shell variables are set before generation:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

export NUTSNEWS_SECRETS_STORE_ID="your-cloudflare-secrets-store-id"
export AI_PROVIDER="local"
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_MODEL="qwen2.5:3b"
export AI_REVIEW_CONCURRENCY="1"
export AI_PROVIDER_FALLBACK_TO_OPENAI="true"
export ENABLE_LOCAL_AI_SECRET_BINDING="true"

npm run generate:wrangler
```

Add `LOCAL_AI_API_KEY` to your Cloudflare Secrets Store with the same value you put in Oracle `.env`.

Then deploy one shard first:

```bash
npx wrangler deploy -c generated-wrangler/wrangler.shard0.jsonc
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Watch:

```text
/admin/local-ai
/admin/articles
Better Stack logs
Oracle: journalctl -u nutsnews-local-ai -f
```

Only after shard 0 looks good, deploy all shards:

```bash
npm run deploy:all
```

---

## Performance Rules

Start with:

```text
AI_REVIEW_CONCURRENCY=1
LOCAL_AI_MODEL=qwen2.5:3b
MAX_ARTICLE_CHARS=6000
```

This protects the free Oracle CPU VM.

Increase slowly only after checking:

```text
/admin/local-ai average review time
Oracle CPU load
Oracle memory usage
failed local AI requests
OpenAI fallback count
```

Useful Oracle checks:

```bash
free -h
uptime
top
journalctl -u nutsnews-local-ai -n 100 --no-pager
journalctl -u ollama -n 100 --no-pager
```

---

## Rollback

To switch back to OpenAI:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2/worker

export NUTSNEWS_SECRETS_STORE_ID="your-cloudflare-secrets-store-id"
unset LOCAL_AI_URL
unset LOCAL_AI_MODEL
unset AI_REVIEW_CONCURRENCY
unset AI_PROVIDER_FALLBACK_TO_OPENAI
unset ENABLE_LOCAL_AI_SECRET_BINDING
export AI_PROVIDER="openai"

npm run generate:wrangler
npm run deploy:all
```

The code keeps OpenAI support in place, so rollback is a config change.

---

## Safety Notes

- Keep Ollama private on localhost.
- Require `x-nutsnews-ai-key` on `/review`.
- Use HTTPS through Caddy.
- Start with one shard.
- Keep OpenAI fallback enabled until local quality is proven.
- Do not train a competing model from OpenAI/Claude-generated outputs. Use human-reviewed labels and public datasets for future fine-tuning.
