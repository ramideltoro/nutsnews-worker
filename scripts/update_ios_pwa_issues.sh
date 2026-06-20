#!/usr/bin/env bash
set -euo pipefail

OWNER="ramideltoro"
REPO_NAME="nutsnews"
REPO="$OWNER/$REPO_NAME"
PROJECT_NUMBER="4"
MILESTONE_TITLE="iOS PWA Launch"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Missing required command: $1"
    echo "Install it with: brew install $1"
    exit 1
  fi
}

ensure_auth() {
  if ! gh auth status --hostname github.com >/dev/null 2>&1; then
    echo "ERROR: GitHub CLI is not authenticated."
    echo "Run:"
    echo "  gh auth login --hostname github.com"
    exit 1
  fi

  gh auth refresh --hostname github.com --scopes project >/dev/null
}

create_or_update_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  gh label create "$name" \
    --repo "$REPO" \
    --color "$color" \
    --description "$description" \
    --force \
    >/dev/null
}

get_or_create_milestone() {
  local number

  number="$(
    gh api "repos/$REPO/milestones?state=all" \
      --jq ".[] | select(.title == \"$MILESTONE_TITLE\") | .number" \
      | head -n 1
  )"

  if [[ -z "$number" ]]; then
    number="$(
      gh api "repos/$REPO/milestones" \
        -f title="$MILESTONE_TITLE" \
        -f description="Track all work needed to launch NutsNews as an installable iOS PWA." \
        --jq ".number"
    )"
  fi

  echo "$number"
}

find_issue_url_by_title() {
  local title="$1"

  gh issue list \
    --repo "$REPO" \
    --state all \
    --search "$title in:title" \
    --json title,url \
    --jq ".[] | select(.title == \"$title\") | .url" \
    | head -n 1
}

find_issue_number_by_title() {
  local title="$1"

  gh issue list \
    --repo "$REPO" \
    --state all \
    --search "$title in:title" \
    --json title,number \
    --jq ".[] | select(.title == \"$title\") | .number" \
    | head -n 1
}

create_issue_if_missing() {
  local title="$1"
  local labels="$2"
  local body="$3"
  local issue_url
  local body_file

  issue_url="$(find_issue_url_by_title "$title")"

  if [[ -n "$issue_url" ]]; then
    echo "Issue already exists: $title"
    echo "$issue_url"
    return
  fi

  body_file="$(mktemp)"
  printf "%s\n" "$body" > "$body_file"

  issue_url="$(
    gh issue create \
      --repo "$REPO" \
      --title "$title" \
      --body-file "$body_file" \
      --label "$labels" \
      --milestone "$MILESTONE_TITLE"
  )"

  rm -f "$body_file"

  echo "Created issue: $title"
  echo "$issue_url"
}

add_issue_to_project() {
  local issue_url="$1"

  if [[ -z "$issue_url" ]]; then
    return
  fi

  gh project item-add "$PROJECT_NUMBER" \
    --owner "$OWNER" \
    --url "$issue_url" \
    >/dev/null || true
}

create_task() {
  local title="$1"
  local labels="$2"
  local body="$3"
  local issue_url

  issue_url="$(create_issue_if_missing "$title" "$labels" "$body" | tail -n 1)"
  add_issue_to_project "$issue_url"
}

comment_if_missing() {
  local issue_number="$1"
  local marker="$2"
  local body="$3"
  local existing_count
  local body_file

  existing_count="$(
    gh issue view "$issue_number" \
      --repo "$REPO" \
      --comments \
      --json comments \
      --jq "[.comments[].body | select(contains(\"$marker\"))] | length"
  )"

  if [[ "$existing_count" != "0" ]]; then
    echo "Issue #$issue_number already has comment marker: $marker"
    return
  fi

  body_file="$(mktemp)"
  printf "%s\n" "$body" > "$body_file"

  gh issue comment "$issue_number" \
    --repo "$REPO" \
    --body-file "$body_file" \
    >/dev/null

  rm -f "$body_file"

  echo "Added comment to issue #$issue_number"
}

