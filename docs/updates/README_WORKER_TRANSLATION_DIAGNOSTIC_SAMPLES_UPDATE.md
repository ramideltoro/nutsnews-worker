# Worker Translation Diagnostic Samples Update

This update makes Worker translation failures easier to debug.

## What changed

- Adds `articleSummaryFailureSamples` to the manual Worker JSON response.
- Adds `articleSummarySaveErrorSamples` to the manual Worker JSON response.
- Keeps local AI/OpenAI provider-order reporting already added by the previous update.
- Includes representative failed article URLs, titles, languages, task source, provider order, and save error text.

## Why

The Worker was returning high failure counts such as `articleSummaryFailedTaskCount`, but not the underlying rows or Supabase error text. This update lets a single shard test show what failed next.

## Expected response fields

After deploy, test a shard and look for:

- `articleSummaryFailureSamples`
- `articleSummarySaveErrorSamples`
- `articleSummaryFailedTaskCount`
- `articleSummarySaveOk`
- `translationProviderOrder`
