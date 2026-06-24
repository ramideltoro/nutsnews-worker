# Supabase Restore Procedure

This runbook explains how to restore the NutsNews Supabase database after a crash, bad deploy, hacked data, bad migration, or accidental delete.

The goal is to make database recovery calm, repeatable, and testable.

---

## What This Protects

NutsNews stores operational and product data in Supabase Postgres:

| Data | Table or object |
| --- | --- |
| Published articles | `public.articles` |
| RSS feed list | `public.rss_feeds` |
| AI review history | `public.article_ai_reviews` |
| Localized summaries | `public.article_summaries` |
| AI usage runs | `public.ai_usage_runs` |
| Worker run history | `public.worker_runs` |
| Feed health history | `public.feed_health` |
| Weak feed view | `public.bad_feeds` |
| Strong feed view | `public.best_feeds` |

The public web app, admin dashboards, Worker shards, and controller all depend on this data.

---

## Backup Locations

Actual database backup files must not be committed to Git.

Use these locations:

| Backup type | Location |
| --- | --- |
| Supabase managed backups | Supabase project dashboard for the production project |
| Automated home-server backups | Encrypted OneDrive remote `homebackup:nutsnews-db-backups` |
| Manual local exports | `backups/supabase/<yyyy-mm-dd-hhmm>/` |
| Off-machine copy | External drive, private cloud storage, or another secure location |
| Schema source of truth | `supabase/migrations/` in this repo |
| Restore validation SQL | `supabase/restore_validation.sql` in this repo |

The repo ignores local backup files through `.gitignore`.

Automated production database backup folders are named like `nutsnews-db-2026-06-24_16-32-16` and contain `nutsnews-db-public-tables.sql.gz`, `SHA256SUMS`, and metadata files. See [`NUTSNEWS_DB_BACKUPS.md`](NUTSNEWS_DB_BACKUPS.md) for the live backup schedule, retention policy, helper commands, and Grafana metrics.

Recommended local backup layout:

```text
backups/
└── supabase/
    └── 2026-06-15-0930/
        ├── nutsnews.dump
        ├── schema.sql
        ├── data.sql
        ├── restore-notes.md
        └── validation-output.txt
```

---

## Golden Rules

Do not restore directly over production first.

Always restore into a temporary database before touching production.

During an incident:

1. Stop anything that writes to the database.
2. Preserve the current damaged state before overwriting it.
3. Restore to a temporary database.
4. Run validation queries.
5. Point a test app or test Worker at the temporary database.
6. Restore production only after the temporary restore passes.
7. Rotate secrets if the incident involved leaked keys or hacked data.

---

## Restore Order

Use this order for a safe restore:

1. Pause writers.
2. Pick the backup.
3. Create or select a temporary Supabase database.
4. Restore the backup into the temporary database.
5. Run validation SQL.
6. Test the web app or Worker against the temporary database.
7. Export a final safety backup of current production.
8. Restore production.
9. Validate production.
10. Re-enable writers.
11. Watch logs, dashboards, and article output.

---

## Step 1: Pause Database Writers

Pause anything that can write to Supabase:

* Cloudflare controller cron
* Manual controller triggers
* Worker shard deploys or manual Worker curls
* Any backfill scripts
* Feed-management changes in `/admin/feeds`

Manual checks should be read-only while recovery is in progress.

---

## Step 2: Set Local Variables

Use direct database connection strings. Do not commit these values.

```bash
export SOURCE_DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres"
export RESTORE_DATABASE_URL="postgresql://postgres:<password>@<temp-host>:5432/postgres"
export BACKUP_DIR="backups/supabase/$(date +%Y-%m-%d-%H%M)"
mkdir -p "$BACKUP_DIR"
```

Use `SOURCE_DATABASE_URL` for the database you are exporting from.

Use `RESTORE_DATABASE_URL` for the temporary database or production database you are restoring into.

---

## Step 3: Create a Manual Backup Export

Create a full custom-format backup:

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file "$BACKUP_DIR/nutsnews.dump" \
  "$SOURCE_DATABASE_URL"
```

Create a plain schema backup:

```bash
pg_dump \
  --schema-only \
  --no-owner \
  --no-acl \
  --file "$BACKUP_DIR/schema.sql" \
  "$SOURCE_DATABASE_URL"
```

Create a plain data backup:

```bash
pg_dump \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --file "$BACKUP_DIR/data.sql" \
  "$SOURCE_DATABASE_URL"
```

Record what was exported:

```bash
cat > "$BACKUP_DIR/restore-notes.md" <<EOF_NOTES
# NutsNews Supabase Backup

Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Source: production
Reason:
Operator:
Notes:
EOF_NOTES
```

---

## Step 4: Restore Into a Temporary Database First

Before restoring production, restore the backup into a temporary Supabase database.

For a custom-format dump:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname "$RESTORE_DATABASE_URL" \
  "$BACKUP_DIR/nutsnews.dump"
```

For a plain SQL backup:

```bash
psql "$RESTORE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$BACKUP_DIR/schema.sql"

psql "$RESTORE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$BACKUP_DIR/data.sql"
```

If the temporary database already contains conflicting objects, recreate the `public` schema before restoring:

