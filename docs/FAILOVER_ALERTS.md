# Failover Alerts

The failover controller emits operator alerts through the existing controller logger with `event = "failover.alert"`. Alerts appear in Workers Logs and are forwarded to Better Stack when the existing Better Stack bindings are configured. If `NUTSNEWS_FAILOVER_ALERT_WEBHOOK_URL` is configured as a secret or environment binding, the same safe alert payload is also sent to that HTTPS webhook.

## Destination

Initial destination: Workers Logs and the existing Better Stack log pipeline, with optional HTTPS webhook delivery.

Webhook configuration:

- `NUTSNEWS_FAILOVER_ALERT_WEBHOOK_URL`: optional HTTPS endpoint.
- `NUTSNEWS_FAILOVER_ALERT_WEBHOOK_TOKEN`: optional bearer token for the webhook.
- `NUTSNEWS_FAILOVER_STATUS_URL`: public operator status URL included in every alert.

Alert webhook delivery is best-effort. Webhook failures do not block failover decisions, and the logger alert is still emitted.

## Alert Rules

- `failover_to_vercel`: emitted when a non-duplicate DNS action records Vercel as the active target.
- `failback_to_vps`: emitted when a non-duplicate DNS action records VPS as the active target.
- `stale_controller`: emitted when a wake sees a stale controller status before the next health check repairs it.
- `dns_drift`: emitted when desired DNS target and observed Cloudflare DNS targets disagree outside `NUTSNEWS_FAILOVER_LIVE_ORIGIN_PROPAGATION_WINDOW_SECONDS`.
- `manual_lock_enabled`: emitted when manual lock is enabled or remains active, warning that automatic failback is disabled.

## Rate Limiting

The default alert rate limit is 3600 seconds per alert fingerprint. The controller stores fingerprints in Durable Object storage under `failover.alerts.v1`.

Set `NUTSNEWS_FAILOVER_ALERT_RATE_LIMIT_SECONDS` to change the window. Values below 60 seconds are ignored.

## Safe Context

Every alert includes:

- active, desired, apex, and www DNS target classifications
- controller state
- health result, VPS status, latency, and consecutive failure count
- last VPS check timestamp
- last DNS change timestamp and reason
- live-origin DNS state
- manual lock state
- status URL

Alert payloads intentionally exclude tokens, cookies, authorization headers, private origin details, and raw DNS API responses.
