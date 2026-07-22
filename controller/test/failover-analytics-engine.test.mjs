import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILOVER_ANALYTICS_BLOBS,
  FAILOVER_ANALYTICS_DATASET,
  FAILOVER_ANALYTICS_DOUBLES,
  FAILOVER_ANALYTICS_SCHEMA_VERSION,
  assertNoSensitiveFailoverAnalytics,
  buildFailoverDnsTargetChangeAnalyticsDataPoint,
  buildFailoverHealthCheckAnalyticsDataPoint,
  writeFailoverDnsTargetChangeAnalytics,
  writeFailoverHealthCheckAnalytics,
} from "../src/failoverAnalyticsEngine.mjs";

const healthyStatus = Object.freeze({
  generatedAt: "2026-07-22T05:20:00.000Z",
  controllerState: "vps_primary_healthy",
  activeDnsTarget: "vps",
  desiredDnsTarget: "vps",
  actualApexDnsTarget: "vps",
  actualWwwDnsTarget: "vps",
  observedDeploymentTarget: "production-vps",
  lastHealthResult: "reachable",
  lastVpsCheckAt: "2026-07-22T05:19:55.000Z",
  lastVpsReachable: true,
  lastVpsStatus: 200,
  lastVpsLatencyMs: 42,
  consecutiveVpsFailures: 0,
  failureThreshold: 3,
  manualLock: false,
  controllerVersion: "test-controller-v1",
  liveOriginReadiness: {
    dnsState: "in_sync",
  },
});

function status(overrides = {}) {
  return {
    ...healthyStatus,
    ...overrides,
  };
}

function dnsReadback(overrides = {}) {
  return {
    configured: true,
    ok: true,
    error: null,
    ...overrides,
  };
}

function createAnalyticsEnv(writeDataPoint) {
  return {
    NUTSNEWS_FAILOVER_ANALYTICS_ENVIRONMENT: "test",
    FAILOVER_ANALYTICS: {
      writeDataPoint,
    },
  };
}

test("analytics schema stays within Workers Analytics Engine limits", () => {
  assert.equal(FAILOVER_ANALYTICS_DATASET, "nutsnews_failover_controller");
  assert.equal(FAILOVER_ANALYTICS_BLOBS.length <= 20, true);
  assert.equal(FAILOVER_ANALYTICS_DOUBLES.length <= 20, true);
});

test("health check data point includes queryable dimensions and measures", () => {
  const point = buildFailoverHealthCheckAnalyticsDataPoint({
    env: { NUTSNEWS_FAILOVER_ANALYTICS_ENVIRONMENT: "test" },
    source: "alarm",
    status: healthyStatus,
    dnsReadback: dnsReadback(),
  });

  assert.deepEqual(point.blobs, [
    FAILOVER_ANALYTICS_SCHEMA_VERSION,
    "health_check",
    "test",
    "test-controller-v1",
    "alarm",
    "vps_primary_healthy",
    "vps",
    "vps",
    "vps",
    "vps",
    "reachable",
    "no_op",
    "none",
    "production-vps",
    "in_sync",
    "false",
    "true",
  ]);
  assert.deepEqual(point.doubles, [
    1,
    42,
    200,
    0,
    3,
    1,
    0,
    0,
    0,
    1,
    1,
    1,
  ]);
  assert.deepEqual(point.indexes, ["nutsnews-failover:test"]);
  assertNoSensitiveFailoverAnalytics(point);
});

test("health check data point carries failover decision context", () => {
  const point = buildFailoverHealthCheckAnalyticsDataPoint({
    env: { NUTSNEWS_FAILOVER_ANALYTICS_ENVIRONMENT: "test" },
    source: "alarm",
    status: status({
      controllerState: "failed_over_vercel",
      activeDnsTarget: "vps",
      desiredDnsTarget: "vercel",
      actualApexDnsTarget: "vps",
      actualWwwDnsTarget: "vps",
      lastHealthResult: "timeout",
      lastVpsReachable: false,
      lastVpsStatus: "timeout",
      lastVpsLatencyMs: null,
      consecutiveVpsFailures: 3,
    }),
    dnsReadback: dnsReadback(),
  });

  assert.equal(point.blobs[10], "timeout");
  assert.equal(point.blobs[11], "failover_to_vercel");
  assert.equal(point.doubles[3], 3);
  assert.equal(point.doubles[5], 0);
  assert.equal(point.doubles[9], 0);
  assert.equal(point.doubles[10], 0);
});

