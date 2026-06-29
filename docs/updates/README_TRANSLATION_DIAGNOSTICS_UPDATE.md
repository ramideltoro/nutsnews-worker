# NutsNews Translation Diagnostics Update

This update is intentionally diagnostic-first. It does not assume that missing translated cards should be blindly backfilled before you understand why they were missed.

## What likely happened

The uploaded Worker code translates only this slice of newly accepted articles:

```ts
acceptedArticles.slice(0, config.summaryTranslationLimit)
```

`SUMMARY_TRANSLATION_LIMIT` defaults to `12`. If a Worker run accepts more than 12 articles, the articles after that limit are saved to `public.articles`, but no `public.article_summaries` task is created for them. Those cards then fall back to English when the user selects French or Japanese.

This matches the symptom where articles before and after the incident translated correctly, but a small group in the middle did not.

## What changed in this update

- Adds a Better Stack-delivered warning event when articles are skipped by the translation limit:

```text
worker.translation.skipped_by_limit
```

- Sends the per-run translation summary to Better Stack:

```text
worker.translation.summary_completed
```

- Adds useful counters to the Worker JSON response and `worker.refresh.completed` log:

```text
articleSummaryAttemptedTaskCount
articleSummaryFailedTaskCount
articleSummarySkippedByLimitArticleCount
articleSummarySkippedByLimitLanguageTaskCount
```

- Sends article summary Supabase save failures to Better Stack:

```text
worker.supabase.article_summary_batch_save_failed
worker.supabase.article_summary_batch_save_exception
```

- Adds a diagnostic script:

```text
scripts/diagnose_missing_article_translations.mjs
```

- Adds a backfill script to run only after diagnosis:

```text
scripts/backfill_article_summaries.mjs
```

## Files changed

```text
worker/src/index.ts
worker/src/logger.ts
scripts/diagnose_missing_article_translations.mjs
scripts/backfill_article_summaries.mjs
docs/MULTI_LANGUAGE_SUMMARIES.md
README_TRANSLATION_DIAGNOSTICS_UPDATE.md
```

## Install this update

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

UPDATE_ZIP="$HOME/Downloads/nutsnews-translation-diagnostics-update.zip"
TMP_DIR="/tmp/nutsnews-translation-diagnostics-update"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
unzip -o "$UPDATE_ZIP" -d "$TMP_DIR"
rsync -av "$TMP_DIR"/ ./

chmod +x scripts/diagnose_missing_article_translations.mjs
chmod +x scripts/backfill_article_summaries.mjs
```

## Build check

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3
npm --prefix worker install
npm --prefix worker exec -- tsc --noEmit
```

## Diagnose the exact six untranslated articles

Set your Supabase credentials:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

Scan the latest home feed articles:

```bash
LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=80 WINDOW_MINUTES=45 \
node scripts/diagnose_missing_article_translations.mjs
```

If the six incident articles are older than the latest 80 articles, increase the scan:

```bash
LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=250 WINDOW_MINUTES=45 \
node scripts/diagnose_missing_article_translations.mjs
```

The script prints each missing article, the missing language rows, nearby Worker runs, and Better Stack search strings.

## Check Better Stack logs

Search these first:

```text
service:nutsnews-worker event:worker.translation.skipped_by_limit
```

```text
service:nutsnews-worker event:worker.refresh.completed articleSummarySkippedByLimitArticleCount:>0
```

For a specific article from the script output:

```text
service:nutsnews-worker articleUrl:"PASTE_ARTICLE_URL_HERE"
```

Then check the possible failure classes:

```text
service:nutsnews-worker event:worker.translation.local.request_failed
service:nutsnews-worker event:worker.translation.local.request_exception
service:nutsnews-worker event:worker.translation.local.response_json_failed
service:nutsnews-worker event:worker.translation.local.invalid_payload
service:nutsnews-worker event:worker.translation.fallback_to_openai
service:nutsnews-worker event:worker.translation.openai.request_failed
service:nutsnews-worker event:worker.translation.openai.request_exception
service:nutsnews-worker event:worker.translation.openai.invalid_json
service:nutsnews-worker event:worker.supabase.article_summary_batch_save_failed
```

## If the root cause is the translation limit

This is the most likely cause if the script shows nearby Worker runs with `accepted_count` greater than `12`, and Better Stack does not show per-article translation failures.

Fix options:

1. Increase the Worker variable so it matches your largest per-run review limit:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npx wrangler secret put SUMMARY_TRANSLATION_LIMIT
# enter 18 when prompted
```

2. Deploy the diagnostics update so future limit skips are visible:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3
npm --prefix worker run deploy:all
```

3. Backfill only the missing rows after you confirm the cause:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_API_KEY="YOUR_LOCAL_AI_API_KEY"
export LOCAL_AI_MODEL="qwen2.5:3b"

LANGUAGE_CODES=fr,ja,de-CH,de,el BACKFILL_SOURCE=public_feed_snapshot CANDIDATE_LIMIT=250 BACKFILL_LIMIT=12 DRY_RUN=1 \
node scripts/backfill_article_summaries.mjs

LANGUAGE_CODES=fr,ja,de-CH,de,el BACKFILL_SOURCE=public_feed_snapshot CANDIDATE_LIMIT=250 BACKFILL_LIMIT=12 \
node scripts/backfill_article_summaries.mjs
```

## If the root cause is local AI or OpenAI failure

Use the Better Stack article URL search. The Worker already logs local request failures, invalid local payloads, OpenAI fallback, OpenAI failures, and invalid OpenAI JSON with `articleUrl` and `languageCode`.

The proper fix depends on the log:

- `local.request_failed` or `local.request_exception`: check home server uptime, `/health`, firewall, and `LOCAL_AI_API_KEY`.
- `local.invalid_payload`: improve the local translation prompt or JSON extraction in `local-ai-service/server.mjs`.
- `fallback_to_openai` followed by `skipped_missing_openai_key`: set `OPENAI_API_KEY` on the Worker if you want fallback.
- `openai.request_failed`: inspect status and error text; this may be quota, auth, or rate limiting.
- `article_summary_batch_save_failed`: inspect Supabase error text; this is usually schema, constraint, or service-role configuration.

## Commit

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

git status
git add worker/src/index.ts worker/src/logger.ts scripts/diagnose_missing_article_translations.mjs scripts/backfill_article_summaries.mjs docs/MULTI_LANGUAGE_SUMMARIES.md README_TRANSLATION_DIAGNOSTICS_UPDATE.md
git commit -m "Add translation diagnostics for missing localized summaries"
git push
```
