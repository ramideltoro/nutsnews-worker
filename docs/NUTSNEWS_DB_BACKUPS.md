# NutsNews Supabase Backup Automation

This runbook documents the production Supabase backup automation for NutsNews.

The goal is to satisfy GitHub issue #11 by making database backups automatic, off-machine, timestamped, observable, and easy to run on demand.

---

## Current Production Setup

| Item | Value |
| --- | --- |
| Server | Home server `chingadera` |
| Backup source | Supabase Postgres production database |
| Backup destination | Encrypted rclone remote `homebackup:nutsnews-db-backups` |
| Cloud storage behind remote | OneDrive through the existing home-server rclone setup |
| Local staging path | `/srv/nutsnews-db-backups` |
| Script | `/usr/local/sbin/nutsnews-db-backup.sh` |
| Config file | `/etc/nutsnews-backup/nutsnews-db-backup.env` |
| Log file | `/var/log/nutsnews-db-backup.log` |
| Systemd service | `nutsnews-db-backup.service` |
| Systemd timer | `nutsnews-db-backup.timer` |
| Metrics file | `/var/lib/node_exporter/textfile_collector/nutsnews_db_backup.prom` |
| Grafana pipeline | Grafana Alloy textfile collector → Grafana Cloud Prometheus |

The `homebackup` rclone remote is encrypted. Backup files are uploaded to OneDrive through that encrypted remote, not to a plain local OneDrive folder.

---

## What Gets Backed Up

The automated backup exports the current operational tables needed for the public feed, RSS source management, AI review history, and AI usage visibility.

| Table | Purpose |
| --- | --- |
| `public.articles` | Published positive news articles shown by the site and app |
| `public.rss_feeds` | RSS source list and source configuration |
| `public.article_ai_reviews` | AI accept/reject decisions, categories, reasons, model/provider metadata |
| `public.article_summaries` | Localized titles and summaries for supported languages such as French |
| `public.ai_usage_runs` | AI run accounting and Worker usage history |

The script intentionally uses a focused `pg_dump` table list instead of dumping every Supabase object.

---

## Backup Format

Each run creates a timestamped folder like:

```text
nutsnews-db-2026-06-24_16-32-16/
```

Inside that folder:

```text
metadata/
nutsnews-db-public-tables.sql.gz
SHA256SUMS
```

The SQL dump is gzip-compressed and validated with `gzip -t` before upload.

The backup is uploaded with `rclone copy` and verified with `rclone check`.

For encrypted rclone remotes, `rclone check` may print:

```text
No common hash found - not using a hash for checks
```

That is expected for this encrypted remote. The important success signal is that the run ends with `Backup completed successfully` and reports zero differences / matching files.

---

## Schedule

The systemd timer runs daily:

```text
03:15 AM America/New_York
```

The timer also has:

```text
RandomizedDelaySec=10min
Persistent=true
```

That means the run may start a few minutes after 3:15 AM, and missed runs can fire after the server comes back online.

Check the next scheduled run:

```bash
systemctl list-timers --all | grep nutsnews-db-backup
```

---

## Retention Policy

The production config uses:

| Backup class | Retention |
| --- | --- |
| Daily backups | 14 days |
| Weekly Sunday backups | 8 weeks |
| Monthly first-of-month backups | 12 months |

The config values live in:

```text
/etc/nutsnews-backup/nutsnews-db-backup.env
```

Expected keys:

```bash
DATABASE_URL="postgres://..."
REMOTE_NAME="homebackup"
REMOTE_PATH="nutsnews-db-backups"
LOCAL_BACKUP_DIR="/srv/nutsnews-db-backups"
KEEP_DAILY_DAYS="14"
KEEP_WEEKLY_WEEKS="8"
KEEP_MONTHLY_MONTHS="12"
```

Do not commit this config file. It contains the Supabase database connection string.

---

## On-Demand Backup

Run a backup immediately:

```bash
ssh -t rami@192.168.1.115 'nutsnews-db-backup-now'
```

Or run the service directly:

```bash
ssh -t rami@192.168.1.115 'sudo systemctl start nutsnews-db-backup.service'
```

Watch status and recent logs:

```bash
ssh -t rami@192.168.1.115 'nutsnews-db-backup-status'
```

List available encrypted OneDrive backups:

```bash
ssh -t rami@192.168.1.115 'nutsnews-db-backup-list'
```

---

## Manual Health Checks

Check the timer:

```bash
ssh -t rami@192.168.1.115 'systemctl status nutsnews-db-backup.timer --no-pager'
```

Check the service:

```bash
ssh -t rami@192.168.1.115 'systemctl status nutsnews-db-backup.service --no-pager || true'
```

Check recent logs:

```bash
ssh -t rami@192.168.1.115 'sudo tail -100 /var/log/nutsnews-db-backup.log'
```

Check the encrypted remote folder:

```bash
ssh -t rami@192.168.1.115 '
sudo env RCLONE_CONFIG=/home/rami/.config/rclone/rclone.conf \
  rclone lsf homebackup:nutsnews-db-backups --dirs-only | sort | tail -20
'
```

---

## Metrics

The backup script writes Prometheus textfile metrics to:

```text
/var/lib/node_exporter/textfile_collector/nutsnews_db_backup.prom
```

Grafana Alloy already reads the textfile collector directory and remote-writes metrics to Grafana Cloud.

