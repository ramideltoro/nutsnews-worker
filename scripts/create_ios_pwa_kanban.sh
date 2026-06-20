#!/usr/bin/env bash
set -euo pipefail

OWNER="ramideltoro"
REPO="nutsnews"
REPO_FULL="$OWNER/$REPO"
PROJECT_TITLE="NutsNews iOS PWA Launch"
MILESTONE_TITLE="iOS PWA Launch"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Missing required command: $1"
    echo
    echo "Install GitHub CLI first:"
    echo "  brew install gh"
    exit 1
  fi
}

ensure_auth() {
  if ! gh auth status >/dev/null 2>&1; then
    echo "You are not logged in to GitHub CLI."
    echo "Run:"
    echo "  gh auth login"
    exit 1
  fi

  echo "Refreshing GitHub CLI auth for project scope..."
  gh auth refresh -s project
}

create_or_update_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  gh label create "$name" \
    --repo "$REPO_FULL" \
    --color "$color" \
    --description "$description" \
    --force \
    >/dev/null
}

get_or_create_milestone() {
  local number

  number="$(
    gh api "repos/$REPO_FULL/milestones?state=all" \
      --jq ".[] | select(.title == \"$MILESTONE_TITLE\") | .number" \
      | head -n 1
  )"

  if [[ -z "$number" ]]; then
    number="$(
      gh api "repos/$REPO_FULL/milestones" \
        -f title="$MILESTONE_TITLE" \
        -f description="Track all work needed to turn NutsNews into an installable iOS Progressive Web App." \
        --jq ".number"
    )"
  fi

  echo "$number"
}

get_or_create_project() {
  local number

  number="$(
    gh project list --owner "$OWNER" --format json \
      --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number" \
      | head -n 1
  )"

  if [[ -z "$number" ]]; then
    number="$(
      gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq ".number"
    )"
  fi

  echo "$number"
}

find_issue_url_by_title() {
  local title="$1"

  gh issue list \
    --repo "$REPO_FULL" \
    --state all \
    --search "$title in:title" \
    --json title,url \
    --jq ".[] | select(.title == \"$title\") | .url" \
    | head -n 1
}

create_issue_if_missing() {
  local title="$1"
  local labels="$2"
  local body="$3"
  local milestone_number="$4"
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
      --repo "$REPO_FULL" \
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
  local project_number="$1"
  local issue_url="$2"

  if [[ -z "$issue_url" ]]; then
    return
  fi

  gh project item-add "$project_number" \
    --owner "$OWNER" \
    --url "$issue_url" \
    >/dev/null || true
}

create_task() {
  local title="$1"
  local labels="$2"
  local body="$3"
  local issue_url

  issue_url="$(create_issue_if_missing "$title" "$labels" "$body" "$MILESTONE_NUMBER" | tail -n 1)"
  add_issue_to_project "$PROJECT_NUMBER" "$issue_url"
}

require_command gh
ensure_auth

echo "Creating labels..."

create_or_update_label "area:pwa" "7C3AED" "Progressive Web App work"
create_or_update_label "area:ios" "0EA5E9" "iPhone and iPad specific work"
create_or_update_label "area:web" "2563EB" "Frontend, Next.js, UI, routing, SEO, and caching"
create_or_update_label "area:design" "F59E0B" "Visual design, icons, splash screens, and app polish"
create_or_update_label "area:performance" "22C55E" "Speed, caching, throughput, and resource efficiency"
create_or_update_label "area:observability" "14B8A6" "Monitoring, analytics, logging, and Sentry"
create_or_update_label "area:documentation" "6B7280" "Documentation and operating guides"
create_or_update_label "platform:ios-pwa" "111827" "Installable iOS PWA app experience"
create_or_update_label "priority:high" "EF4444" "High priority"
create_or_update_label "priority:medium" "F97316" "Medium priority"
create_or_update_label "priority:low" "94A3B8" "Low priority"
create_or_update_label "type:feature" "10B981" "New capability or product feature"
create_or_update_label "type:task" "6366F1" "Implementation task"
create_or_update_label "type:qa" "EC4899" "Testing and validation"
create_or_update_label "type:docs" "64748B" "Documentation work"

echo "Creating milestone..."
MILESTONE_NUMBER="$(get_or_create_milestone)"
echo "Milestone number: $MILESTONE_NUMBER"

echo "Creating project board..."
PROJECT_NUMBER="$(get_or_create_project)"
echo "Project number: $PROJECT_NUMBER"

create_task \
  "Define iOS PWA launch scope and acceptance criteria" \
  "area:pwa,platform:ios-pwa,priority:high,type:task" \
"## Goal
Define exactly what the first NutsNews iOS PWA launch needs to include.

## Tasks
- [ ] Define MVP PWA scope
- [ ] Decide what is required for launch vs backlog
- [ ] Define supported devices
- [ ] Define install flow
- [ ] Define QA checklist
- [ ] Define success metrics

