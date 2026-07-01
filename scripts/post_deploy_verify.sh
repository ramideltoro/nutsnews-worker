#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${1:-https://www.nutsnews.com}"
ARTICLE_PATH="${2:-}"
CONTROLLER_URL="${CONTROLLER_URL:-https://nutsnews-controller.nutsnews.workers.dev}"
WORKER_BASE_URL="${WORKER_BASE_URL:-https://nutsnews-worker}"
WORKER_DOMAIN="${WORKER_DOMAIN:-nutsnews.workers.dev}"
SHARD_INDEX="${SHARD_INDEX:-0}"
WORKER_LIMIT="${WORKER_LIMIT:-1}"

trimmed_site_url="${SITE_URL%/}"

print_section() {
  echo
  echo "== $1 =="
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Missing required command: $1" >&2
    exit 1
  fi
}

http_status() {
  local url="$1"
  curl -sS -o /tmp/nutsnews_post_deploy_response.$$ -w "%{http_code}" "$url"
}

check_http_ok() {
  local label="$1"
  local url="$2"
  local status

  status="$(http_status "$url")"
  rm -f /tmp/nutsnews_post_deploy_response.$$

  echo "$label: HTTP $status - $url"

  if [[ "$status" != "200" ]]; then
    echo "ERROR: $label returned HTTP $status" >&2
    exit 1
  fi
}


check_header_contains() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local headers

  headers="$(curl -sSI "$url")"
  echo "$label: checking response headers for '$expected'"

  if ! grep -qi "$expected" <<<"$headers"; then
    echo "ERROR: $label did not contain expected header text: $expected" >&2
    echo "Headers:" >&2
    echo "$headers" >&2
    exit 1
  fi
}

check_contains() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local response

  response="$(curl -sS "$url")"
  echo "$label: checking for '$expected'"

  if ! grep -q "$expected" <<<"$response"; then
    echo "ERROR: $label did not contain expected text: $expected" >&2
    echo "Response preview:" >&2
    echo "$response" | head -c 1000 >&2
    echo >&2
    exit 1
  fi
}

require_command curl

print_section "Public web"
check_http_ok "Homepage" "$trimmed_site_url/"
check_http_ok "Article API" "$trimmed_site_url/api/articles?page=0"
check_contains "Article API shape" "$trimmed_site_url/api/articles?page=0" "articles"
check_header_contains "Article API snapshot data source" "$trimmed_site_url/api/articles?page=0" "x-nutsnews-article-data-source"
check_header_contains "Article API snapshot status" "$trimmed_site_url/api/articles?page=0" "x-nutsnews-feed-snapshot"
check_header_contains "Article API edge snapshot marker" "$trimmed_site_url/api/articles?page=0" "x-nutsnews-edge-snapshot"

if [[ -n "$ARTICLE_PATH" ]]; then
  if [[ "$ARTICLE_PATH" == http* ]]; then
    check_http_ok "Article page" "$ARTICLE_PATH"
  else
    check_http_ok "Article page" "$trimmed_site_url$ARTICLE_PATH"
  fi
fi

print_section "Cloudflare cache"
if [[ -x "./scripts/validate_cloudflare_cache_hit_rate.sh" ]]; then
  if [[ -n "$ARTICLE_PATH" ]]; then
    ./scripts/validate_cloudflare_cache_hit_rate.sh "$trimmed_site_url" "$ARTICLE_PATH"
  else
    ./scripts/validate_cloudflare_cache_hit_rate.sh "$trimmed_site_url"
  fi
else
  echo "Skipping cache validation because scripts/validate_cloudflare_cache_hit_rate.sh is missing or not executable."
fi

print_section "Controller"
check_contains "Controller automatic trigger" "$CONTROLLER_URL/" "NutsNews controller run complete"
check_contains "Controller shard $SHARD_INDEX trigger" "$CONTROLLER_URL/?shard=$SHARD_INDEX" "NutsNews controller run complete"

print_section "Worker shard"
worker_url="${WORKER_BASE_URL}-${SHARD_INDEX}.${WORKER_DOMAIN}/?limit=${WORKER_LIMIT}"
check_contains "Worker shard $SHARD_INDEX" "$worker_url" "NutsNews refresh complete"

print_section "Result"
echo "Post-deploy verification passed."
echo
echo "Next manual checks:"
echo "  Better Stack: service:nutsnews-web, service:nutsnews-worker, service:nutsnews-controller"
echo "  Sentry: latest frontend/server/Worker/controller errors"
echo "  Admin: /admin/shards, /admin/feed-health, /admin/ai-usage"
echo "  Article API snapshot headers: X-NutsNews-Article-Data-Source, X-NutsNews-Feed-Snapshot, X-NutsNews-Edge-Snapshot"
echo "  Edge snapshot admin: /admin/edge-snapshot"
