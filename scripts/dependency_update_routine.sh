#!/usr/bin/env bash
set -Eeuo pipefail

print_usage() {
  cat <<'USAGE'
NutsNews dependency update routine

Usage:
  ./scripts/dependency_update_routine.sh check
  ./scripts/dependency_update_routine.sh update

Modes:
  check   Install from lockfiles, capture npm outdated/audit output, and run validation checks.
  update  Do everything in check mode, then run npm update --save for safe patch/minor updates allowed by package.json ranges.

Important:
  This script intentionally does not run npm audit fix --force.
  Major upgrades should be handled in their own issue/branch after reading release notes.
USAGE
}

MODE="${1:-check}"
case "$MODE" in
  check|update)
    ;;
  -h|--help|help)
    print_usage
    exit 0
    ;;
  *)
    echo "ERROR: unsupported mode: $MODE" >&2
    print_usage
    exit 1
    ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_ROOT="${DEPENDENCY_REPORT_ROOT:-$REPO_ROOT/dependency-update-reports/$TIMESTAMP}"
PROJECTS=("web" "worker" "controller")

mkdir -p "$REPORT_ROOT"

SUMMARY_FILE="$REPORT_ROOT/summary.md"

cat > "$SUMMARY_FILE" <<EOF_SUMMARY
# NutsNews Dependency Update Report

Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Mode: $MODE
Repository: $REPO_ROOT

## Projects

EOF_SUMMARY

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "ERROR: $command_name is required but was not found in PATH." >&2
    exit 1
  fi
}

run_required() {
  local log_file="$1"
  shift
  {
    echo
    echo "\$ $*"
    "$@"
  } 2>&1 | tee -a "$log_file"
  local status="${PIPESTATUS[0]}"
  if [[ "$status" -ne 0 ]]; then
    echo "ERROR: command failed with status $status: $*" | tee -a "$log_file"
    exit "$status"
  fi
}

run_nonfatal() {
  local log_file="$1"
  shift
  set +e
  {
    echo
    echo "\$ $*"
    "$@"
  } 2>&1 | tee -a "$log_file"
  local status="${PIPESTATUS[0]}"
  set -e
  if [[ "$status" -ne 0 ]]; then
    echo "NOTE: command exited with status $status and was recorded for review: $*" | tee -a "$log_file"
  fi
  return 0
}

has_npm_script() {
  local script_name="$1"
  node -e "const pkg=require('./package.json'); process.exit(pkg.scripts && pkg.scripts['$script_name'] ? 0 : 1)" >/dev/null 2>&1
}

install_dependencies() {
  local log_file="$1"
  if [[ -f package-lock.json ]]; then
    run_required "$log_file" npm ci
  else
    run_required "$log_file" npm install
  fi
}

validate_project() {
  local project_name="$1"
  local log_file="$2"

  case "$project_name" in
    web)
      if has_npm_script lint; then
        run_required "$log_file" npm run lint
      fi
      run_required "$log_file" npm run build
      ;;
    worker)
      if has_npm_script generate:wrangler; then
        run_required "$log_file" npm run generate:wrangler
      fi
      if [[ -f tsconfig.json ]]; then
        run_required "$log_file" npx tsc --noEmit --project tsconfig.json
      fi
      ;;
    controller)
      if [[ -f tsconfig.json ]]; then
        run_required "$log_file" npx tsc --noEmit --project tsconfig.json
      else
        echo "No controller tsconfig.json found; skipping TypeScript compile for controller." | tee -a "$log_file"
      fi
      ;;
    *)
      if has_npm_script build; then
        run_required "$log_file" npm run build
      fi
      if [[ -f tsconfig.json ]]; then
        run_required "$log_file" npx tsc --noEmit --project tsconfig.json
      fi
      ;;
  esac
}

require_command node
require_command npm

for project in "${PROJECTS[@]}"; do
  PROJECT_DIR="$REPO_ROOT/$project"

  if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
    echo "Skipping $project because package.json was not found." | tee -a "$SUMMARY_FILE"
    continue
  fi

  PROJECT_REPORT_DIR="$REPORT_ROOT/$project"
  mkdir -p "$PROJECT_REPORT_DIR"
  LOG_FILE="$PROJECT_REPORT_DIR/routine.log"

  echo "Running dependency routine for $project..."
  echo "* $project" >> "$SUMMARY_FILE"

  pushd "$PROJECT_DIR" >/dev/null

  node --version | tee -a "$LOG_FILE"
  npm --version | tee -a "$LOG_FILE"

  cp package.json "$PROJECT_REPORT_DIR/package.before.json"
  if [[ -f package-lock.json ]]; then
    cp package-lock.json "$PROJECT_REPORT_DIR/package-lock.before.json"
  fi

  install_dependencies "$LOG_FILE"

  run_nonfatal "$LOG_FILE" npm outdated --long
  run_nonfatal "$LOG_FILE" npm audit --audit-level=moderate

  if [[ "$MODE" == "update" ]]; then
    echo "Applying safe npm update for $project..." | tee -a "$LOG_FILE"
    run_required "$LOG_FILE" npm update --save
    run_nonfatal "$LOG_FILE" npm audit --audit-level=moderate
  fi

  validate_project "$project" "$LOG_FILE"

  cp package.json "$PROJECT_REPORT_DIR/package.after.json"
  if [[ -f package-lock.json ]]; then
    cp package-lock.json "$PROJECT_REPORT_DIR/package-lock.after.json"
  fi

  popd >/dev/null

done

cat >> "$SUMMARY_FILE" <<EOF_SUMMARY

## Review Checklist

- [ ] Review each project npm audit output.
- [ ] Review each project npm outdated output.
- [ ] Confirm no npm audit fix --force was used.
- [ ] Confirm web build passed.
- [ ] Confirm Worker TypeScript check passed when Worker dependencies changed.
- [ ] Commit package.json/package-lock.json changes only after review.

## Report Location

\`$REPORT_ROOT\`
EOF_SUMMARY

if command -v git >/dev/null 2>&1 && [[ -d "$REPO_ROOT/.git" ]]; then
  echo
  echo "Git diff summary:"
  git -C "$REPO_ROOT" status --short
  git -C "$REPO_ROOT" diff --stat -- web/package.json web/package-lock.json worker/package.json worker/package-lock.json controller/package.json controller/package-lock.json || true
fi

echo
echo "Dependency update routine completed."
echo "Report: $REPORT_ROOT"
echo
echo "Next steps:"
echo "  1. Review $SUMMARY_FILE"
echo "  2. Review package.json/package-lock.json diffs"
echo "  3. Commit safe dependency changes"
