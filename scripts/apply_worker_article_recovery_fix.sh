#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ROOT="${1:-$(pwd)}"

if [[ ! -f "$SOURCE_ROOT/worker/src/index.ts" ]]; then
  echo "ERROR: Could not find extracted Worker update files."
  exit 1
fi

if [[ ! -f "$TARGET_ROOT/README.md" || ! -d "$TARGET_ROOT/worker" || ! -d "$TARGET_ROOT/docs" ]]; then
  echo "ERROR: Target does not look like the NutsNews repo root: $TARGET_ROOT"
  echo "Usage: bash scripts/apply_worker_article_recovery_fix.sh /path/to/nutsnews2"
  exit 1
fi

mkdir -p "$TARGET_ROOT/worker/src" "$TARGET_ROOT/docs" "$TARGET_ROOT/scripts"

cp "$SOURCE_ROOT/README.md" "$TARGET_ROOT/README.md"
cp "$SOURCE_ROOT/worker/src/index.ts" "$TARGET_ROOT/worker/src/index.ts"
cp "$SOURCE_ROOT/docs/PERFORMANCE_AND_RESILIENCY.md" "$TARGET_ROOT/docs/PERFORMANCE_AND_RESILIENCY.md"
cp "$SOURCE_ROOT/docs/TROUBLESHOOTING.md" "$TARGET_ROOT/docs/TROUBLESHOOTING.md"
cp "$SOURCE_ROOT/scripts/apply_worker_article_recovery_fix.sh" "$TARGET_ROOT/scripts/apply_worker_article_recovery_fix.sh"

chmod +x "$TARGET_ROOT/scripts/apply_worker_article_recovery_fix.sh"

echo "Worker article recovery fix applied to: $TARGET_ROOT"
echo
echo "Updated files:"
echo "  README.md"
echo "  worker/src/index.ts"
echo "  docs/PERFORMANCE_AND_RESILIENCY.md"
echo "  docs/TROUBLESHOOTING.md"
echo "  scripts/apply_worker_article_recovery_fix.sh"
echo
echo "Next commands:"
echo "  cd $TARGET_ROOT/worker && npm install && npm run generate:wrangler && npx tsc --noEmit"
echo "  cd $TARGET_ROOT/worker && npx wrangler deploy --config generated-wrangler/wrangler.shard0.jsonc"
echo "  curl \"https://nutsnews-worker-0.nutsnews.workers.dev/?limit=6&imageLookups=8\""
echo "  cd $TARGET_ROOT/worker && npm run deploy:all"
echo "  cd $TARGET_ROOT && git add README.md worker/src/index.ts docs/PERFORMANCE_AND_RESILIENCY.md docs/TROUBLESHOOTING.md scripts/apply_worker_article_recovery_fix.sh"
echo "  cd $TARGET_ROOT && git commit -m \"Improve Worker article recovery\""
echo "  cd $TARGET_ROOT && git push"
