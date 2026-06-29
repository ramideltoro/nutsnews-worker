# Worker local-first AI and diagnostic logging update

This update makes Cloudflare Workers try local AI first for article review/classification and summary translation when `LOCAL_AI_URL` + `LOCAL_AI_API_KEY` are configured. If local AI fails and `OPENAI_API_KEY` is available, the Worker falls back to OpenAI.

## Changed files

- `worker/src/index.ts`
- `worker/src/logger.ts`
- `worker/scripts/generate-wrangler-config.mjs`

## Behavior

- Article review now attempts local AI before OpenAI.
- Summary translations continue to attempt local AI before OpenAI.
- Fallback to OpenAI is enabled by default when an OpenAI key exists.
- Worker response now includes provider diagnostics:
  - `aiReviewProviderOrder`
  - `localAiConfigured`
  - `openAiFallbackEnabled`
  - `articleSummaryLocalTranslationCount`
  - `articleSummaryOpenAiTranslationCount`
  - `translationProviderOrder`
- Better Stack/console logs include local AI attempt, skipped local config, local request failures, and OpenAI fallback events.
- Generated Wrangler config now carries `HOLD_ARTICLES_FOR_TRANSLATIONS` through to every shard.

## Important production note

Cloudflare Workers cannot call your Mac SSH tunnel or a private-only `127.0.0.1` home server address. For deployed Workers to use local AI first, `LOCAL_AI_URL` must be a secure public URL reachable from Cloudflare, such as a Cloudflare Tunnel URL, and `LOCAL_AI_API_KEY` must be available to Workers through Secrets Store.