## Acceptance criteria
- [ ] PWA launch requirements are clear
- [ ] Out-of-scope items are listed
- [ ] QA checklist exists
- [ ] Release can be tracked from this milestone"

create_task \
  "Add web app manifest for NutsNews PWA" \
  "area:pwa,area:web,platform:ios-pwa,priority:high,type:feature" \
"## Goal
Add a production-ready web app manifest.

## Tasks
- [ ] Create or update manifest file
- [ ] Set app name to NutsNews
- [ ] Set short name
- [ ] Set start URL
- [ ] Set display mode
- [ ] Set theme color
- [ ] Set background color
- [ ] Register manifest in Next.js metadata/head

## Acceptance criteria
- [ ] Browser detects manifest
- [ ] iOS add-to-home-screen uses NutsNews branding
- [ ] Lighthouse PWA audit detects the manifest"

create_task \
  "Create iOS app icons and maskable icons" \
  "area:pwa,area:design,platform:ios-pwa,priority:high,type:task" \
"## Goal
Create all icons needed for a polished installable app experience.

## Tasks
- [ ] Create 180x180 Apple touch icon
- [ ] Create 192x192 icon
- [ ] Create 512x512 icon
- [ ] Create maskable icon if needed
- [ ] Confirm icon uses NutsNews nut/amber theme
- [ ] Add icons to public assets
- [ ] Reference icons from manifest and metadata

## Acceptance criteria
- [ ] Home screen icon looks correct on iPhone
- [ ] Icon is not blurry
- [ ] Icon has correct safe padding
- [ ] Icon matches NutsNews brand"

create_task \
  "Add iOS Apple mobile web app meta tags" \
  "area:pwa,area:ios,area:web,platform:ios-pwa,priority:high,type:task" \
"## Goal
Add iOS-specific metadata so NutsNews behaves like an app when launched from the home screen.

## Tasks
- [ ] Add apple-mobile-web-app-capable
- [ ] Add apple-mobile-web-app-title
- [ ] Add apple-mobile-web-app-status-bar-style
- [ ] Add apple-touch-icon links
- [ ] Confirm metadata does not break SEO
- [ ] Confirm metadata works with Next.js app router

## Acceptance criteria
- [ ] NutsNews opens from home screen with app-style behavior
- [ ] Status bar looks good with dark/amber theme
- [ ] App title displays correctly"

create_task \
  "Create iOS splash screens and startup image strategy" \
  "area:pwa,area:ios,area:design,platform:ios-pwa,priority:medium,type:task" \
"## Goal
Decide and implement the iOS splash/startup experience.

## Tasks
- [ ] Decide whether static startup images are needed
- [ ] Create splash assets if required
- [ ] Match splash color to NutsNews dark/amber theme
- [ ] Test on iPhone sizes
- [ ] Document any iOS limitations

## Acceptance criteria
- [ ] App launch looks polished
- [ ] No white flash if avoidable
- [ ] Startup screen matches brand"

create_task \
  "Add offline fallback page" \
  "area:pwa,area:web,platform:ios-pwa,priority:high,type:feature" \
"## Goal
Show a friendly NutsNews offline page when the user is offline.

## Tasks
- [ ] Create offline route/page
- [ ] Match existing dark/amber theme
- [ ] Explain that new stories need internet
- [ ] Link back to home
- [ ] Add service worker routing to offline fallback

## Acceptance criteria
- [ ] Offline users see a branded fallback
- [ ] No ugly browser error page
- [ ] Offline page works after app install"

create_task \
  "Add service worker app shell caching" \
  "area:pwa,area:performance,area:web,platform:ios-pwa,priority:high,type:feature" \
"## Goal
Cache the app shell so the installed PWA loads quickly and has basic offline support.

## Tasks
- [ ] Add service worker
- [ ] Cache app shell assets
- [ ] Cache offline fallback page
- [ ] Avoid caching admin routes
- [ ] Avoid caching auth routes
- [ ] Avoid stale article data problems
- [ ] Document cache strategy

## Acceptance criteria
- [ ] Installed app shell opens quickly
- [ ] Offline fallback works
- [ ] Admin/auth routes are not cached incorrectly
- [ ] Public feed still respects freshness expectations"

create_task \
  "Add install instructions for iPhone users" \
  "area:pwa,area:ios,area:web,platform:ios-pwa,priority:high,type:feature" \
"## Goal
Guide users through installing NutsNews on iPhone.

## Tasks
- [ ] Add install/help page or install card
- [ ] Explain Safari share button flow
- [ ] Explain Add to Home Screen
- [ ] Include screenshots later if needed
- [ ] Keep copy short and friendly
- [ ] Hide or soften install prompt when already installed if possible

