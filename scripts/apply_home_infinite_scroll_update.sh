#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ROOT="${1:-$(pwd)}"

if [[ ! -f "$SOURCE_ROOT/web/app/components/ArticleFeed.tsx" || ! -f "$SOURCE_ROOT/web/app/page.tsx" ]]; then
  echo "ERROR: Could not find extracted homepage update files."
  exit 1
fi

if [[ ! -f "$TARGET_ROOT/README.md" || ! -d "$TARGET_ROOT/web/app" ]]; then
  echo "ERROR: Target does not look like the NutsNews repo root: $TARGET_ROOT"
  echo "Usage: bash scripts/apply_home_infinite_scroll_update.sh /path/to/nutsnews2"
  exit 1
fi

mkdir -p "$TARGET_ROOT/web/app/components" "$TARGET_ROOT/docs" "$TARGET_ROOT/scripts"

cp "$SOURCE_ROOT/README.md" "$TARGET_ROOT/README.md"
cp "$SOURCE_ROOT/web/app/page.tsx" "$TARGET_ROOT/web/app/page.tsx"
cp "$SOURCE_ROOT/web/app/components/ArticleFeed.tsx" "$TARGET_ROOT/web/app/components/ArticleFeed.tsx"
cp "$SOURCE_ROOT/docs/PERFORMANCE_AND_RESILIENCY.md" "$TARGET_ROOT/docs/PERFORMANCE_AND_RESILIENCY.md"
cp "$SOURCE_ROOT/scripts/apply_home_infinite_scroll_update.sh" "$TARGET_ROOT/scripts/apply_home_infinite_scroll_update.sh"

chmod +x "$TARGET_ROOT/scripts/apply_home_infinite_scroll_update.sh"

echo "Homepage infinite scroll update applied to: $TARGET_ROOT"
echo
echo "Updated files:"
echo "  README.md"
echo "  web/app/page.tsx"
echo "  web/app/components/ArticleFeed.tsx"
echo "  docs/PERFORMANCE_AND_RESILIENCY.md"
echo "  scripts/apply_home_infinite_scroll_update.sh"
echo
echo "Next commands:"
echo "  cd $TARGET_ROOT/web && npm run build"
echo "  cd $TARGET_ROOT && git add README.md web/app/page.tsx web/app/components/ArticleFeed.tsx docs/PERFORMANCE_AND_RESILIENCY.md scripts/apply_home_infinite_scroll_update.sh"
echo "  cd $TARGET_ROOT && git commit -m \"Add automatic article loading on scroll\""
echo "  cd $TARGET_ROOT && git push"
