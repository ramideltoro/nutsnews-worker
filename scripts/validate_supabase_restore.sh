#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATION_SQL="$REPO_ROOT/supabase/restore_validation.sql"
DUMP_FILE="${1:-}"

if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "ERROR: RESTORE_DATABASE_URL is required."
  echo
  echo "Example:"
  echo "  RESTORE_DATABASE_URL=\"postgresql://postgres:<password>@<host>:5432/postgres\" $0"
  echo
  echo "Optional dump validation:"
  echo "  RESTORE_DATABASE_URL=\"postgresql://...\" $0 backups/supabase/latest/nutsnews.dump"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not installed or not available in PATH."
  exit 1
fi

if [[ ! -f "$VALIDATION_SQL" ]]; then
  echo "ERROR: Missing validation SQL: $VALIDATION_SQL"
  exit 1
fi

if [[ -n "$DUMP_FILE" ]]; then
  if [[ ! -f "$DUMP_FILE" ]]; then
    echo "ERROR: Dump file not found: $DUMP_FILE"
    exit 1
  fi

  if ! command -v pg_restore >/dev/null 2>&1; then
    echo "ERROR: pg_restore is required to inspect dump files."
    exit 1
  fi

  echo "Inspecting dump file:"
  echo "  $DUMP_FILE"
  pg_restore --list "$DUMP_FILE" >/dev/null
  echo "Dump file is readable."
  echo
fi

echo "Running NutsNews Supabase restore validation SQL..."
echo "Database URL: [hidden]"
echo

psql "$RESTORE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$VALIDATION_SQL"

echo
echo "Restore validation completed."
echo
echo "If this was a temporary restore test, record the result in:"
echo "  backups/supabase/<date>/restore-test-record.md"