require_command gh
ensure_auth

echo "Ensuring labels..."

create_or_update_label "area:pwa" "7C3AED" "Progressive Web App work"
create_or_update_label "area:ios" "0EA5E9" "iPhone and iPad specific work"
create_or_update_label "area:web" "2563EB" "Frontend, Next.js, UI, routing, SEO, and caching"
create_or_update_label "area:performance" "22C55E" "Speed, caching, throughput, and resource efficiency"
create_or_update_label "area:documentation" "6B7280" "Documentation and operating guides"
create_or_update_label "area:privacy" "475569" "Privacy policy, privacy labels, and user trust"
create_or_update_label "platform:ios-pwa" "111827" "Installable iOS PWA app experience"
create_or_update_label "priority:high" "EF4444" "High priority"
create_or_update_label "priority:medium" "F97316" "Medium priority"
create_or_update_label "priority:low" "94A3B8" "Low priority"
create_or_update_label "type:feature" "10B981" "New capability or product feature"
create_or_update_label "type:task" "6366F1" "Implementation task"
create_or_update_label "type:qa" "EC4899" "Testing and validation"
create_or_update_label "type:docs" "64748B" "Documentation work"

echo "Ensuring milestone..."
MILESTONE_NUMBER="$(get_or_create_milestone)"
echo "Milestone: $MILESTONE_TITLE (#$MILESTONE_NUMBER)"

echo "Creating missing iOS PWA issues..."

create_task \
  "Add PWA update and version strategy" \
  "area:pwa,area:web,area:performance,platform:ios-pwa,priority:high,type:task" \
"## Goal
Make sure installed NutsNews PWA users receive new app versions safely after deployments.

## Tasks
- [ ] Define app shell versioning strategy
- [ ] Define service worker cache version naming
- [ ] Decide when old caches are deleted
- [ ] Decide whether users should be prompted to refresh after a new version
- [ ] Confirm article data does not get stuck stale
- [ ] Document the update flow

## Acceptance criteria
- [ ] New deploys can update installed PWA users
- [ ] Old caches are cleaned safely
- [ ] Public feed freshness is preserved
- [ ] Update behavior is documented"

create_task \
  "Add service worker rollback and safety plan" \
  "area:pwa,area:web,area:performance,platform:ios-pwa,priority:high,type:task" \
"## Goal
Prevent a bad service worker or cache strategy from breaking the installed app.

## Tasks
- [ ] Define how to disable the service worker if needed
- [ ] Define how to clear or invalidate bad caches
- [ ] Add emergency rollback steps
- [ ] Confirm admin/auth routes are never cached incorrectly
- [ ] Confirm a bad app shell cache can be recovered
- [ ] Document rollback in the PWA operations guide

## Acceptance criteria
- [ ] There is a safe recovery path for bad PWA deployments
- [ ] Cache rollback can be performed quickly
- [ ] Rollback steps are documented"

create_task \
  "Add homepage install CTA for iPhone PWA" \
  "area:pwa,area:ios,area:web,platform:ios-pwa,priority:medium,type:feature" \
"## Goal
Add a tasteful install call-to-action so iPhone users know NutsNews can be added to the home screen.

## Tasks
- [ ] Add install CTA or install card to homepage
- [ ] Keep it subtle and aligned with the dark amber theme
- [ ] Link to iPhone install instructions
- [ ] Avoid showing it too aggressively
- [ ] Hide or soften CTA when app is already installed where possible
- [ ] Confirm it does not hurt mobile layout

## Acceptance criteria
- [ ] iPhone users can discover the install option
- [ ] CTA matches NutsNews design
- [ ] CTA does not feel spammy"

create_task \
  "Add privacy policy page and link for PWA launch" \
  "area:pwa,area:web,area:privacy,area:documentation,platform:ios-pwa,priority:medium,type:docs" \
