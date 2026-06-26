# NutsNews home-server translation fallback update

This update changes new Worker-generated article translations so the home server is tried before OpenAI.

## What changed

- Added `POST /translate` to `local-ai-service/server.mjs`.
- Updated `worker/src/index.ts` so summary translations use this order:
  1. Home-server local AI translation.
  2. One retry if the local translation fails.
  3. OpenAI fallback.
  4. One retry if OpenAI translation fails.
- Added stronger validation so translation responses must include both `title` and `summary` before being saved.
- Updated Better Stack delivery events for translation failures and OpenAI fallback logs.
- Updated docs for multi-language summaries and the home-server local AI service.

## Required Worker config

For Workers to use the home server for translations, deployed shard configs need these values available:

```text
LOCAL_AI_URL=https://ai.nutsnews.com
LOCAL_AI_MODEL=qwen2.5:3b
LOCAL_AI_API_KEY=<Cloudflare Secrets Store binding>
```

`AI_PROVIDER` does not have to be `local` for translation fallback to work. Article review can still use OpenAI while translations use the home server first, as long as `LOCAL_AI_URL` and `LOCAL_AI_API_KEY` are configured.

## Home-server deploy files

Copy these files to `/opt/nutsnews/local-ai-service` on the home server:

```text
local-ai-service/server.mjs
local-ai-service/package.json
local-ai-service/.env.example
```

Keep the real `.env` on the server. Do not overwrite it unless you intentionally want to change secrets.

Optional `.env` value for translation length:

```text
TRANSLATION_SUMMARY_MAX_CHARS=250
```

## Test commands

From the project root:

```bash
cd worker
npm ci
npx tsc --noEmit
```

On the home server after copying `local-ai-service/server.mjs`:

```bash
sudo systemctl restart nutsnews-local-ai
sudo systemctl status nutsnews-local-ai --no-pager --lines=12

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

