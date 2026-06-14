#!/usr/bin/env bash
set -euo pipefail

# create_nutsnews_github_roadmap.sh
# Creates GitHub labels, milestones, issues, and a GitHub Projects roadmap for NutsNews.
#
# Requirements:
#   - GitHub CLI: https://cli.github.com/
#   - jq: https://jqlang.github.io/jq/
#   - GitHub auth with project scope:
#       gh auth login
#       gh auth refresh -s project
#
# Usage:
#   chmod +x scripts/create_nutsnews_github_roadmap.sh
#   ./scripts/create_nutsnews_github_roadmap.sh
#
# Optional environment overrides:
#   REPO="ramideltoro/nutsnews" PROJECT_OWNER="ramideltoro" PROJECT_TITLE="NutsNews Roadmap" ./scripts/create_nutsnews_github_roadmap.sh
#   DRY_RUN=true ./scripts/create_nutsnews_github_roadmap.sh

REPO="${REPO:-ramideltoro/nutsnews}"
PROJECT_OWNER="${PROJECT_OWNER:-ramideltoro}"
PROJECT_TITLE="${PROJECT_TITLE:-NutsNews Roadmap}"
ASSIGN_TO_ME="${ASSIGN_TO_ME:-true}"
DRY_RUN="${DRY_RUN:-false}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

json_escape_for_jq() {
  jq -Rn --arg value "$1" '$value'
}

require_command gh
require_command jq

if [[ "$DRY_RUN" != "true" ]]; then
  gh auth status >/dev/null
fi

echo "Repository: $REPO"
echo "Project owner: $PROJECT_OWNER"
echo "Project title: $PROJECT_TITLE"
echo "Dry run: $DRY_RUN"
echo

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  echo "Ensuring label: $name"
  run gh label create "$name" \
    --repo "$REPO" \
    --color "$color" \
    --description "$description" \
    --force >/dev/null
}

create_milestone() {
  local title="$1"
  local description="$2"

  echo "Ensuring milestone: $title"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] gh api /repos/$REPO/milestones ... $title"
    return 0
  fi

  local escaped_title
  escaped_title="$(json_escape_for_jq "$title")"

  local existing_number
  existing_number="$(gh api "/repos/$REPO/milestones?state=all&per_page=100" \
    --jq ".[] | select(.title == $escaped_title) | .number" | head -n 1 || true)"

  if [[ -n "$existing_number" ]]; then
    echo "Milestone already exists: $title (#$existing_number)"
    return 0
  fi

  gh api "/repos/$REPO/milestones" \
    --method POST \
    -f title="$title" \
    -f description="$description" >/dev/null
}

ensure_project() {
  echo "Ensuring GitHub Project: $PROJECT_TITLE"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] gh project list/create --owner $PROJECT_OWNER --title $PROJECT_TITLE"
    PROJECT_NUMBER="1"
    return 0
  fi

  local escaped_title
  escaped_title="$(json_escape_for_jq "$PROJECT_TITLE")"

  PROJECT_NUMBER="$(gh project list \
    --owner "$PROJECT_OWNER" \
    --format json \
    --jq ".projects[]? | select(.title == $escaped_title) | .number" | head -n 1 || true)"

  if [[ -z "${PROJECT_NUMBER:-}" ]]; then
    PROJECT_NUMBER="$(gh project create \
      --owner "$PROJECT_OWNER" \
      --title "$PROJECT_TITLE" \
      --format json \
      --jq '.number')"
    echo "Created project #$PROJECT_NUMBER"
  else
    echo "Project already exists: #$PROJECT_NUMBER"
  fi
}

existing_issue_url_by_title() {
  local title="$1"
  local escaped_title
  escaped_title="$(json_escape_for_jq "$title")"

  gh issue list \
    --repo "$REPO" \
    --state all \
    --limit 200 \
    --json number,title,url \
    --jq ".[] | select(.title == $escaped_title) | .url" | head -n 1 || true
}

