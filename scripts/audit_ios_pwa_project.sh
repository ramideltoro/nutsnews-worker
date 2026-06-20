#!/usr/bin/env bash
set -euo pipefail

OWNER="ramideltoro"
REPO="ramideltoro/nutsnews"
PROJECT_NUMBER="4"
OUTPUT_FILE="reports/ios-pwa-project-4-audit.md"
TMP_ITEMS_FILE="$(mktemp)"
TMP_ISSUES_FILE="$(mktemp)"

cleanup() {
  rm -f "$TMP_ITEMS_FILE" "$TMP_ISSUES_FILE"
}

trap cleanup EXIT

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

mkdir -p "$(dirname "$OUTPUT_FILE")"

cat > "$OUTPUT_FILE" <<MD
# NutsNews iOS PWA Project Audit

Project: https://github.com/users/$OWNER/projects/$PROJECT_NUMBER/views/1

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

---

## Project Issues

MD

echo "Loading project items..."

gh project item-list "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --limit 200 \
  --format json \
  > "$TMP_ITEMS_FILE"

python3 - "$TMP_ITEMS_FILE" "$TMP_ISSUES_FILE" <<'PY'
import json
import sys

items_file = sys.argv[1]
out_file = sys.argv[2]

with open(items_file, "r", encoding="utf-8") as f:
    payload = json.load(f)

issue_urls = []

for item in payload.get("items", []):
    content = item.get("content") or {}
    if content.get("type") == "Issue" and content.get("url"):
        issue_urls.append(content["url"])

with open(out_file, "w", encoding="utf-8") as f:
    for url in issue_urls:
        f.write(url + "\n")
PY

if [[ ! -s "$TMP_ISSUES_FILE" ]]; then
  echo "No issue items found in project."
  echo "No issue items found in project." >> "$OUTPUT_FILE"
  exit 0
fi

COUNT=0

while IFS= read -r ISSUE_URL; do
  [[ -z "$ISSUE_URL" ]] && continue

  ISSUE_NUMBER="${ISSUE_URL##*/}"
  COUNT=$((COUNT + 1))

  echo "Reading issue #$ISSUE_NUMBER..."

  ISSUE_JSON="$(gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json number,title,state,labels,body,url)"

  python3 - "$ISSUE_JSON" "$OUTPUT_FILE" "$COUNT" <<'PY'
import json
import sys

issue = json.loads(sys.argv[1])
output_file = sys.argv[2]
count = sys.argv[3]

labels = ", ".join(label["name"] for label in issue.get("labels", [])) or "none"
body = issue.get("body") or ""

with open(output_file, "a", encoding="utf-8") as f:
    f.write(f"### {count}. #{issue['number']} - {issue['title']}\n\n")
    f.write(f"- State: {issue['state']}\n")
    f.write(f"- URL: {issue['url']}\n")
    f.write(f"- Labels: {labels}\n\n")
    f.write("#### Body\n\n")
    f.write(body.strip() + "\n\n")
    f.write("---\n\n")
PY

done < "$TMP_ISSUES_FILE"

cat >> "$OUTPUT_FILE" <<MD

## Coverage Checklist

Use this checklist to confirm the board covers the full iOS PWA implementation:

- [ ] PWA manifest
- [ ] iOS app icons
- [ ] Apple mobile web app meta tags
- [ ] Splash/startup strategy
- [ ] Offline fallback page
- [ ] Service worker/app shell caching
- [ ] Service worker update/version strategy
- [ ] Service worker rollback/safety plan
- [ ] iPhone install instructions
- [ ] Homepage install CTA
- [ ] Installed-mode detection
- [ ] iPhone safe-area support
- [ ] iPhone real-device QA
- [ ] iPad real-device QA
- [ ] Web Share support
- [ ] PWA analytics
- [ ] Sentry PWA context
- [ ] CDN/cache validation
- [ ] Lighthouse PWA audit
- [ ] Privacy policy link/page
- [ ] Production PWA smoke test script
- [ ] PWA documentation
- [ ] Final launch checklist

MD

echo
echo "Done."
echo "Created: $OUTPUT_FILE"
