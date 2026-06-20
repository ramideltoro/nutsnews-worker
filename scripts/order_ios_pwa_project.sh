#!/usr/bin/env bash
set -euo pipefail

OWNER="ramideltoro"
PROJECT_NUMBER="4"
FIELD_NAME="Implementation Order"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh is required. Install with: brew install gh"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required."
  exit 1
fi

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "ERROR: gh is not authenticated."
  echo "Run:"
  echo "  gh auth login --hostname github.com"
  exit 1
fi

echo "Refreshing GitHub CLI project scope..."
gh auth refresh --hostname github.com --scopes project >/dev/null

echo "Loading project id..."
PROJECT_ID="$(
  gh project view "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --format json \
    --jq '.id'
)"

echo "Project id: $PROJECT_ID"

echo "Checking for field: $FIELD_NAME"
FIELD_ID="$(
  gh project field-list "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --format json \
    --jq ".fields[] | select(.name == \"$FIELD_NAME\") | .id" \
    | head -n 1
)"

if [[ -z "$FIELD_ID" ]]; then
  echo "Creating field: $FIELD_NAME"
  FIELD_ID="$(
    gh project field-create "$PROJECT_NUMBER" \
      --owner "$OWNER" \
      --name "$FIELD_NAME" \
      --data-type NUMBER \
      --format json \
      --jq '.id'
  )"
fi

echo "Field id: $FIELD_ID"

ITEMS_FILE="$(mktemp)"

cleanup() {
  rm -f "$ITEMS_FILE"
}

trap cleanup EXIT

echo "Loading project items..."

gh project item-list "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --limit 200 \
  --format json \
  > "$ITEMS_FILE"

python3 - "$ITEMS_FILE" "$PROJECT_ID" "$FIELD_ID" <<'PY'
import json
import subprocess
import sys

items_file = sys.argv[1]
project_id = sys.argv[2]
field_id = sys.argv[3]

# PWA MVP implementation order.
# 98/99 are intentionally backlog/later decision items.
issue_order = [
    (49, 1),   # Define scope
    (50, 2),   # Manifest
    (51, 3),   # Icons
    (52, 4),   # Apple meta tags
    (53, 5),   # Splash/startup
    (54, 6),   # Offline fallback
    (55, 7),   # Service worker caching
    (72, 8),   # Update/version strategy
    (73, 9),   # Rollback/safety plan
    (57, 10),  # App shell layout
    (58, 11),  # Safe-area CSS
    (59, 12),  # Installed-mode detection
    (56, 13),  # Install instructions
    (74, 14),  # Homepage install CTA
    (60, 15),  # Web Share
    (62, 16),  # Analytics
    (63, 17),  # Sentry context
    (64, 18),  # CDN/cache validation
    (76, 19),  # Production smoke test
    (65, 20),  # Lighthouse audit
    (66, 21),  # iPhone test
    (67, 22),  # iPad test
    (75, 23),  # Privacy policy
    (68, 24),  # QA checklist
    (69, 25),  # Docs
    (77, 26),  # Final launch checklist
    (71, 27),  # Release announcement
    (61, 98),  # Backlog: push notifications
    (70, 99),  # Backlog: native wrapper/App Store decision
]

payload = json.loads(open(items_file, "r", encoding="utf-8").read())

item_by_issue_number = {}

for item in payload.get("items", []):
    content = item.get("content") or {}
    number = content.get("number")
    item_id = item.get("id")

    if isinstance(number, int) and item_id:
        item_by_issue_number[number] = item_id

missing = []

for issue_number, order_value in issue_order:
    item_id = item_by_issue_number.get(issue_number)

    if not item_id:
        missing.append(issue_number)
        continue

    print(f"Setting issue #{issue_number} -> {order_value}")

    subprocess.run(
        [
            "gh",
            "project",
            "item-edit",
            "--id",
            item_id,
            "--project-id",
            project_id,
            "--field-id",
            field_id,
            "--number",
            str(order_value),
        ],
        check=True,
    )

if missing:
    print()
    print("WARNING: These issues were not found in the project:")
    for issue_number in missing:
        print(f"  #{issue_number}")
else:
    print()
    print("All issue order values were updated.")
PY

echo
echo "Done."
echo "Open the project:"
echo "  gh project view $PROJECT_NUMBER --owner $OWNER --web"
echo
echo "In GitHub Projects, sort the view by:"
echo "  Implementation Order ascending"
