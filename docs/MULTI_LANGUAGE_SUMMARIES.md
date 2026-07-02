# Multi-language summaries

Issue #26 adds a future-ready language layer for NutsNews summaries.

The first supported translated language is French (`fr`). The design keeps the original article/source link unchanged and stores generated translated titles and summaries separately from the canonical article row.

## Supported languages

Current public language options:

| Code | Label |
| --- | --- |
| `en` | English |
| `fr` | Français |

Future languages should be added to `web/lib/languages.ts` and to the Worker `SummaryLanguageCode` union/config parsing.

## Database design

Canonical articles stay in `public.articles`.

Localized summaries are stored in:

```text
public.article_summaries
```

Important columns:

| Column | Purpose |
| --- | --- |
| `original_url` | Stable key back to `public.articles.original_url` |
| `language_code` | Target language such as `fr` |
| `source_language_code` | Original summary language, currently `en` |
| `title` | Localized card title |
| `summary` | Localized card summary |
| `generated_by` | Translation provider: `local` when the home server generated it, otherwise `openai` after fallback |
| `model` | Translation model |

`unique(original_url, language_code)` makes each article/language pair upsertable.

## Worker behavior

When an article is accepted and saved, the Worker:

1. Saves the English/default article row in `public.articles`.
2. Builds one translation task for each enabled language.
3. Calls the home-server local AI service first through `POST {LOCAL_AI_URL}/translate`.
4. Retries the home-server translation once when the request throws, returns a non-OK status, returns invalid JSON, or misses the translated title/summary.
5. Falls back to OpenAI if the home-server translation still fails.
6. Retries the OpenAI translation once before giving up.
7. Upserts successful results into `public.article_summaries`.
8. Keeps `original_url` unchanged.

This makes new card translations prefer the home server while preserving OpenAI as a safety net.

Default Worker config:

```text
ENABLED_SUMMARY_LANGUAGES=fr,ja,de-CH,de,el
SUMMARY_TRANSLATION_LIMIT=12
```

Home-server translation config uses the same local AI variables as local review:

```text
LOCAL_AI_URL=https://ai.nutsnews.com
LOCAL_AI_MODEL=qwen2.5:3b
LOCAL_AI_API_KEY=<secret binding>
```

`AI_PROVIDER` can still be `openai`; translations will use the home server first whenever `LOCAL_AI_URL` and `LOCAL_AI_API_KEY` are available.

To disable translations temporarily:

```text
ENABLED_SUMMARY_LANGUAGES=none
```

## Public API behavior

The articles API supports a `lang` query parameter:

```text
/api/articles?page=0&lang=fr
```

Fallback behavior:

```text
French summary exists → return French title/summary
French summary missing → return English/default title/summary
```

This lets the site show French when available without blocking new articles or requiring a full historical backfill first.

## Web UI behavior

The Settings panel includes a Language selector:

```text
English
Français
```

The selected language is stored in local storage under:

```text
nutsnews.web.language
```

Changing language refetches the feed with the selected language.

## Backfilling existing articles

Use the backfill script for existing articles that were published before the feature existed:

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews2

SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
OPENAI_API_KEY="YOUR_OPENAI_KEY" \
BACKFILL_LIMIT=25 \
node scripts/backfill_french_summaries.mjs
```

Run small batches first to control cost.

## Adding another language later

1. Add the language to `SUPPORTED_LANGUAGES` in `web/lib/languages.ts`.
2. Add the code to the Worker `SummaryLanguageCode` union.
3. Update `isSummaryLanguageCode`.
4. Add the language code to `ENABLED_SUMMARY_LANGUAGES`, for example:

```text
ENABLED_SUMMARY_LANGUAGES=fr,es
```

No new column is required in `public.articles`.


## Japanese support (`ja`)

Japanese is supported as an additional summary language using the same `public.article_summaries` table.

- UI language code: `ja`
- Language label: `日本語`
- Flag badge: 🇯🇵
- Article API: `/api/articles?lang=ja`
- Backfill script: `scripts/backfill_japanese_summaries.mjs`
- Worker setting: `ENABLED_SUMMARY_LANGUAGES=fr,ja,de-CH,de,el`

Existing articles must be backfilled once. New accepted articles are translated by the Workers after the updated Worker code is deployed. Source links remain unchanged and continue to point to the original publisher.

## Diagnosing missing translated cards

If a few articles remain in English while the surrounding home-page articles are translated, do not assume the front end is broken. The frontend intentionally falls back to the English `articles` row whenever a matching row is missing from `public.article_summaries`.

The first thing to check is whether a Worker run accepted more articles than `SUMMARY_TRANSLATION_LIMIT`. In the current Worker design, `SUMMARY_TRANSLATION_LIMIT` is an article count limit. Articles beyond that limit are still published, but they are skipped for translated summary generation.

Run:

```bash
LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=80 WINDOW_MINUTES=45 \
node scripts/diagnose_missing_article_translations.mjs
```

Then search Better Stack for:

```text
service:nutsnews-worker event:worker.translation.skipped_by_limit
service:nutsnews-worker event:worker.translation.summary_completed
service:nutsnews-worker articleUrl:"PASTE_ARTICLE_URL_HERE"
```

If the root cause is the limit, increase the Worker `SUMMARY_TRANSLATION_LIMIT` variable to match the largest `maxAiReviews` value you allow, then run `scripts/backfill_article_summaries.mjs` for the missing rows.

If the root cause is provider failure, use the per-article Worker logs. Translation failures are logged with `articleUrl` and `languageCode` for local AI request failures, local invalid payloads, OpenAI fallback, OpenAI request failures, OpenAI invalid JSON, and Supabase article summary save failures.

## Quality checks and fallback policy

NutsNews also maintains a formal translation quality policy. See [Multilingual Quality and Fallbacks](MULTILINGUAL_QUALITY_AND_FALLBACKS.md) for the daily coverage report, `/admin/translations` dashboard, quality rules, English-leak detection, Worker save policy, and public fallback behavior.
