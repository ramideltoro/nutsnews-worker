# NutsNews local-first AI fallback update

This update makes the Worker support a full local-first AI flow:

1. Article review tries the home server first through `POST /review`.
2. If local review fails, the Worker retries the home server once.
3. If local review still fails and OpenAI fallback is enabled, the Worker falls back to OpenAI.
4. Accepted article translations already use the same pattern through `POST /translate`: local first, retry once, then OpenAI fallback.

## Important deployment variables

Use these when generating and deploying Workers:

```bash
export ENABLE_LOCAL_AI_SECRET_BINDING=true
export AI_PROVIDER="local"
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_MODEL="qwen2.5:3b"
export AI_PROVIDER_FALLBACK_TO_OPENAI=true
export AI_REVIEW_CONCURRENCY=1
export ENABLED_SUMMARY_LANGUAGES="fr,ja,de-CH,de,el"
export SUMMARY_TRANSLATION_LIMIT=12
```

`AI_PROVIDER="local"` is the setting that moves article review to the home server first.

`AI_PROVIDER_FALLBACK_TO_OPENAI=true` keeps OpenAI as the safety net when the home server fails.

`AI_REVIEW_CONCURRENCY=1` is recommended for a small home server so multiple shards do not overload Ollama.

## Deploy Workers

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

## Verify generated config

```bash
grep -n \
  -e '"AI_PROVIDER"' \
  -e '"LOCAL_AI_URL"' \
  -e '"LOCAL_AI_MODEL"' \
  -e '"AI_PROVIDER_FALLBACK_TO_OPENAI"' \
  -e '"AI_REVIEW_CONCURRENCY"' \
  -e '"ENABLED_SUMMARY_LANGUAGES"' \
  -e '"SUMMARY_TRANSLATION_LIMIT"' \
  generated-wrangler/wrangler.shard1.jsonc
```

You should see:

```json
"AI_PROVIDER": "local",
"LOCAL_AI_URL": "https://ai.nutsnews.com",
"LOCAL_AI_MODEL": "qwen2.5:3b",
"AI_PROVIDER_FALLBACK_TO_OPENAI": "true",
"AI_REVIEW_CONCURRENCY": "1",
"ENABLED_SUMMARY_LANGUAGES": "fr,ja,de-CH,de,el",
"SUMMARY_TRANSLATION_LIMIT": "12"
```

## Runtime logs to expect

A fully local-first successful article should show:

```text
worker.local_ai.article_reviewed
worker.translation.local.article_summary_translated
worker.translation.local.article_summary_translated
```

If local review fails, fallback should show:

```text
worker.local_ai.fallback_to_openai
worker.openai.article_reviewed
```

## Test one shard

```bash
curl "https://nutsnews-worker-1.nutsnews.workers.dev/?limit=1"
```

Watch these response fields:

```json
"aiProvider": "local",
"localAiCallCount": 1,
"openAiCallCount": 0,
"articleSummaryTranslationCount": 2
```

`openAiCallCount` should stay at `0` when local review works. It may become `1` only if local review fails and fallback is used.
