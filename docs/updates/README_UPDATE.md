# NutsNews Local AI Summary Length Update

This update fixes the local AI review path so accepted article summaries stop coming back in the old short 150-160 character style.

## What changed

- Updated `local-ai-service/server.mjs` to default accepted summaries to `260-340` characters.
- Strengthened the local AI prompt to explicitly avoid 150-160 character summaries.
- Increased the default Ollama completion budget from `260` to `320` tokens.
- Added `summary_length`, `accepted_summary_min_chars`, and `accepted_summary_max_chars` to `/review` responses for easy verification.
- Updated the Worker OpenAI fallback prompt to use the same 260-340 character target.
- Updated the home-server local AI documentation and `.env.example`.

## Updated files

- `local-ai-service/server.mjs`
- `local-ai-service/.env.example`
- `worker/src/index.ts`
- `docs/HOME_SERVER_LOCAL_AI.md`
- `scripts/apply_local_ai_summary_length_update.sh`

## Home server deploy command

From your Mac, after copying this update into `/Users/ramideltoro/WebstormProjects/nutsnews2`, run:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

bash scripts/apply_local_ai_summary_length_update.sh
```

## Verify

The `/review` response should now include:

```json
{
  "summary_length": 260,
  "accepted_summary_min_chars": 260,
  "accepted_summary_max_chars": 340
}
```

The exact `summary_length` will vary by article, but accepted stories should now land between 260 and 340 characters.