## Acceptance criteria
- [ ] iPhone user can follow instructions
- [ ] Install flow is easy to understand
- [ ] Page matches NutsNews style"

create_task \
  "Improve mobile app shell layout for installed mode" \
  "area:pwa,area:ios,area:web,area:design,platform:ios-pwa,priority:high,type:task" \
"## Goal
Make NutsNews feel more like a real app when launched from the iOS home screen.

## Tasks
- [ ] Review spacing in standalone display mode
- [ ] Handle safe area insets
- [ ] Confirm sticky/footer behavior
- [ ] Confirm scroll behavior
- [ ] Confirm no browser-only UI assumptions
- [ ] Confirm article cards feel native on iPhone

## Acceptance criteria
- [ ] Installed PWA feels polished
- [ ] No content is hidden behind notch/home indicator
- [ ] Feed scroll feels smooth"

create_task \
  "Add iOS safe-area CSS support" \
  "area:pwa,area:ios,area:web,platform:ios-pwa,priority:medium,type:task" \
"## Goal
Make the UI work correctly around iPhone notch, Dynamic Island, and home indicator areas.

## Tasks
- [ ] Add env(safe-area-inset-top) support where needed
- [ ] Add env(safe-area-inset-bottom) support where needed
- [ ] Test footer and sticky UI
- [ ] Test portrait orientation
- [ ] Test landscape orientation if supported

## Acceptance criteria
- [ ] No important UI is clipped
- [ ] App looks good on modern iPhones
- [ ] App remains usable in installed mode"

create_task \
  "Add PWA install detection and app-mode polish" \
  "area:pwa,area:web,platform:ios-pwa,priority:medium,type:feature" \
"## Goal
Detect when NutsNews is running as an installed PWA and adjust UI messaging.

## Tasks
- [ ] Detect standalone display mode where supported
- [ ] Avoid showing install instructions inside installed app
- [ ] Optionally add subtle installed-app polish
- [ ] Document limitations

## Acceptance criteria
- [ ] Install prompts are not annoying
- [ ] Installed experience feels intentional"

create_task \
  "Add Web Share support for article cards" \
  "area:pwa,area:web,platform:ios-pwa,priority:medium,type:feature" \
"## Goal
Let users share uplifting stories using the native iOS share sheet where available.

## Tasks
- [ ] Add share action to article cards or article pages
- [ ] Use Web Share API when available
- [ ] Fallback to copy link
- [ ] Track share event if analytics is available
- [ ] Keep UI clean and mobile friendly

## Acceptance criteria
- [ ] Share works on iPhone Safari/PWA
- [ ] Fallback works on unsupported browsers
- [ ] Article URLs are correct"

create_task \
  "Evaluate iOS web push notifications" \
  "area:pwa,area:ios,platform:ios-pwa,priority:low,type:task" \
"## Goal
Decide whether NutsNews should support push notifications for new uplifting stories.

## Tasks
- [ ] Review iOS PWA push support requirements
- [ ] Decide if notifications are part of MVP
- [ ] Define opt-in copy
- [ ] Define notification frequency
- [ ] Consider user trust and calm-news positioning
- [ ] Create follow-up implementation issue if needed

## Acceptance criteria
- [ ] Clear yes/no decision for MVP
- [ ] If yes, implementation plan exists
- [ ] If no, backlog item exists"

create_task \
  "Add installed PWA analytics events" \
  "area:pwa,area:observability,platform:ios-pwa,priority:medium,type:task" \
"## Goal
Understand whether users install and use the PWA.

## Tasks
- [ ] Track visits to install page
- [ ] Track install CTA clicks where possible
- [ ] Track standalone/app-mode sessions where possible
- [ ] Track article reads from installed app
- [ ] Keep analytics privacy-friendly

## Acceptance criteria
- [ ] Basic PWA usage can be measured
- [ ] Data helps decide next mobile investments"

create_task \
  "Add Sentry context for PWA mode" \
  "area:pwa,area:observability,platform:ios-pwa,priority:medium,type:task" \
"## Goal
Make PWA-specific bugs easier to debug.

## Tasks
- [ ] Add standalone/app-mode context where possible
- [ ] Add browser/device context
- [ ] Confirm errors from installed mode reach Sentry
- [ ] Document known iOS limitations

## Acceptance criteria
- [ ] PWA errors can be distinguished from normal browser errors
- [ ] Debugging installed app issues is easier"

create_task \
  "Validate CDN and cache behavior for PWA assets" \
  "area:pwa,area:performance,area:web,platform:ios-pwa,priority:high,type:qa" \
"## Goal
Make sure PWA assets are cached correctly without breaking updates.

## Tasks
- [ ] Check manifest cache headers
- [ ] Check icon cache headers
- [ ] Check service worker cache headers
- [ ] Check offline page cache behavior
- [ ] Confirm new deploys update safely
- [ ] Confirm Cloudflare does not cache admin/auth routes

