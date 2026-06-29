# NutsNews backfill continue-on-error update

This update changes `scripts/backfill_article_summaries.mjs` so a bad translation row does not stop the whole backfill.

## Behavior

- Each translation row is translated and saved independently.
- If Local AI/Ollama returns a bad response for one row, the script logs the failed row and continues.
- If Supabase rejects one row save, the script logs that row and continues.
- The final publish-ready check is also non-fatal; saved translations are kept even if that optional check fails.
- The script prints a final summary with saved count and failed/skipped count.
- The Supabase language-code filters now quote/encode language codes such as `de-CH` correctly.

## Recommended run

Use `PUBLISH_READY=0` during large backfills, then publish/check later after coverage looks good.

```bash
LANGUAGE_CODES="de-CH,de,el" \
BACKFILL_SOURCE=public_feed_snapshot \
CANDIDATE_LIMIT=250 \
BACKFILL_LIMIT=30 \
PUBLISH_READY=0 \
node scripts/backfill_article_summaries.mjs | tee /tmp/nutsnews-de-ch-de-el-backfill.log
```
