#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ROOT="${1:-$(pwd)}"

if [[ ! -f "$SOURCE_ROOT/docs/CONTROLLER_AND_SHARDS.md" ]]; then
  echo "ERROR: Could not find extracted issue #37 docs."
  exit 1
fi

if [[ ! -f "$TARGET_ROOT/README.md" || ! -d "$TARGET_ROOT/docs" ]]; then
  echo "ERROR: Target does not look like the NutsNews repo root with docs/: $TARGET_ROOT"
  echo "Usage: bash scripts/apply_issue_37_controller_docs.sh /path/to/nutsnews2"
  exit 1
fi

mkdir -p "$TARGET_ROOT/docs" "$TARGET_ROOT/scripts"

cp "$SOURCE_ROOT/README.md" "$TARGET_ROOT/README.md"
cp "$SOURCE_ROOT/docs/README.md" "$TARGET_ROOT/docs/README.md"
cp "$SOURCE_ROOT/docs/CONTROLLER_AND_SHARDS.md" "$TARGET_ROOT/docs/CONTROLLER_AND_SHARDS.md"
cp "$SOURCE_ROOT/docs/OPERATIONS.md" "$TARGET_ROOT/docs/OPERATIONS.md"
cp "$SOURCE_ROOT/docs/TROUBLESHOOTING.md" "$TARGET_ROOT/docs/TROUBLESHOOTING.md"
cp "$SOURCE_ROOT/docs/OBSERVABILITY.md" "$TARGET_ROOT/docs/OBSERVABILITY.md"
cp "$SOURCE_ROOT/scripts/apply_issue_37_controller_docs.sh" "$TARGET_ROOT/scripts/apply_issue_37_controller_docs.sh"

chmod +x "$TARGET_ROOT/scripts/apply_issue_37_controller_docs.sh"

echo "Issue #37 controller and shard docs applied to: $TARGET_ROOT"
echo
echo "Updated files:"
echo "  README.md"
echo "  docs/README.md"
echo "  docs/CONTROLLER_AND_SHARDS.md"
echo "  docs/OPERATIONS.md"
echo "  docs/TROUBLESHOOTING.md"
echo "  docs/OBSERVABILITY.md"
echo "  scripts/apply_issue_37_controller_docs.sh"
echo
echo "Next commands:"
echo "  cd $TARGET_ROOT && git status"
echo "  cd $TARGET_ROOT && git add README.md docs/README.md docs/CONTROLLER_AND_SHARDS.md docs/OPERATIONS.md docs/TROUBLESHOOTING.md docs/OBSERVABILITY.md scripts/apply_issue_37_controller_docs.sh"
echo "  cd $TARGET_ROOT && git commit -m \"Add controller and shard operations docs\""
echo "  cd $TARGET_ROOT && git push"