test("DNS API error summaries are safe for analytics", () => {
  const point = buildFailoverHealthCheckAnalyticsDataPoint({
    env: { NUTSNEWS_FAILOVER_ANALYTICS_ENVIRONMENT: "test" },
    source: "alarm",
    status: healthyStatus,
    dnsReadback: dnsReadback({
      ok: false,
      error: "cloudflare_dns_api_error do-not-leak sentinel-cloudflare-dns-api-token",
    }),
  });
  const serialized = JSON.stringify(point);

  assert.equal(point.blobs[11], "dns_api_error");
  assert.equal(point.blobs[12], "unknown");
  assert.equal(point.doubles[11], 0);
  assert.equal(serialized.includes("do-not-leak"), false);
  assert.equal(serialized.includes("sentinel-cloudflare-dns-api-token"), false);
  assertNoSensitiveFailoverAnalytics(point);
});

test("DNS target change data point records target history and update duration", () => {
  const point = buildFailoverDnsTargetChangeAnalyticsDataPoint({
    env: { NUTSNEWS_FAILOVER_ANALYTICS_ENVIRONMENT: "test" },
    source: "dns_action",
    status: status({
      generatedAt: "2026-07-22T05:25:00.000Z",
      controllerState: "failed_over_vercel",
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vercel",
      lastDnsChangeReason: "failover_to_vercel",
      lastVpsReachable: false,
      consecutiveVpsFailures: 3,
    }),
    action: {
      reason: "failover_to_vercel",
      durationMs: 1234,
    },
  });

  assert.equal(point.blobs[1], "dns_target_change");
  assert.equal(point.blobs[6], "vercel");
  assert.equal(point.blobs[7], "vercel");
  assert.equal(point.blobs[11], "failover_to_vercel");
  assert.equal(point.doubles[6], 1234);
  assert.equal(point.doubles[7], 1);
  assertNoSensitiveFailoverAnalytics(point);
});

test("analytics writes are best-effort and skip missing bindings", () => {
  assert.equal(writeFailoverHealthCheckAnalytics({}, {
    source: "alarm",
    status: healthyStatus,
    dnsReadback: dnsReadback(),
  }), false);
});

test("analytics write failures do not throw or block the failover path", () => {
  const env = createAnalyticsEnv(() => {
    throw new Error("analytics ingestion unavailable");
  });

  assert.doesNotThrow(() => {
    const written = writeFailoverHealthCheckAnalytics(env, {
      source: "alarm",
      status: healthyStatus,
      dnsReadback: dnsReadback(),
    });

    assert.equal(written, false);
  });
});

test("analytics writer records health checks when the binding succeeds", () => {
  const writes = [];
  const env = createAnalyticsEnv((point) => writes.push(point));

  assert.equal(writeFailoverHealthCheckAnalytics(env, {
    source: "alarm",
    status: healthyStatus,
    dnsReadback: dnsReadback(),
  }), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].blobs[1], "health_check");
});

test("duplicate DNS actions do not write another target-change point", () => {
  const writes = [];
  const env = createAnalyticsEnv((point) => writes.push(point));

  assert.equal(writeFailoverDnsTargetChangeAnalytics(env, {
    source: "dns_action",
    status: healthyStatus,
    action: { reason: "failover_to_vercel" },
    duplicate: true,
  }), false);
  assert.equal(writes.length, 0);
});

test("assertion rejects sensitive analytics payload fields", () => {
  assert.throws(
    () => assertNoSensitiveFailoverAnalytics({ authorization: "Bearer sentinel-cloudflare-dns-api-token" }),
    /forbidden sensitive token/u,
  );
});
