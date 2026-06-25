#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/Users/ramideltoro/WebstormProjects/nutsnews3}"
cd "$PROJECT_DIR"

echo "== NutsNews translation update validation =="
echo "Project: $PROJECT_DIR"

required_files=(
  "worker/src/index.ts"
  "worker/src/logger.ts"
  "scripts/diagnose_missing_article_translations.mjs"
  "scripts/audit_article_translations.mjs"
  "scripts/backfill_article_summaries.mjs"
  "docs/MULTI_LANGUAGE_SUMMARIES.md"
  "README_TRANSLATION_ALL_IN_ONE_UPDATE.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
  echo "OK file: $file"
done

printf "\nChecking script syntax...\n"
node --check scripts/diagnose_missing_article_translations.mjs
node --check scripts/audit_article_translations.mjs
node --check scripts/backfill_article_summaries.mjs

printf "\nChecking Worker TypeScript...\n"
npm --prefix worker install
(cd worker && npm exec tsc -- --noEmit)

printf "\nValidation passed.\n"