create_issue_and_add_to_project() {
  local title="$1"
  local labels_csv="$2"
  local milestone="$3"
  local body="$4"

  echo
  echo "Processing issue: $title"

  local issue_url=""

  if [[ "$DRY_RUN" != "true" ]]; then
    issue_url="$(existing_issue_url_by_title "$title")"
  fi

  if [[ -n "$issue_url" ]]; then
    echo "Issue already exists: $issue_url"
  else
    local body_file
    body_file="$(mktemp)"
    printf '%s\n' "$body" > "$body_file"

    local args=(issue create --repo "$REPO" --title "$title" --body-file "$body_file")

    if [[ -n "$labels_csv" ]]; then
      args+=(--label "$labels_csv")
    fi

    if [[ -n "$milestone" ]]; then
      args+=(--milestone "$milestone")
    fi

    if [[ "$ASSIGN_TO_ME" == "true" ]]; then
      args+=(--assignee "@me")
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
      run gh "${args[@]}"
      issue_url="https://github.com/$REPO/issues/dry-run"
    else
      issue_url="$(gh "${args[@]}")"
    fi

    rm -f "$body_file"
    echo "Created issue: $issue_url"
  fi

  if [[ -n "${PROJECT_NUMBER:-}" ]]; then
    echo "Adding issue to project #$PROJECT_NUMBER"
    if [[ "$DRY_RUN" == "true" ]]; then
      run gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$issue_url" --format json
    else
      gh project item-add "$PROJECT_NUMBER" \
        --owner "$PROJECT_OWNER" \
        --url "$issue_url" \
        --format json >/dev/null || true
    fi
  fi
}

create_label "type:feature" "1D76DB" "New capability or product feature"
create_label "type:bug" "D73A4A" "Bug, defect, or broken behavior"
create_label "type:maintenance" "C5DEF5" "Cleanup, refactor, dependency, or upkeep task"
create_label "type:docs" "0075CA" "Documentation task"
create_label "type:ops" "5319E7" "Operational, deployment, monitoring, or platform task"

create_label "area:web" "0E8A16" "Frontend, Next.js, UI, routing, SEO, and caching"
create_label "area:worker" "FBCA04" "Cloudflare Worker ingestion and article processing"
create_label "area:controller" "BFDADC" "Controller Worker orchestration"
create_label "area:supabase" "006B75" "Database, SQL, schema, indexes, and backups"
create_label "area:rss" "F9D0C4" "RSS feed quality, source management, and thumbnails"
create_label "area:observability" "5319E7" "Sentry, Better Stack, logs, alerts, and dashboards"
create_label "area:performance" "0E8A16" "Speed, caching, throughput, and resource efficiency"
create_label "area:resiliency" "D4C5F9" "Availability, retries, backups, recovery, and fault tolerance"
create_label "area:product" "A2EEEF" "Reader-facing product features"
create_label "area:security" "B60205" "Secrets, access, API safety, and secure operations"
create_label "area:cost" "C2E0C6" "Cost reduction and free-tier protection"

create_label "priority:high" "B60205" "Important and should be handled soon"
create_label "priority:medium" "FBCA04" "Useful but not urgent"
create_label "priority:low" "C5DEF5" "Nice-to-have or future task"

create_milestone "MVP Stability" "Tasks that make the current NutsNews platform stable, reliable, and easy to operate."
create_milestone "RSS Quality Phase 1" "Improve source quality, thumbnails, deduplication, and feed health."
create_milestone "Performance Phase 1" "Improve caching, frontend speed, database query performance, and Worker efficiency."
create_milestone "Observability Phase 1" "Add useful dashboards, alerts, and searchable operational signals."
create_milestone "Backup and Recovery" "Back up Supabase data and document restore steps."
create_milestone "Product Growth" "Reader-facing features that grow the product experience."
create_milestone "Admin Dashboard" "Internal tools for managing feeds, reviewing health, and operating the platform."
create_milestone "Security and Operations" "Secrets, deployment safety, operational workflows, and production hardening."

ensure_project

