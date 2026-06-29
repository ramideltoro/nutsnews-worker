# Worker summary translation task limit fix

This update makes `SUMMARY_TRANSLATION_LIMIT` control the number of translation tasks per Worker invocation directly.

Previously, `SUMMARY_TRANSLATION_LIMIT=1` became 5 tasks because the Worker multiplied the value by the number of enabled summary languages (`fr,ja,de-CH,de,el`). That still hit Cloudflare's subrequest limit on feed-heavy shards.

After this update:

- `SUMMARY_TRANSLATION_LIMIT=1` means 1 translation task per run.
- `SUMMARY_TRANSLATION_LIMIT=2` means 2 translation tasks per run.
- The hard maximum remains 5 translation tasks per run.
- `articleSummaryTranslationTaskBudget` in the curl response should now match the configured limit, capped at 5.

Use `SUMMARY_TRANSLATION_LIMIT=1` while shards still fetch 20 feeds per run.
