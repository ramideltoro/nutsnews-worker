#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ROOT="${1:-$(pwd)}"

if [[ ! -f "$SOURCE_ROOT/worker/src/index.ts" ]]; then
  echo "ERROR: Could not find worker/src/index.ts in the extracted fix bundle."
  exit 1
fi

if [[ ! -f "$TARGET_ROOT/README.md" || ! -d "$TARGET_ROOT/worker" ]]; then
  echo "ERROR: Target does not look like the NutsNews repo root: $TARGET_ROOT"
  echo "Usage: bash scripts/apply_worker_acceptance_fix.sh /path/to/nutsnews3"
  exit 1
fi

mkdir -p "$TARGET_ROOT/worker/src" "$TARGET_ROOT/scripts"

cp "$SOURCE_ROOT/worker/src/index.ts" "$TARGET_ROOT/worker/src/index.ts"
cp "$SOURCE_ROOT/NUTSNEWS_WORKER_ACCEPTANCE_FIX_README.md" "$TARGET_ROOT/NUTSNEWS_WORKER_ACCEPTANCE_FIX_README.md"
cp "$SOURCE_ROOT/scripts/apply_worker_acceptance_fix.sh" "$TARGET_ROOT/scripts/apply_worker_acceptance_fix.sh"
chmod +x "$TARGET_ROOT/scripts/apply_worker_acceptance_fix.sh"

echo "NutsNews Worker acceptance fix applied to: $TARGET_ROOT"
echo
echo "Updated files:"
echo "  worker/src/index.ts"
echo "  NUTSNEWS_WORKER_ACCEPTANCE_FIX_README.md"
echo "  scripts/apply_worker_acceptance_fix.sh"
echo
echo "Next commands:"
echo "  cd $TARGET_ROOT/worker"
echo "  npm install"
echo "  npm run generate:wrangler"
echo "  npx tsc --noEmit"
echo "  npm run deploy:all"
