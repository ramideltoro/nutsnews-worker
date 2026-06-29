# NutsNews Translation All-in-One Update

This replaces the earlier translation recovery/diagnostics bundles with one cleaner update.

## What this update includes

- Better Stack logging when accepted articles are skipped because `SUMMARY_TRANSLATION_LIMIT` is too low.
- Better Stack logging for translation summary completion.
- Better Stack logging for Supabase `article_summaries` save failures.
- Extra Worker response counters:
  - `articleSummaryAttemptedTaskCount`
  - `articleSummaryFailedTaskCount`
  - `articleSummarySkippedByLimitArticleCount`
  - `articleSummarySkippedByLimitLanguageTaskCount`
- Diagnostic script:
  - `scripts/diagnose_missing_article_translations.mjs`
- Audit script:
  - `scripts/audit_article_translations.mjs`
- Backfill script:
  - `scripts/backfill_article_summaries.mjs`
- Validation helper:
  - `scripts/validate_translation_update.sh`
- Updated documentation:
  - `docs/MULTI_LANGUAGE_SUMMARIES.md`

## Important note

This update is diagnostic-first. It does not silently hide the issue by auto-fixing unknown failures. The likely cause of the six untranslated articles is that one Worker run accepted more articles than `SUMMARY_TRANSLATION_LIMIT`, so some accepted articles were saved without translation tasks.

The proper flow is:

1. Install and validate this bundle.
2. Run the diagnosis script.
3. If the cause is `SUMMARY_TRANSLATION_LIMIT`, raise the Worker secret.
4. Backfill the specific missing translations.
5. Deploy the Worker logging fix so future incidents are visible.

## One block: copy and validate

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

UPDATE_ZIP="$HOME/Downloads/nutsnews-translation-all-in-one-update.zip"
TMP_DIR="/tmp/nutsnews-translation-all-in-one-update"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
unzip -o "$UPDATE_ZIP" -d "$TMP_DIR"
rsync -av "$TMP_DIR"/ ./

chmod +x scripts/validate_translation_update.sh
chmod +x scripts/diagnose_missing_article_translations.mjs
chmod +x scripts/audit_article_translations.mjs
chmod +x scripts/backfill_article_summaries.mjs

scripts/validate_translation_update.sh /Users/ramideltoro/WebstormProjects/nutsnews3
```

## One block: diagnose the missing translations

Fill in your Supabase values, then run:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"

LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=250 WINDOW_MINUTES=45 \
node scripts/diagnose_missing_article_translations.mjs
```

What to look for:

- If nearby runs show `accepted_count` greater than `12`, the likely cause is the translation limit.
- If Better Stack has article-level translation failure logs, the cause is AI/local/OpenAI failure.
- If Better Stack has `worker.supabase.article_summary_batch_save_failed`, the cause is Supabase save failure.

## Better Stack searches

```text
service:nutsnews-worker event:worker.translation.skipped_by_limit
```

```text
service:nutsnews-worker event:worker.refresh.completed articleSummarySkippedByLimitArticleCount:>0
```

```text
service:nutsnews-worker articleUrl:"PASTE_ARTICLE_URL_HERE"
```

```text
service:nutsnews-worker event:worker.supabase.article_summary_batch_save_failed
```

## If the cause is `SUMMARY_TRANSLATION_LIMIT`

Raise the limit:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/worker
npx wrangler secret put SUMMARY_TRANSLATION_LIMIT
```

Enter this value when prompted:

```text
18
```

Then deploy the Worker update:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3
npm --prefix worker run deploy:all
```

## Backfill only after diagnosis

Preview first:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export LOCAL_AI_URL="https://ai.nutsnews.com"
export LOCAL_AI_API_KEY="YOUR_LOCAL_AI_API_KEY"
export LOCAL_AI_MODEL="qwen2.5:3b"

LANGUAGE_CODES=fr,ja,de-CH,de,el BACKFILL_SOURCE=public_feed_snapshot CANDIDATE_LIMIT=250 BACKFILL_LIMIT=12 DRY_RUN=1 \
node scripts/backfill_article_summaries.mjs
```

Run the real backfill:

```bash
LANGUAGE_CODES=fr,ja,de-CH,de,el BACKFILL_SOURCE=public_feed_snapshot CANDIDATE_LIMIT=250 BACKFILL_LIMIT=12 \
node scripts/backfill_article_summaries.mjs
```

Verify:

```bash
LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=250 WINDOW_MINUTES=45 \
node scripts/diagnose_missing_article_translations.mjs
```

## Commit

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

git status
git add worker/src/index.ts worker/src/logger.ts scripts/diagnose_missing_article_translations.mjs scripts/audit_article_translations.mjs scripts/backfill_article_summaries.mjs scripts/validate_translation_update.sh docs/MULTI_LANGUAGE_SUMMARIES.md README_TRANSLATION_ALL_IN_ONE_UPDATE.md
git commit -m "Add translation diagnostics and backfill tools"
git push
```
