#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${1:-https://www.nutsnews.com}"
ARTICLE_PATH="${2:-}"

trimmed_site_url="${SITE_URL%/}"

check_url() {
  local label="$1"
  local url="$2"

  echo
  echo "== $label =="
  echo "$url"

  for attempt in 1 2 3; do
    echo "-- request $attempt --"
    curl -sI "$url" \
      -H "Cache-Control:" \
      -H "Pragma:" \
      | awk 'BEGIN{IGNORECASE=1} /^(HTTP\/|cache-control:|cdn-cache-control:|cloudflare-cdn-cache-control:|vercel-cdn-cache-control:|cf-cache-status:|age:|x-nutsnews-cache-policy:|x-nutsnews-cache-issue:)/ {print}'
    sleep 2
  done
}

check_url "Homepage" "$trimmed_site_url/"
check_url "Article API" "$trimmed_site_url/api/articles?page=0"

if [[ -n "$ARTICLE_PATH" ]]; then
  if [[ "$ARTICLE_PATH" == http* ]]; then
    check_url "Article page" "$ARTICLE_PATH"
  else
    check_url "Article page" "$trimmed_site_url$ARTICLE_PATH"
  fi
else
  echo
  echo "Optional: pass an article path to validate an article page too."
  echo "Example:"
  echo "  ./scripts/validate_cloudflare_cache_hit_rate.sh https://www.nutsnews.com /articles/<article-id>"
fi