## Acceptance criteria
- [ ] PWA assets load quickly
- [ ] Updates are not stuck forever
- [ ] Public app shell caching is safe"

create_task \
  "Run Lighthouse PWA audit" \
  "area:pwa,area:performance,area:web,platform:ios-pwa,priority:high,type:qa" \
"## Goal
Use Lighthouse to catch missing PWA requirements and performance regressions.

## Tasks
- [ ] Run Lighthouse mobile audit
- [ ] Review PWA category
- [ ] Review performance category
- [ ] Fix critical PWA misses
- [ ] Save results or summary in the issue

## Acceptance criteria
- [ ] PWA audit passes key checks
- [ ] Performance remains acceptable
- [ ] Any remaining limitations are documented"

create_task \
  "Test install flow on real iPhone" \
  "area:pwa,area:ios,platform:ios-pwa,priority:high,type:qa" \
"## Goal
Confirm NutsNews can be installed and used from a real iPhone home screen.

## Tasks
- [ ] Open site in Safari
- [ ] Use Share button
- [ ] Add to Home Screen
- [ ] Launch from icon
- [ ] Check app title
- [ ] Check icon
- [ ] Check status bar
- [ ] Check feed scrolling
- [ ] Check article links
- [ ] Check offline fallback

## Acceptance criteria
- [ ] Install works on iPhone
- [ ] App launches correctly
- [ ] Feed and article links work
- [ ] Offline behavior is acceptable"

create_task \
  "Test installed PWA on iPad" \
  "area:pwa,area:ios,platform:ios-pwa,priority:medium,type:qa" \
"## Goal
Confirm the installed PWA works well on iPad.

## Tasks
- [ ] Install from Safari on iPad
- [ ] Test portrait layout
- [ ] Test landscape layout
- [ ] Check card width and spacing
- [ ] Check scrolling
- [ ] Check share links
- [ ] Check offline fallback

## Acceptance criteria
- [ ] iPad layout is usable
- [ ] No major spacing or overflow issues
- [ ] Installed app launches correctly"

create_task \
  "Create PWA QA checklist" \
  "area:pwa,area:documentation,platform:ios-pwa,priority:medium,type:docs" \
"## Goal
Create a repeatable checklist for testing the iOS PWA before each release.

## Tasks
- [ ] Add QA checklist to docs
- [ ] Include install flow
- [ ] Include app shell
- [ ] Include offline
- [ ] Include cache update behavior
- [ ] Include iPhone/iPad checks
- [ ] Include rollback notes

## Acceptance criteria
- [ ] QA can be repeated before future releases
- [ ] Checklist is linked from README or docs index"

create_task \
  "Document iOS PWA implementation and operations" \
  "area:pwa,area:documentation,platform:ios-pwa,priority:medium,type:docs" \
"## Goal
Document how the NutsNews iOS PWA works and how to maintain it.

## Tasks
- [ ] Document manifest
- [ ] Document icons
- [ ] Document service worker
- [ ] Document cache strategy
- [ ] Document iOS install flow
- [ ] Document troubleshooting
- [ ] Update README/docs index

## Acceptance criteria
- [ ] Future maintenance is clear
- [ ] Operators know how to test the PWA
- [ ] Troubleshooting steps exist"

create_task \
  "Decide whether to build native wrapper later" \
  "area:pwa,area:ios,platform:ios-pwa,priority:low,type:task" \
"## Goal
Decide whether NutsNews should stay PWA-only or eventually use a wrapper like Capacitor for App Store release.

## Tasks
- [ ] Compare PWA-only vs native wrapper
- [ ] List App Store pros and cons
- [ ] List maintenance cost
- [ ] Decide if wrapper is needed after PWA MVP
- [ ] Create future issue if needed

## Acceptance criteria
- [ ] Clear decision recorded
- [ ] No native work blocks PWA launch"

create_task \
  "Prepare PWA release announcement and feedback loop" \
  "area:pwa,area:documentation,platform:ios-pwa,priority:low,type:task" \
"## Goal
Prepare a simple launch message and feedback path for the iOS PWA.

## Tasks
- [ ] Write short announcement copy
- [ ] Explain how to install on iPhone
- [ ] Add feedback route or contact path
- [ ] Track common issues
- [ ] Decide launch date after QA

## Acceptance criteria
- [ ] Users know how to install
- [ ] Feedback can be collected
- [ ] Launch messaging is ready"

echo
echo "Done."
echo "Project board:"
echo "  https://github.com/users/$OWNER/projects/$PROJECT_NUMBER"
echo
echo "Open it:"
echo "  gh project view $PROJECT_NUMBER --owner $OWNER --web"
echo
echo "Tip: In GitHub, switch the project view to Board layout and group by Status."
