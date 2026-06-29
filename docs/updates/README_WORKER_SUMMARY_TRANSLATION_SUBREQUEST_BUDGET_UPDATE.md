# Worker Summary Translation Subrequest Budget Update

## Problem

The Worker was trying too many summary translation recovery tasks in one invocation. With 20 RSS feed fetches plus dozens of OpenAI/local AI translation calls and Supabase writes, Cloudflare stopped the run with:

`Too many subrequests by single Worker invocation`

That caused translation saves to fail and kept articles stuck in `translation_pending`.

## Fix

The Worker now treats summary translation work as a small per-run task budget instead of expanding recovery articles into dozens of language tasks.

- Caps summary translation tasks per Worker invocation at a safe hard limit.
- Prioritizes newly accepted articles first.
- Uses remaining task budget for recovery of older `translation_pending` articles.
- Keeps skipped articles hidden as `translation_pending` until a later run finishes their translations.
- Adds `articleSummaryTranslationTaskBudget` to Worker responses and translation summary logs.

## Notes

With five enabled languages (`fr,ja,de-CH,de,el`), one article requires five translation tasks. This update keeps shard invocations below the Cloudflare subrequest ceiling while still allowing future scheduled runs to continue draining pending translations.