Useful metrics:

| Metric | Meaning |
| --- | --- |
| `nutsnews_db_backup_last_success` | `1` when the last DB backup succeeded, `0` when it failed |
| `nutsnews_db_backup_last_run_timestamp_seconds` | Unix timestamp of the last DB backup run |
| `nutsnews_db_backup_last_duration_seconds` | Last DB backup duration |
| `nutsnews_db_backup_last_size_bytes` | Size of the local backup folder before upload cleanup |
| `nutsnews_db_backup_last_file_count` | Number of files generated for the last backup |
| `nutsnews_db_backup_cloud_available_count` | Count of backup folders available in OneDrive through `homebackup` |
| `nutsnews_db_backup_latest_cloud_backup_timestamp_seconds` | Timestamp parsed from the latest cloud backup folder |
| `nutsnews_db_backup_next_run_timestamp_seconds` | Next scheduled systemd timer run |
| `nutsnews_db_backup_timer_enabled` | `1` when the timer is enabled |
| `nutsnews_db_backup_timer_active` | `1` when the timer is active |
| `nutsnews_db_backup_service_active` | `1` while the backup service is currently running |

Local metric check:

```bash
ssh -t rami@192.168.1.115 '
sudo grep -E "^nutsnews_db_backup_" \
  /var/lib/node_exporter/textfile_collector/nutsnews_db_backup.prom
'
```

Grafana Explore queries:

```promql
nutsnews_db_backup_last_success
```

```promql
time() - nutsnews_db_backup_last_run_timestamp_seconds
```

```promql
nutsnews_db_backup_last_duration_seconds
```

```promql
nutsnews_db_backup_last_size_bytes
```

```promql
nutsnews_db_backup_cloud_available_count
```

Recommended alert:

```promql
nutsnews_db_backup_last_success == 0
```

Recommended stale-backup alert:

```promql
time() - nutsnews_db_backup_last_run_timestamp_seconds > 93600
```

`93600` seconds is 26 hours. That gives the daily 3:15 AM timer a little grace window.

---

## Restore Notes

Do not restore directly over production first.

Recommended recovery flow:

1. Pause database writers: controller cron, Worker shard manual runs, feed edits, and backfill scripts.
2. Pick the backup folder from `homebackup:nutsnews-db-backups`.
3. Copy the backup down to a temporary restore folder.
4. Restore into a temporary Supabase database first.
5. Run `supabase/restore_validation.sql`.
6. Test the web app/API and one Worker shard against the temporary database.
7. Take a final safety export of current production.
8. Restore production only after the temporary restore passes.
9. Re-enable writers and watch Grafana, Better Stack, Sentry, and admin dashboards.

See [`SUPABASE_RESTORE.md`](SUPABASE_RESTORE.md) for the full restore runbook.

---

## Restore Drill Commands

Copy the latest backup folder from OneDrive to the home server:

```bash
ssh -t rami@192.168.1.115 '
LATEST="$(
  sudo env RCLONE_CONFIG=/home/rami/.config/rclone/rclone.conf \
    rclone lsf homebackup:nutsnews-db-backups --dirs-only \
    | sed "s#/$##" \
    | sort \
    | tail -n 1
)"

sudo mkdir -p "/srv/nutsnews-restore-test/${LATEST}"
sudo env RCLONE_CONFIG=/home/rami/.config/rclone/rclone.conf \
  rclone copy "homebackup:nutsnews-db-backups/${LATEST}" \
  "/srv/nutsnews-restore-test/${LATEST}"

sudo ls -la "/srv/nutsnews-restore-test/${LATEST}"
sudo gzip -t "/srv/nutsnews-restore-test/${LATEST}/nutsnews-db-public-tables.sql.gz"
'
```

Do not run `psql` against production for a restore drill. Use a temporary database connection string.

---

## Security Notes

Do not paste or commit:

* `DATABASE_URL`
* Supabase database password
* Supabase service role key
* rclone encrypted remote passwords
* Grafana Cloud API tokens
* Cloudflare tokens

Safe to document:

* service names
* timer names
* metric names
* backup folder naming pattern
* retention policy
* table names
* non-secret helper commands

If a database URL or Grafana Cloud token is exposed in a chat, ticket, screenshot, or log, rotate it.

---

## GitHub Issue #11 Completion Checklist

| Requirement | Status |
| --- | --- |
| Pick backup destination | Done: encrypted OneDrive via `homebackup:nutsnews-db-backups` |
| Export article data | Done: `public.articles` |
| Export RSS feeds | Done: `public.rss_feeds` |
| Export AI review history | Done: `public.article_ai_reviews` |
| Export localized summaries | Done: `public.article_summaries` after updating the home-server backup script |
| Export AI usage runs | Done: `public.ai_usage_runs` |
| Store timestamped backups | Done: `nutsnews-db-yyyy-mm-dd_hh-mm-ss` folders |
| Support on-demand backup | Done: `nutsnews-db-backup-now` and systemd service |
| Automate schedule | Done: daily systemd timer at 3:15 AM with randomized delay |
| Purge old backups | Done: 14 daily / 8 weekly / 12 monthly retention |
| Expose metrics | Done: Prometheus textfile metrics for Grafana Alloy |
| Document restore path | Done: this doc + `SUPABASE_RESTORE.md` |

