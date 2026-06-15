#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ROOT="${1:-$(pwd)}"

if [[ ! -f "$SOURCE_ROOT/README.md" || ! -d "$SOURCE_ROOT/web" ]]; then
  echo "ERROR: Could not find the extracted issue #7 update files."
  echo "Expected README.md and web/ next to this script."
  exit 1
fi

if [[ ! -f "$TARGET_ROOT/README.md" || ! -d "$TARGET_ROOT/web" ]]; then
  echo "ERROR: Target does not look like the NutsNews repo root: $TARGET_ROOT"
  echo "Usage: bash scripts/apply_issue_7_cloudflare_cache_hit_rate.sh /path/to/nutsnews2"
  exit 1
fi

mkdir -p "$TARGET_ROOT/web/lib"
mkdir -p "$TARGET_ROOT/web/app/api/articles"
mkdir -p "$TARGET_ROOT/web/app/api/log-test"
mkdir -p "$TARGET_ROOT/scripts"

cp "$SOURCE_ROOT/README.md" "$TARGET_ROOT/README.md"
cp "$SOURCE_ROOT/web/next.config.ts" "$TARGET_ROOT/web/next.config.ts"
cp "$SOURCE_ROOT/web/middleware.ts" "$TARGET_ROOT/web/middleware.ts"
cp "$SOURCE_ROOT/web/lib/cacheHeaders.ts" "$TARGET_ROOT/web/lib/cacheHeaders.ts"
cp "$SOURCE_ROOT/web/app/api/articles/route.ts" "$TARGET_ROOT/web/app/api/articles/route.ts"
cp "$SOURCE_ROOT/web/app/api/log-test/route.ts" "$TARGET_ROOT/web/app/api/log-test/route.ts"
cp "$SOURCE_ROOT/scripts/validate_cloudflare_cache_hit_rate.sh" "$TARGET_ROOT/scripts/validate_cloudflare_cache_hit_rate.sh"
cp "$SOURCE_ROOT/scripts/apply_issue_7_cloudflare_cache_hit_rate.sh" "$TARGET_ROOT/scripts/apply_issue_7_cloudflare_cache_hit_rate.sh"

chmod +x "$TARGET_ROOT/scripts/validate_cloudflare_cache_hit_rate.sh"
chmod +x "$TARGET_ROOT/scripts/apply_issue_7_cloudflare_cache_hit_rate.sh"

echo "Issue #7 Cloudflare cache HIT rate update applied to: $TARGET_ROOT"
echo
echo "Updated files:"
echo "  README.md"
echo "  web/next.config.ts"
echo "  web/middleware.ts"
echo "  web/lib/cacheHeaders.ts"
echo "  web/app/api/articles/route.ts"
echo "  web/app/api/log-test/route.ts"
echo "  scripts/validate_cloudflare_cache_hit_rate.sh"
echo "  scripts/apply_issue_7_cloudflare_cache_hit_rate.sh"
echo

echo "Next commands:"
echo "  cd $TARGET_ROOT/web && npm run build"
echo "  cd $TARGET_ROOT && git status"
echo "  cd $TARGET_ROOT && git add README.md web/next.config.ts web/middleware.ts web/lib/cacheHeaders.ts web/app/api/articles/route.ts web/app/api/log-test/route.ts scripts/validate_cloudflare_cache_hit_rate.sh scripts/apply_issue_7_cloudflare_cache_hit_rate.sh"
echo "  cd $TARGET_ROOT && git commit -m \"Improve Cloudflare cache HIT rate\""
echo "  cd $TARGET_ROOT && git push"
