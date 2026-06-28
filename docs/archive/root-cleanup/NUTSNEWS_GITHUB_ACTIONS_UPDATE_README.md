# NutsNews GitHub Actions Update

This bundle adds the missing GitHub Actions and support scripts for NutsNews.

## Copy into your project

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

rm -rf /tmp/nutsnews-github-actions-update
unzip -o ~/Downloads/nutsnews-github-actions-update.zip -d /tmp/nutsnews-github-actions-update
rsync -av /tmp/nutsnews-github-actions-update/ ./
```

## Test the scripts locally

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

node scripts/check_links.mjs
node scripts/app_store_docs_check.mjs
```

Optional public checks:

```bash
NUTSNEWS_BASE_URL=https://www.nutsnews.com node scripts/check_sitemap_robots.mjs
NUTSNEWS_BASE_URL=https://www.nutsnews.com node scripts/worker_smoke_test.mjs
```

Optional Supabase-backed reports, only if your env variables are available locally:

```bash
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
node scripts/db_size_warning.mjs

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
node scripts/feed_health_report.mjs

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
node scripts/image_coverage_report.mjs
```

## Commit

```bash
cd /Users/ramideltoro/WebstormProjects/nutsnews3

git status
git add .github/workflows scripts docs/GITHUB_ACTIONS_AUTOMATION.md NUTSNEWS_GITHUB_ACTIONS_UPDATE_README.md
git commit -m "Add missing GitHub Actions automation"
git push
```

## GitHub settings to check

In GitHub:

```text
Repo → Settings → Actions → General → Workflow permissions → Read and write permissions
```

Add repository secrets under:

```text
Repo → Settings → Secrets and variables → Actions
```

Recommended secrets:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AUTH_SECRET
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
NUTSNEWS_WORKER_URL
NUTSNEWS_SHARD_URL
PAGESPEED_INSIGHTS_API_KEY
SNYK_TOKEN
```
