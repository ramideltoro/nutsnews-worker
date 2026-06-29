# NutsNews Translation Recovery Guard Update

This update fixes the failure mode where a newly accepted article can appear in English before French/Japanese summary rows exist.

## What changed

- New accepted articles are inserted as `translation_pending` when article-card translations are enabled.
- The Worker only flips those articles to `published` after all enabled language rows exist in `article_summaries`.
- The Worker now uses spare translation capacity to recover recent `published` or `translation_pending` articles that are missing summary translations.
- The Worker response now includes translation recovery/publish counters:
  - `articleSummaryRecoveryCandidateCount`
  - `articleSummaryRecoveryAttemptedTaskCount`
  - `articleSummaryPublishCount`
  - `articleSummaryPublishOk`
- The local/OpenAI API keys are checked before use as HTTP headers so a polluted value with newlines cannot crash translation with `Headers.append`.
- The default `SUMMARY_TRANSLATION_LIMIT` is reduced from 12 to 6 articles per shard run to reduce the chance of subrequest pressure while still letting recovery catch up.
- `scripts/backfill_article_summaries.mjs` now defaults to the `articles` table, includes `translation_pending` rows, guards provider headers, and publishes rows that become fully translated.

## First troubleshooting pass

1. Audit the current public feed.

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_SOURCE=public_feed_snapshot AUDIT_LIMIT=30 \
  node scripts/audit_article_translations.mjs
```

2. Diagnose the latest published articles and their nearby Worker runs.

```bash
LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=60 WINDOW_MINUTES=90 \
  node scripts/diagnose_missing_article_translations.mjs
```

3. Backfill missing rows. Use local AI first if the home server is healthy; otherwise omit `LOCAL_AI_URL` and `LOCAL_AI_API_KEY` to use OpenAI only.

```bash
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_API_KEY="your-local-ai-key"
export LOCAL_AI_MODEL="qwen2.5:3b"
export OPENAI_API_KEY="your-openai-key"

LANGUAGE_CODES=fr,ja,de-CH,de,el BACKFILL_SOURCE=articles BACKFILL_LIMIT=40 PUBLISH_READY=1 \
  node scripts/backfill_article_summaries.mjs
```

4. Deploy all Worker shards.

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npm install
npm run deploy:all
```

5. Test one shard manually.

```bash
curl -s "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1" | jq '{
  shardIndex,
  acceptedCount,
  articleSummaryTranslationCount,
  articleSummaryAttemptedTaskCount,
  articleSummaryFailedTaskCount,
  articleSummaryRecoveryCandidateCount,
  articleSummaryRecoveryAttemptedTaskCount,
  articleSummaryPublishCount,
  articleSummaryPublishOk,
  costProtectionLimitReached,
  spikeWarningTriggered
}'
```

A healthy run should either translate/publish new accepted articles or show recovery candidates being attempted. If `articleSummaryFailedTaskCount` is greater than 0, search Better Stack for `worker.translation.local.*`, `worker.translation.openai.*`, and `worker.supabase.article_summary_batch_save_failed`.