TASKS_JSON=$(cat <<'JSON'
[
  {
    "title": "Improve article image extraction and thumbnail quality",
    "labels": ["type:feature", "area:rss", "area:worker", "priority:high"],
    "milestone": "RSS Quality Phase 1",
    "body": "## Goal\nImprove how NutsNews finds and validates article thumbnails.\n\n## Why it matters\nThe reader experience depends on clean article cards with real publisher images, not generic thumbnails.\n\n## Tasks\n- [ ] Improve RSS image extraction from media tags, enclosures, content HTML, and srcset values\n- [ ] Fetch article-page metadata only when RSS has no usable thumbnail\n- [ ] Prefer publisher og:image and twitter:image values\n- [ ] Reject generic Google, logo, icon, avatar, tracking pixel, and placeholder images\n- [ ] Log imageHydrationFoundCount and noThumbnailRejectedCount\n\n## Acceptance criteria\n- [ ] Published articles require usable image_url\n- [ ] Worker build passes\n- [ ] Shard test returns image hydration counts\n- [ ] Site feed shows article-specific thumbnails"
  },
  {
    "title": "Add feed health tracking for RSS sources",
    "labels": ["type:feature", "area:rss", "area:supabase", "area:observability", "priority:high"],
    "milestone": "RSS Quality Phase 1",
    "body": "## Goal\nTrack RSS feed quality over time.\n\n## Why it matters\nNutsNews should prioritize feeds that produce usable articles and deactivate feeds that fail or produce poor results.\n\n## Tasks\n- [ ] Design feed health fields or a feed_health table\n- [ ] Track fetch status, article count, image count, accepted count, rejected count, and last_success_at\n- [ ] Track repeated failure count\n- [ ] Add query to find bad feeds\n- [ ] Add query to find best feeds\n\n## Acceptance criteria\n- [ ] Operators can identify weak feeds from Supabase\n- [ ] Bad feeds can be disabled without code changes"
  },
  {
    "title": "Add source quality scoring",
    "labels": ["type:feature", "area:rss", "area:supabase", "priority:medium"],
    "milestone": "RSS Quality Phase 1",
    "body": "## Goal\nGive each RSS source a quality score based on useful output.\n\n## Why it matters\nA smaller set of reliable sources is better than hundreds of weak or noisy feeds.\n\n## Tasks\n- [ ] Define scoring rules for thumbnail rate, accepted rate, failure rate, and duplicate rate\n- [ ] Add source quality fields or a computed view\n- [ ] Sort feed activation decisions by quality\n- [ ] Document how to promote or disable feeds\n\n## Acceptance criteria\n- [ ] Supabase query can rank feeds by quality\n- [ ] Low-quality feeds can be found quickly"
  },
  {
    "title": "Create SQL scripts for feed activation and cleanup",
    "labels": ["type:maintenance", "area:rss", "area:supabase", "priority:high"],
    "milestone": "RSS Quality Phase 1",
    "body": "## Goal\nCreate reusable SQL scripts for managing RSS feeds.\n\n## Tasks\n- [ ] Script to count active feeds\n- [ ] Script to list active feeds\n- [ ] Script to disable Google News RSS feeds\n- [ ] Script to activate direct publisher feeds in batches\n- [ ] Script to deactivate feeds with repeated failures\n\n## Acceptance criteria\n- [ ] Scripts are committed under supabase/ or docs/\n- [ ] README links to the scripts"
  },
  {
    "title": "Keep Google News RSS disabled as primary source",
    "labels": ["type:maintenance", "area:rss", "priority:high"],
    "milestone": "RSS Quality Phase 1",
    "body": "## Goal\nAvoid Google News RSS as a primary publishing source.\n\n## Why it matters\nGoogle RSS often uses redirect URLs and generic thumbnails, which hurts source quality and article card quality.\n\n## Tasks\n- [ ] Disable active feeds where url contains news.google.com\n- [ ] Confirm active_google_feeds is zero\n- [ ] Keep direct publisher RSS feeds active instead\n- [ ] Document Google RSS as discovery-only, not primary publishing\n\n## Acceptance criteria\n- [ ] active_google_feeds = 0\n- [ ] Active source list is direct publisher feeds only"
  },
  {
    "title": "Add database indexes for public feed performance",
    "labels": ["type:ops", "area:supabase", "area:performance", "priority:high"],
    "milestone": "Performance Phase 1",
    "body": "## Goal\nAdd database indexes that support fast feed queries and duplicate checks.\n\n## Tasks\n- [ ] Add index on rss_feeds(is_active, id)\n- [ ] Add unique index on rss_feeds(url)\n- [ ] Add unique index on article_ai_reviews(original_url)\n- [ ] Add unique index on articles(original_url)\n- [ ] Add published feed index on articles(status, published_on_site_at desc, positivity_score desc) where image_url is not null\n- [ ] Add reviewed_at index on article_ai_reviews(reviewed_at desc)\n\n## Acceptance criteria\n- [ ] SQL migration is committed\n- [ ] Supabase queries still work\n- [ ] Feed API remains fast"
  },
  {
    "title": "Improve Cloudflare cache HIT rate",
    "labels": ["type:ops", "area:web", "area:performance", "priority:high"],
    "milestone": "Performance Phase 1",
    "body": "## Goal\nIncrease the number of public requests served by Cloudflare cache.\n\n## Tasks\n- [ ] Confirm homepage cache headers\n- [ ] Confirm /api/articles cache headers\n- [ ] Confirm article pages cache headers\n- [ ] Avoid no-store on public routes\n- [ ] Add Cloudflare cache rules for public routes\n- [ ] Bypass monitoring and log-test routes\n- [ ] Document curl validation commands\n\n## Acceptance criteria\n- [ ] Repeated homepage request shows cf-cache-status HIT\n- [ ] Repeated article API request shows cf-cache-status HIT or acceptable cache behavior"
  },
  {
    "title": "Create a public feed snapshot for faster homepage loads",
    "labels": ["type:feature", "area:web", "area:supabase", "area:performance", "priority:medium"],
    "milestone": "Performance Phase 1",
    "body": "## Goal\nReduce repeated database work for the homepage by using a precomputed or cached feed snapshot.\n\n## Tasks\n- [ ] Decide whether snapshot belongs in Supabase table, view, materialized view, or cache layer\n- [ ] Generate latest published article list periodically\n- [ ] Serve homepage/API from snapshot where possible\n- [ ] Keep fallback to normal article query\n\n## Acceptance criteria\n- [ ] Homepage loads from a stable optimized data source\n- [ ] New articles still appear within the freshness window"
  },
  {
    "title": "Optimize homepage article API pagination",
    "labels": ["type:maintenance", "area:web", "area:performance", "priority:medium"],
    "milestone": "Performance Phase 1",
    "body": "## Goal\nKeep the article API fast and predictable as article volume grows.\n\n## Tasks\n- [ ] Confirm page size remains small\n- [ ] Confirm API only returns fields needed by article cards\n- [ ] Confirm category filters use efficient queries\n- [ ] Consider cursor pagination if offset pagination becomes slow\n\n## Acceptance criteria\n- [ ] Article API remains responsive with many published articles"
  },
  {
    "title": "Reduce unnecessary client-side JavaScript",
    "labels": ["type:maintenance", "area:web", "area:performance", "priority:medium"],
    "milestone": "Performance Phase 1",
    "body": "## Goal\nKeep the mobile frontend lightweight.\n\n## Tasks\n- [ ] Review client components\n- [ ] Keep static/server-rendered content server-side where possible\n- [ ] Avoid unnecessary libraries\n- [ ] Run Lighthouse and compare before/after\n\n## Acceptance criteria\n- [ ] Lighthouse performance does not regress\n- [ ] Homepage remains simple and fast"
  },
  {
    "title": "Add Supabase backup automation",
    "labels": ["type:ops", "area:supabase", "area:resiliency", "priority:high"],
    "milestone": "Backup and Recovery",
    "body": "## Goal\nProtect RSS feeds, article reviews, and published articles with regular backups.\n\n## Tasks\n- [ ] Decide backup destination such as Cloudflare R2 or local export\n- [ ] Export rss_feeds, article_ai_reviews, and articles\n- [ ] Schedule backup automation if feasible\n- [ ] Store backup timestamps\n- [ ] Document backup location and retention\n\n## Acceptance criteria\n- [ ] A backup can be created on demand\n- [ ] Backup includes feeds, reviews, and published articles"
  },
  {
    "title": "Document Supabase restore procedure",
    "labels": ["type:docs", "area:supabase", "area:resiliency", "priority:high"],
    "milestone": "Backup and Recovery",
    "body": "## Goal\nCreate clear restore instructions for a crash, bad deploy, hacked data, or accidental delete.\n\n## Tasks\n- [ ] Document where backups live\n- [ ] Document restore order\n- [ ] Include SQL import commands\n- [ ] Include validation queries\n- [ ] Test restore into a temporary database\n\n## Acceptance criteria\n- [ ] Restore instructions are in the repo\n- [ ] Restore test has been completed at least once"
  },
  {
    "title": "Add Better Stack dashboards for Worker health",
    "labels": ["type:ops", "area:observability", "area:worker", "priority:high"],
    "milestone": "Observability Phase 1",
    "body": "## Goal\nCreate dashboards that show whether Worker ingestion is healthy.\n\n## Tasks\n- [ ] Dashboard for worker.refresh.completed\n- [ ] Track acceptedCount over time\n- [ ] Track rejectedCount over time\n- [ ] Track noThumbnailRejectedCount over time\n- [ ] Track imageHydrationFoundCount over time\n- [ ] Track durationMs by shard\n\n## Acceptance criteria\n- [ ] Dashboard answers whether articles are being accepted\n- [ ] Dashboard shows slow or failing shards"
  },
  {
    "title": "Add Better Stack alerts for ingestion failures",
    "labels": ["type:ops", "area:observability", "area:resiliency", "priority:high"],
    "milestone": "Observability Phase 1",
    "body": "## Goal\nGet notified when the ingestion pipeline breaks.\n\n## Tasks\n- [ ] Alert on worker.request.failed\n- [ ] Alert on worker.scheduled.failed\n- [ ] Alert on controller.shard.call_failed\n- [ ] Alert when acceptedCount stays zero for too long\n- [ ] Alert on Supabase save failures\n- [ ] Alert on OpenAI request failures\n\n## Acceptance criteria\n- [ ] Important failures create notifications\n- [ ] Alerts are documented in README or docs"
  },
  {
    "title": "Add Sentry alert rules",
    "labels": ["type:ops", "area:observability", "priority:medium"],
    "milestone": "Observability Phase 1",
    "body": "## Goal\nMake Sentry actionable instead of passive.\n\n## Tasks\n- [ ] Alert on new frontend error types\n- [ ] Alert on Worker runtime exceptions\n- [ ] Alert on repeated hydration/runtime errors\n- [ ] Document where to find Sentry project settings\n\n## Acceptance criteria\n- [ ] New critical errors notify the owner\n- [ ] Test error route validates alert behavior"
  },
  {
    "title": "Create Worker shard health dashboard",
    "labels": ["type:feature", "area:observability", "area:worker", "area:controller", "priority:medium"],
    "milestone": "Observability Phase 1",
    "body": "## Goal\nShow the health of each Worker shard.\n\n## Tasks\n- [ ] Track last successful run by shardIndex\n- [ ] Track durationMs by shardIndex\n- [ ] Track accepted and rejected counts by shardIndex\n- [ ] Track feedCount and fetchedCount by shardIndex\n- [ ] Identify shards with no feeds or repeated failures\n\n## Acceptance criteria\n- [ ] Operator can tell which shard failed or went stale"
  },
  {
    "title": "Create feed management admin dashboard",
    "labels": ["type:feature", "area:product", "area:rss", "area:web", "priority:medium"],
    "milestone": "Admin Dashboard",
    "body": "## Goal\nBuild an internal dashboard to manage RSS sources.\n\n## Tasks\n- [ ] List RSS feeds\n- [ ] Show active/inactive status\n- [ ] Show positive source flag\n- [ ] Show feed health metrics\n- [ ] Allow enabling/disabling feeds safely\n- [ ] Add authentication before exposing admin features\n\n## Acceptance criteria\n- [ ] Admin dashboard helps manage feed quality\n- [ ] Private/admin routes are protected"
  },
  {
    "title": "Create article review dashboard",
    "labels": ["type:feature", "area:product", "area:web", "area:supabase", "priority:medium"],
    "milestone": "Admin Dashboard",
    "body": "## Goal\nCreate a dashboard to review accepted and rejected stories.\n\n## Tasks\n- [ ] Show recently reviewed articles\n- [ ] Filter by decision, source, category, and positivity score\n- [ ] Show reason for rejection\n- [ ] Allow manual investigation of bad decisions\n\n## Acceptance criteria\n- [ ] Operator can inspect why an article was accepted or rejected"
  },
  {
    "title": "Add topic landing pages",
    "labels": ["type:feature", "area:product", "area:web", "priority:medium"],
    "milestone": "Product Growth",
    "body": "## Goal\nCreate landing pages for major categories such as Animals, Science, Wellness, Nature, Travel, and Space.\n\n## Tasks\n- [ ] Design category route structure\n- [ ] Add SEO metadata for category pages\n- [ ] Reuse article feed component with category filter\n- [ ] Link category badges to category pages\n\n## Acceptance criteria\n- [ ] Readers can browse by category\n- [ ] Category pages are cache-friendly"
  },
  {
    "title": "Add search to the public site",
    "labels": ["type:feature", "area:product", "area:web", "area:supabase", "priority:medium"],
    "milestone": "Product Growth",
    "body": "## Goal\nLet readers search published uplifting stories.\n\n## Tasks\n- [ ] Decide search implementation\n- [ ] Add search input UI\n- [ ] Query title, summary, category, and source\n- [ ] Keep results mobile-friendly\n- [ ] Keep search API cache and rate behavior safe\n\n## Acceptance criteria\n- [ ] Readers can search published articles\n- [ ] Search does not expose private data"
  },
  {
    "title": "Add newsletter support",
    "labels": ["type:feature", "area:product", "priority:medium"],
    "milestone": "Product Growth",
    "body": "## Goal\nCreate a daily or weekly positive-news email digest.\n\n## Tasks\n- [ ] Decide newsletter provider or simple email workflow\n- [ ] Select top articles for digest\n- [ ] Create digest template\n- [ ] Add signup flow later if needed\n\n## Acceptance criteria\n- [ ] A digest can be generated from published articles"
  },
  {
    "title": "Add article engagement analytics",
    "labels": ["type:feature", "area:product", "area:observability", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nUnderstand which articles readers engage with.\n\n## Tasks\n- [ ] Track outbound article clicks\n- [ ] Track category interest\n- [ ] Avoid invasive tracking\n- [ ] Summarize engagement by source and category\n\n## Acceptance criteria\n- [ ] Operator can see which sources/categories perform best\n- [ ] Privacy-friendly approach is documented"
  },
  {
    "title": "Add Open Graph image generation",
    "labels": ["type:feature", "area:web", "area:product", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nGenerate attractive social preview images for NutsNews pages.\n\n## Tasks\n- [ ] Add OG image route\n- [ ] Create branded layout\n- [ ] Support homepage and article pages\n- [ ] Test sharing previews\n\n## Acceptance criteria\n- [ ] Shared links have clean branded previews"
  },
  {
    "title": "Add richer fallback thumbnails",
    "labels": ["type:feature", "area:web", "area:product", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nImprove visual quality when an article does not have a usable image.\n\n## Tasks\n- [ ] Design category-based fallback visuals\n- [ ] Avoid misleading generic images\n- [ ] Prefer not publishing no-image articles where possible\n\n## Acceptance criteria\n- [ ] Fallbacks look intentional and match the NutsNews theme"
  },
  {
    "title": "Add personalization by topic preference",
    "labels": ["type:feature", "area:product", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nLet readers prefer topics like animals, science, travel, wellness, nature, or space.\n\n## Tasks\n- [ ] Decide anonymous/local preference model\n- [ ] Add topic selection UI\n- [ ] Adjust feed order based on preference\n- [ ] Keep default feed simple\n\n## Acceptance criteria\n- [ ] Personalization is optional and does not complicate the main experience"
  },
  {
    "title": "Add multi-language summary support",
    "labels": ["type:feature", "area:product", "area:worker", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nSupport summaries in more than one language later.\n\n## Tasks\n- [ ] Decide supported languages\n- [ ] Add language field to articles or generated summaries\n- [ ] Add prompt support for translations\n- [ ] Keep source links unchanged\n\n## Acceptance criteria\n- [ ] Architecture supports future multi-language summaries"
  },
  {
    "title": "Add social sharing automation",
    "labels": ["type:feature", "area:product", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nRepurpose approved stories into short social posts.\n\n## Tasks\n- [ ] Generate short social captions\n- [ ] Keep source attribution\n- [ ] Avoid auto-posting until reviewed\n- [ ] Consider manual approval first\n\n## Acceptance criteria\n- [ ] Approved articles can produce draft social copy"
  },
  {
    "title": "Investigate native mobile app path",
    "labels": ["type:feature", "area:product", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nEvaluate whether NutsNews should eventually have a native mobile app.\n\n## Tasks\n- [ ] Compare PWA vs native app\n- [ ] Identify features that require native app\n- [ ] Estimate maintenance cost\n\n## Acceptance criteria\n- [ ] Recommendation is documented"
  },
  {
    "title": "Create deployment checklist",
    "labels": ["type:docs", "type:ops", "area:maintenance", "priority:high"],
    "milestone": "Security and Operations",
    "body": "## Goal\nCreate a repeatable deployment checklist for web, Worker shards, and controller.\n\n## Tasks\n- [ ] Web deployment checklist\n- [ ] Worker shard deployment checklist\n- [ ] Controller deployment checklist\n- [ ] Cloudflare cache purge checklist\n- [ ] Post-deploy verification commands\n\n## Acceptance criteria\n- [ ] README or docs include one clear deployment checklist"
  },
  {
    "title": "Create troubleshooting guide",
    "labels": ["type:docs", "area:maintenance", "area:observability", "priority:high"],
    "milestone": "Security and Operations",
    "body": "## Goal\nCreate a guide for common production problems.\n\n## Tasks\n- [ ] Vercel build failures\n- [ ] Cloudflare cache issues\n- [ ] Worker 1101 errors\n- [ ] Supabase save failures\n- [ ] Missing thumbnails\n- [ ] Better Stack logs missing\n- [ ] Sentry errors\n\n## Acceptance criteria\n- [ ] Common issues can be diagnosed from one document"
  },
  {
    "title": "Review secrets and environment variable safety",
    "labels": ["type:ops", "area:security", "priority:high"],
    "milestone": "Security and Operations",
    "body": "## Goal\nMake sure secrets are stored safely and not exposed to the browser.\n\n## Tasks\n- [ ] Review Vercel environment variables\n- [ ] Review Cloudflare Secrets Store bindings\n- [ ] Confirm Supabase service role key is backend-only\n- [ ] Confirm no secrets are committed\n- [ ] Document secret rotation steps\n\n## Acceptance criteria\n- [ ] Secrets are documented and safe\n- [ ] No service role key is exposed in frontend code"
  },
  {
    "title": "Create release notes workflow",
    "labels": ["type:maintenance", "area:maintenance", "priority:low"],
    "milestone": "Security and Operations",
    "body": "## Goal\nTrack what changed in each production release.\n\n## Tasks\n- [ ] Decide release note format\n- [ ] Add manual release checklist\n- [ ] Include web, Worker, controller, SQL, and config changes\n\n## Acceptance criteria\n- [ ] Important changes are easy to review later"
  },
  {
    "title": "Add dependency update routine",
    "labels": ["type:maintenance", "area:security", "priority:medium"],
    "milestone": "Security and Operations",
    "body": "## Goal\nKeep dependencies reasonably current without breaking the site.\n\n## Tasks\n- [ ] Review npm audit output\n- [ ] Update safe patch/minor versions\n- [ ] Avoid force upgrades without testing\n- [ ] Confirm web build after updates\n\n## Acceptance criteria\n- [ ] Dependency updates have a repeatable process"
  },
  {
    "title": "Add manual review for borderline stories",
    "labels": ["type:feature", "area:product", "area:worker", "priority:low"],
    "milestone": "Admin Dashboard",
    "body": "## Goal\nSupport optional manual review for articles the AI is unsure about.\n\n## Tasks\n- [ ] Define borderline criteria\n- [ ] Store borderline decisions separately or with status\n- [ ] Add review UI later\n- [ ] Keep MVP automated-first\n\n## Acceptance criteria\n- [ ] Borderline review path is designed without blocking automation"
  },
  {
    "title": "Add cost dashboard for OpenAI usage protection",
    "labels": ["type:feature", "area:cost", "area:observability", "priority:medium"],
    "milestone": "Observability Phase 1",
    "body": "## Goal\nMake AI usage and cost controls visible.\n\n## Tasks\n- [ ] Track aiReviewedCount by shard\n- [ ] Track accepted vs rejected by AI call\n- [ ] Estimate cost per run\n- [ ] Alert if AI reviews spike unexpectedly\n\n## Acceptance criteria\n- [ ] Operator can see whether AI usage is controlled"
  },
  {
    "title": "Improve Worker retry and partial failure behavior",
    "labels": ["type:maintenance", "area:worker", "area:resiliency", "priority:high"],
    "milestone": "MVP Stability",
    "body": "## Goal\nMake Worker runs resilient when some feeds or services fail.\n\n## Tasks\n- [ ] Ensure one feed failure does not fail the whole run\n- [ ] Ensure Better Stack delivery failure does not fail the Worker\n- [ ] Ensure OpenAI failure rejects safely without crashing\n- [ ] Ensure Supabase save failure is logged clearly\n\n## Acceptance criteria\n- [ ] Worker returns useful result even with some feed failures\n- [ ] Failures are visible in logs"
  },
  {
    "title": "Add controller health and manual shard commands to docs",
    "labels": ["type:docs", "area:controller", "area:observability", "priority:medium"],
    "milestone": "MVP Stability",
    "body": "## Goal\nDocument how to operate and test the controller and shards.\n\n## Tasks\n- [ ] Document controller manual trigger\n- [ ] Document specific shard trigger\n- [ ] Document wrangler tail for shard debugging\n- [ ] Document expected response fields\n\n## Acceptance criteria\n- [ ] Operator can test any shard without searching old chat"
  },
  {
    "title": "Add feed source expansion plan",
    "labels": ["type:docs", "area:rss", "priority:medium"],
    "milestone": "RSS Quality Phase 1",
    "body": "## Goal\nDocument how to expand from 25 active feeds to more feeds safely.\n\n## Tasks\n- [ ] Define validation batch size\n- [ ] Define activation query\n- [ ] Define feed success criteria\n- [ ] Define rollback/deactivation query\n\n## Acceptance criteria\n- [ ] New feeds are activated in controlled batches"
  },
  {
    "title": "Add public API plan",
    "labels": ["type:feature", "area:product", "area:web", "priority:low"],
    "milestone": "Product Growth",
    "body": "## Goal\nExplore a public NutsNews API later.\n\n## Tasks\n- [ ] Define public API use cases\n- [ ] Decide rate limits and caching\n- [ ] Decide fields exposed\n- [ ] Keep private/internal fields hidden\n\n## Acceptance criteria\n- [ ] Public API plan is documented before implementation"
  }
]
JSON
)

issue_count="$(printf '%s' "$TASKS_JSON" | jq 'length')"
echo
printf 'Creating or updating %s roadmap issues...\n' "$issue_count"

printf '%s' "$TASKS_JSON" | jq -c '.[]' | while IFS= read -r task; do
  title="$(printf '%s' "$task" | jq -r '.title')"
  labels_csv="$(printf '%s' "$task" | jq -r '.labels | join(",")')"
  milestone="$(printf '%s' "$task" | jq -r '.milestone')"
  body="$(printf '%s' "$task" | jq -r '.body')"

  create_issue_and_add_to_project "$title" "$labels_csv" "$milestone" "$body"
done

echo
echo "Done."
echo "Open project:"
echo "https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_NUMBER"
