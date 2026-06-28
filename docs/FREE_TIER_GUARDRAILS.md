# NutsNews Free-Tier Guardrails

Issue #116 adds a dedicated admin dashboard at `/admin/guardrails` for cost forecasting and free-tier risk monitoring.

The dashboard tracks the data NutsNews already has and clearly labels anything that needs provider input:

- Database growth: `articles`, `article_summaries`, and `rss_feeds` row counts.
- AI usage: OpenAI calls, token usage, estimated cost, local AI calls, cost protection hits, and spike warnings from `ai_usage_runs`.
- Worker usage: saved Worker runs and failures from `worker_runs`.
- Email usage: successful contact form deliveries recorded in `quota_usage_events`.
- Redis/KV, egress, and PageSpeed/API usage: optional environment overrides until provider counters are persisted.

## Environment overrides

These values are optional. The dashboard has safe defaults for the core NutsNews data and shows `Unknown` for provider usage that is not available yet.

```bash
NUTSNEWS_DB_CONTENT_ROW_LIMIT=50000
NUTSNEWS_ARTICLE_ROW_LIMIT=30000
NUTSNEWS_ARTICLE_SUMMARY_ROW_LIMIT=90000
NUTSNEWS_OPENAI_MONTHLY_BUDGET_USD=5
NUTSNEWS_OPENAI_MONTHLY_CALL_LIMIT=50000
NUTSNEWS_WORKER_MONTHLY_INVOCATION_LIMIT=100000
NUTSNEWS_WORKER_24H_FAILURE_LIMIT=5
NUTSNEWS_EMAIL_MONTHLY_SEND_LIMIT=3000
NUTSNEWS_REDIS_KV_30D_OPS=0
NUTSNEWS_REDIS_KV_30D_OP_LIMIT=100000
NUTSNEWS_EGRESS_30D_GB=0
NUTSNEWS_EGRESS_30D_GB_LIMIT=100
NUTSNEWS_PAGESPEED_30D_CALLS=0
NUTSNEWS_PAGESPEED_30D_CALL_LIMIT=25000
```

## Warning behavior

Most metrics warn at 70% of the configured limit and enter danger at 90%. AI cost warns earlier at 60% and enters danger at 85% so there is more time to reduce reviews or switch to local AI.

## Mitigation runbook

When a metric enters `Watch` or `Danger`:

1. Open `/admin/guardrails` to identify the affected quota.
2. Open the related admin dashboard, such as `/admin/ai-usage`, `/admin/shards`, or `/admin/feed-health`.
3. Reduce the relevant load:
   - AI: lower `MAX_AI_REVIEWS`, prefer local AI, or reduce shard review limits.
   - DB growth: archive old rows, prune old translations, or disable weak feeds.
   - Worker runs: increase cron interval, reduce shard count, or pause low-value feeds.
   - Email: tighten Turnstile/rate limiting or temporarily route messages to a queue.
   - Egress/API: increase CDN caching, reduce response sizes, or run audits manually.
4. Verify the dashboard risk returns to `OK` before increasing load again.