"## Goal
Add a simple privacy policy page/link before promoting the installable PWA.

## Tasks
- [ ] Create a privacy policy page or document
- [ ] Explain analytics usage
- [ ] Explain error monitoring usage
- [ ] Explain no account requirement for public readers
- [ ] Link privacy policy from footer or install page
- [ ] Confirm wording matches current data collection

## Acceptance criteria
- [ ] Users can access a privacy policy
- [ ] Analytics and monitoring are disclosed clearly
- [ ] PWA launch has a user-trust/privacy baseline"

create_task \
  "Add production PWA smoke test script" \
  "area:pwa,area:web,area:performance,platform:ios-pwa,priority:high,type:qa" \
"## Goal
Create a repeatable script that checks the production PWA basics after every deploy.

## Tasks
- [ ] Check homepage returns 200
- [ ] Check manifest returns 200
- [ ] Check icons return 200
- [ ] Check service worker returns 200 if enabled
- [ ] Check offline page returns 200
- [ ] Check cache headers for PWA assets
- [ ] Check /api/articles still works
- [ ] Print clear pass/fail output

## Acceptance criteria
- [ ] One command validates production PWA basics
- [ ] Script can be used during release checks
- [ ] Failures are easy to understand"

create_task \
  "Create final iOS PWA launch checklist" \
  "area:pwa,area:ios,area:documentation,platform:ios-pwa,priority:high,type:docs" \
"## Goal
Create the final release gate for launching the NutsNews iOS PWA.

## Tasks
- [ ] Confirm all implementation issues are complete
- [ ] Confirm production smoke test passes
- [ ] Confirm Lighthouse PWA audit passes
- [ ] Confirm real iPhone install test passes
- [ ] Confirm iPad test passes
- [ ] Confirm offline fallback works
- [ ] Confirm privacy policy is linked
- [ ] Confirm release announcement is ready
- [ ] Confirm rollback plan exists

## Acceptance criteria
- [ ] PWA launch has a final go/no-go checklist
- [ ] Checklist can be reused for future mobile releases
- [ ] Launch readiness is clear"

echo "Adding implementation order comment to #49..."

comment_if_missing \
  "49" \
  "IOS_PWA_IMPLEMENTATION_ORDER_V1" \
"<!-- IOS_PWA_IMPLEMENTATION_ORDER_V1 -->

## Recommended Implementation Order

1. #49 Define iOS PWA launch scope
2. #50 Add web app manifest
3. #51 Create iOS app icons
4. #52 Add Apple mobile web app meta tags
5. #53 Create splash/startup strategy
6. #54 Add offline fallback page
7. #55 Add service worker app shell caching
8. Add PWA update and version strategy
9. Add service worker rollback and safety plan
10. #57 Improve installed-mode app shell layout
11. #58 Add iOS safe-area CSS support
12. #59 Add PWA install detection/app-mode polish
13. #56 Add iPhone install instructions
14. Add homepage install CTA for iPhone PWA
15. #60 Add Web Share support
16. #62 Add installed PWA analytics events
17. #63 Add Sentry context for PWA mode
18. #64 Validate CDN/cache behavior for PWA assets
19. Add production PWA smoke test script
20. #65 Run Lighthouse PWA audit
21. #66 Test install flow on real iPhone
22. #67 Test installed PWA on iPad
23. Add privacy policy page and link for PWA launch
24. #68 Create PWA QA checklist
25. #69 Document iOS PWA implementation and operations
26. Create final iOS PWA launch checklist
27. #71 Prepare release announcement and feedback loop

## Backlog / Later Decision

- #61 Evaluate iOS web push notifications
- #70 Decide whether to build native wrapper later
"

echo
echo "Done."
echo "Updated project:"
echo "https://github.com/users/$OWNER/projects/$PROJECT_NUMBER/views/1"
