# Failover Analytics Engine

The failover controller writes queryable health and DNS target-change metrics to the Workers Analytics Engine dataset `nutsnews_failover_controller`.

Workers Analytics Engine creates the table after the first write. Cloudflare stores Analytics Engine data for three months. Writes use one index, seventeen blobs, and twelve doubles, below the documented limits of twenty blobs, twenty doubles, and one index per data point.

## Sampling Policy

The controller uses `index1 = nutsnews-failover:<environment>` so failover metrics stay grouped by environment. The current 15-second health-check cadence is low volume, but operator queries still use `_sample_interval` because Workers Analytics Engine can sample at write or read time.

## Schema

Blob fields:

1. `blob1`: schema version, currently `nutsnews.failover.analytics.v1`
2. `blob2`: event type, `health_check` or `dns_target_change`
3. `blob3`: environment, currently `production`
4. `blob4`: controller version
5. `blob5`: source
6. `blob6`: controller state
7. `blob7`: active DNS target
8. `blob8`: desired DNS target
9. `blob9`: observed apex DNS target
10. `blob10`: observed www DNS target
11. `blob11`: health result
12. `blob12`: DNS action or decision
13. `blob13`: safe error code, or `none`
14. `blob14`: observed deployment target
15. `blob15`: live-origin DNS state
16. `blob16`: manual lock state
17. `blob17`: VPS reachable state

Double fields:

1. `double1`: event count
2. `double2`: VPS latency ms, or 0 when unavailable
3. `double3`: VPS HTTP status, or 0 when unavailable
4. `double4`: consecutive VPS failures
5. `double5`: failure threshold
6. `double6`: VPS reachable, 1 or 0
7. `double7`: DNS update duration ms, or 0 when unavailable
8. `double8`: DNS target changed, 1 or 0
9. `double9`: manual lock enabled, 1 or 0
10. `double10`: has VPS latency, 1 or 0
11. `double11`: has VPS HTTP status, 1 or 0
12. `double12`: DNS readback OK, 1 or 0

## Query Snippets

Recent health checks:

```sql
SELECT
  timestamp,
  blob3 AS environment,
  blob4 AS controller_version,
  blob5 AS source,
  blob6 AS controller_state,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob11 AS health_result,
  blob12 AS dns_action,
  double2 AS vps_latency_ms,
  double3 AS vps_status_code,
  double4 AS consecutive_vps_failures
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '30' MINUTE
  AND blob2 = 'health_check'
ORDER BY timestamp DESC
LIMIT 200
```

Failure streaks by minute:

```sql
SELECT
  intDiv(toUInt32(timestamp), 60) * 60 AS minute,
  blob3 AS environment,
  max(double4) AS max_consecutive_vps_failures,
  sum(_sample_interval) AS health_checks
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '6' HOUR
  AND blob2 = 'health_check'
GROUP BY minute, environment
ORDER BY minute DESC
LIMIT 360
```

Active target history:

```sql
SELECT
  timestamp,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob9 AS actual_apex_dns_target,
  blob10 AS actual_www_dns_target,
  blob12 AS dns_action,
  blob15 AS live_origin_dns_state
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '24' HOUR
  AND blob2 = 'health_check'
ORDER BY timestamp DESC
LIMIT 500
```

Recent DNS target changes:

```sql
SELECT
  timestamp,
  blob3 AS environment,
  blob12 AS dns_action,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob13 AS error_code,
  double7 AS dns_update_duration_ms,
  double8 AS dns_target_changed
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '7' DAY
  AND blob2 = 'dns_target_change'
ORDER BY timestamp DESC
LIMIT 100
```
