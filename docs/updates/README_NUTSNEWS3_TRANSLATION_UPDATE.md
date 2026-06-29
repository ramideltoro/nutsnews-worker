# NutsNews3 Translation Diagnostics Update

This bundle is intended for the clean clone at:

```text
/Users/ramideltoro/WebstormProjects/nutsnews3
```

It adds diagnostic logging and tools for investigating missing French/Japanese article translations without guessing.

## Files included

- `worker/src/index.ts`
- `worker/src/logger.ts`
- `scripts/diagnose_missing_article_translations.mjs`
- `scripts/audit_article_translations.mjs`
- `scripts/backfill_article_summaries.mjs`
- `scripts/validate_translation_update.sh`
- `docs/MULTI_LANGUAGE_SUMMARIES.md`
- `README_TRANSLATION_ALL_IN_ONE_UPDATE.md`
- `README_TRANSLATION_DIAGNOSTICS_UPDATE.md`

## Main copy/validate command

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

UPDATE_ZIP="$HOME/Downloads/nutsnews3-translation-diagnostics-update.zip"
TMP_DIR="/tmp/nutsnews3-translation-diagnostics-update"

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

## Diagnose missing translations

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

set -a
source web/.env.local
set +a

LANGUAGE_CODES=fr,ja,de-CH,de,el AUDIT_LIMIT=250 WINDOW_MINUTES=45 \
node scripts/diagnose_missing_article_translations.mjs
```

## Web smoke build

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3/web
SENTRY_AUTH_TOKEN= npm run build
```

## Worker deploy after validation

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3
npm --prefix worker run deploy:all
```