```bash
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
SQL
```

Then run the restore again.

---

## Step 5: Run Restore Validation Queries

Run the committed validation SQL:

```bash
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" ./scripts/validate_supabase_restore.sh
```

Or run it directly:

```bash
psql "$RESTORE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/restore_validation.sql
```

Save the output:

```bash
psql "$RESTORE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/restore_validation.sql \
  | tee "$BACKUP_DIR/validation-output.txt"
```

---

## Step 6: Validate Critical Data

At minimum, confirm:

* `public.articles` exists.
* `public.rss_feeds` exists.
* `public.article_ai_reviews` exists.
* `public.article_summaries` exists.
* `public.ai_usage_runs` exists.
* `public.worker_runs` exists.
* `public.feed_health` exists.
* `public.bad_feeds` view works.
* `public.best_feeds` view works.
* Published articles are readable.
* RSS feeds are available.
* Article URLs are still unique.
* Feed URLs are still unique.
* Row level security is enabled where expected.

Useful manual queries:

```sql
select count(*) as published_articles
from public.articles
where status = 'published';

select count(*) as active_feeds
from public.rss_feeds
where is_active = true;

select count(*) as accepted_reviews
from public.article_ai_reviews
where decision = 'accept';

select count(*) as rejected_reviews
from public.article_ai_reviews
where decision = 'reject';

select source, feed_url, consecutive_failure_count
from public.bad_feeds
limit 20;

select source, feed_url, total_accepted_count
from public.best_feeds
limit 20;
```

---

## Step 7: Test the App Against the Temporary Database

Before restoring production, test one runtime path against the temporary database.

Recommended checks:

1. Point a local web app to the temporary Supabase URL and anon key.
2. Run the web build.
3. Load the home feed.
4. Load `/api/articles?page=0`.
5. Point one Worker shard to the temporary Supabase service role key.
6. Run one manual Worker check with a small limit.

Example web check:

```bash
cd web
npm install
npm run build
```

Example API check after local app starts:

```bash
curl -s "http://localhost:3000/api/articles?page=0"
```

Example Worker check after pointing secrets to the temporary database:

```bash
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
```

Only continue if the temporary database behaves correctly.

---

## Step 8: Take a Final Production Safety Backup

Before restoring production, export the current production state even if it is damaged.

```bash
export FINAL_SAFETY_DIR="backups/supabase/final-prod-before-restore-$(date +%Y-%m-%d-%H%M)"
mkdir -p "$FINAL_SAFETY_DIR"

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file "$FINAL_SAFETY_DIR/production-before-restore.dump" \
  "$SOURCE_DATABASE_URL"
```

This gives you a way to inspect or recover data that existed right before the restore.

---

## Step 9: Restore Production

After the temporary restore passes, point `RESTORE_DATABASE_URL` to production and run the restore.

```bash
export RESTORE_DATABASE_URL="$SOURCE_DATABASE_URL"
```

Restore custom-format dump:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname "$RESTORE_DATABASE_URL" \
  "$BACKUP_DIR/nutsnews.dump"
```

Run validation again:

```bash
RESTORE_DATABASE_URL="$RESTORE_DATABASE_URL" ./scripts/validate_supabase_restore.sh
```

---

## Step 10: Re-enable Writers

After production validation passes:

1. Re-enable controller cron.
2. Re-enable Worker shard runs.
3. Run one small manual Worker check.
4. Check Better Stack logs.
5. Check Sentry.
6. Check admin dashboards.
7. Check the public site.

Commands:

```bash
curl "https://nutsnews-controller.nutsnews.workers.dev/?shard=0"
curl "https://nutsnews-worker-0.nutsnews.workers.dev/?limit=1"
curl -s "https://www.nutsnews.com/api/articles?page=0"
```

---

## If the Incident Involved Hacked Data or Leaked Keys

Rotate secrets before re-enabling normal traffic:

* Supabase service role key
* Supabase anon key if needed
* Cloudflare Worker secrets
* Vercel environment variables
* Google OAuth secret if affected
* NextAuth secret if affected
* Better Stack token if affected
* Sentry DSN or auth token if affected
* OpenAI key if affected

Redeploy affected services after secret rotation.

---

## Restore Test Record

Each restore test should leave a short record.

Create a file like:

```text
backups/supabase/<date>/restore-test-record.md
```

Template:

```markdown
# Supabase Restore Test Record

Date:
Operator:
Backup used:
Temporary database:
Restore command:
Validation command:
Validation output file:
Web check:
Worker check:
Result: pass/fail
Notes:
```

Issue #12 can be considered fully complete only after this test has been run at least once against a temporary database.

---

## Quick Incident Checklist

```text
[ ] Pause controller cron and Worker writes
[ ] Pick backup
[ ] Restore backup into temporary database
[ ] Run supabase/restore_validation.sql
[ ] Test web/API against temporary database
[ ] Test one Worker shard against temporary database
[ ] Take final production safety backup
[ ] Restore production
[ ] Run validation against production
[ ] Re-enable controller and Workers
[ ] Confirm Better Stack, Sentry, admin dashboards, and public site
[ ] Record restore test result
```
