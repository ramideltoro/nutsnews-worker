#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ROOT="${1:-$(pwd)}"

if [[ ! -f "$SOURCE_ROOT/docs/DEPLOYMENT_CHECKLIST.md" || ! -f "$SOURCE_ROOT/scripts/post_deploy_verify.sh" ]]; then
  echo "ERROR: Could not find extracted issue #29 deployment checklist files."
  exit 1
fi

if [[ ! -f "$TARGET_ROOT/README.md" || ! -d "$TARGET_ROOT/docs" ]]; then
  echo "ERROR: Target does not look like the NutsNews repo root with docs/: $TARGET_ROOT"
  echo "Usage: bash scripts/apply_issue_29_deployment_checklist.sh /path/to/nutsnews2"
  exit 1
fi

mkdir -p "$TARGET_ROOT/docs" "$TARGET_ROOT/scripts"

cp "$SOURCE_ROOT/README.md" "$TARGET_ROOT/README.md"
cp "$SOURCE_ROOT/docs/README.md" "$TARGET_ROOT/docs/README.md"
cp "$SOURCE_ROOT/docs/DEPLOYMENT_CHECKLIST.md" "$TARGET_ROOT/docs/DEPLOYMENT_CHECKLIST.md"
cp "$SOURCE_ROOT/docs/OPERATIONS.md" "$TARGET_ROOT/docs/OPERATIONS.md"
cp "$SOURCE_ROOT/docs/TROUBLESHOOTING.md" "$TARGET_ROOT/docs/TROUBLESHOOTING.md"
cp "$SOURCE_ROOT/docs/PERFORMANCE_AND_RESILIENCY.md" "$TARGET_ROOT/docs/PERFORMANCE_AND_RESILIENCY.md"
cp "$SOURCE_ROOT/scripts/post_deploy_verify.sh" "$TARGET_ROOT/scripts/post_deploy_verify.sh"
cp "$SOURCE_ROOT/scripts/apply_issue_29_deployment_checklist.sh" "$TARGET_ROOT/scripts/apply_issue_29_deployment_checklist.sh"

chmod +x "$TARGET_ROOT/scripts/post_deploy_verify.sh"
chmod +x "$TARGET_ROOT/scripts/apply_issue_29_deployment_checklist.sh"

echo "Issue #29 deployment checklist applied to: $TARGET_ROOT"
echo
echo "Updated files:"
echo "  README.md"
echo "  docs/README.md"
echo "  docs/DEPLOYMENT_CHECKLIST.md"
echo "  docs/OPERATIONS.md"
echo "  docs/TROUBLESHOOTING.md"
echo "  docs/PERFORMANCE_AND_RESILIENCY.md"
echo "  scripts/post_deploy_verify.sh"
echo "  scripts/apply_issue_29_deployment_checklist.sh"
echo
echo "Next commands:"
echo "  cd $TARGET_ROOT && git status"
echo "  cd $TARGET_ROOT && ./scripts/post_deploy_verify.sh"
echo "  cd $TARGET_ROOT && git add README.md docs/README.md docs/DEPLOYMENT_CHECKLIST.md docs/OPERATIONS.md docs/TROUBLESHOOTING.md docs/PERFORMANCE_AND_RESILIENCY.md scripts/post_deploy_verify.sh scripts/apply_issue_29_deployment_checklist.sh"
echo "  cd $TARGET_ROOT && git commit -m "Create deployment checklist""
echo "  cd $TARGET_ROOT && git push"
