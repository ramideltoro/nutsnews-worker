# Swiss German, German, and Greek Language Update

This update adds three NutsNews languages across the web UI and article translation pipeline:

- `de-CH` — Swiss German / Swiss High German
- `de` — German
- `el` — Greek

## What changed

- Adds the three languages to the site language selector.
- Localizes the home feed copy, search UI, footer, hero tagline, settings menu, contact page, about page, and privacy page.
- Lets the web API load translated article titles and summaries from `public.article_summaries` for the new language codes.
- Updates the Cloudflare Worker translation defaults to generate `fr`, `ja`, `de-CH`, `de`, and `el` summaries.
- Updates the local AI `/translate` endpoint so it accepts and translates the new language codes.
- Updates translation audit, diagnosis, backfill, offline regression, wrangler, and GitHub translation coverage defaults.

## Recommended Worker setting

```bash
export ENABLED_SUMMARY_LANGUAGES="fr,ja,de-CH,de,el"
```

## Backfill only the new languages

Dry run first:

```bash
LANGUAGE_CODES="de-CH,de,el" \
BACKFILL_SOURCE=public_feed_snapshot \
CANDIDATE_LIMIT=250 \
BACKFILL_LIMIT=30 \
DRY_RUN=1 \
node scripts/backfill_article_summaries.mjs
```

Run the backfill:

```bash
LANGUAGE_CODES="de-CH,de,el" \
BACKFILL_SOURCE=public_feed_snapshot \
CANDIDATE_LIMIT=250 \
BACKFILL_LIMIT=30 \
node scripts/backfill_article_summaries.mjs
```

## Audit translations

```bash
LANGUAGE_CODES="fr,ja,de-CH,de,el" \
AUDIT_SOURCE=public_feed_snapshot \
AUDIT_LIMIT=100 \
node scripts/audit_article_translations.mjs
```
