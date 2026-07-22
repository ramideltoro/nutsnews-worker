import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertNoSensitiveFailoverWorkersLog,
  buildFailoverDnsDecisionLogFields,
  buildFailoverHealthCheckLogFields,
  getFailoverDnsDecisionLogLevel,
  getFailoverHealthCheckLogLevel,
} from "../src/failoverWorkersLogs.mjs";

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

test("health check log fields are structured, filterable, and safe", () => {
  const fields = buildFailoverHealthCheckLogFields({
    source: "alarm",
    status: healthyStatus,
  });

  assert.deepEqual(fields, {
    failoverEventType: "health_check",
    checkedAt: "2026-07-22T05:19:55.000Z",
    source: "alarm",
    controllerState: "vps_primary_healthy",
    activeDnsTarget: "vps",
    desiredDnsTarget: "vps",
    actualApexDnsTarget: "vps",
    actualWwwDnsTarget: "vps",
    healthResult: "reachable",
    vpsReachable: true,
    vpsStatus: 200,
    vpsLatencyMs: 42,
    observedDeploymentTarget: "production-vps",
    consecutiveVpsFailures: 0,
    failureThreshold: 3,
    liveOriginDnsState: "in_sync",
  });
  assert.equal(getFailoverHealthCheckLogLevel(healthyStatus), "info");
  assertNoSensitiveFailoverWorkersLog(fields);
});

test("failed health checks log at warn with safe status fields", () => {
  const failedStatus = status({
    controllerState: "vps_health_degraded",
    lastHealthResult: "timeout",
    lastVpsReachable: false,
    lastVpsStatus: "timeout",
    lastVpsLatencyMs: null,
    consecutiveVpsFailures: 2,
  });
  const fields = buildFailoverHealthCheckLogFields({
    source: "scheduled_watchdog",
    status: failedStatus,
  });

  assert.equal(fields.healthResult, "timeout");
  assert.equal(fields.vpsReachable, false);
  assert.equal(fields.vpsStatus, "timeout");
  assert.equal(fields.consecutiveVpsFailures, 2);
  assert.equal(getFailoverHealthCheckLogLevel(failedStatus), "warn");
  assertNoSensitiveFailoverWorkersLog(fields);
});

test("DNS decision logs no-op when active and desired targets match", () => {
  const fields = buildFailoverDnsDecisionLogFields({
    source: "alarm",
    status: healthyStatus,
    dnsReadback: dnsReadback(),
  });

  assert.equal(fields.failoverEventType, "dns_decision");
  assert.equal(fields.dnsAction, "no_op");
  assert.equal(fields.dnsWriteAttempted, false);
  assert.equal(fields.dnsWriteSkipped, true);
  assert.equal(fields.dnsSkipReason, "active_dns_target_matches_desired_target");
  assert.equal(fields.dnsReadbackConfigured, true);
  assert.equal(fields.dnsReadbackOk, true);
  assert.equal(getFailoverDnsDecisionLogLevel(fields), "info");
  assertNoSensitiveFailoverWorkersLog(fields);
});

test("DNS decision logs failover and failback actions when desired target differs", () => {
  const failover = buildFailoverDnsDecisionLogFields({
    source: "alarm",
    status: status({
      activeDnsTarget: "vps",
      desiredDnsTarget: "vercel",
      lastHealthResult: "timeout",
      lastVpsReachable: false,
      consecutiveVpsFailures: 3,
    }),
    dnsReadback: dnsReadback(),
  });
  const failback = buildFailoverDnsDecisionLogFields({
    source: "alarm",
    status: status({
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vps",
    }),
    dnsReadback: dnsReadback(),
  });

  assert.equal(failover.dnsAction, "failover_to_vercel");
  assert.equal(failover.dnsSkipReason, "dns_write_not_implemented_for_observation_only_controller");
  assert.equal(failback.dnsAction, "failback_to_vps");
  assert.equal(getFailoverDnsDecisionLogLevel(failover), "warn");
  assert.equal(getFailoverDnsDecisionLogLevel(failback), "warn");
  assertNoSensitiveFailoverWorkersLog({ failover, failback });
});

test("DNS decision logs manual lock skip before other actions", () => {
  const fields = buildFailoverDnsDecisionLogFields({
    source: "manual_fetch",
    status: status({
      manualLock: true,
      activeDnsTarget: "vps",
      desiredDnsTarget: "vercel",
    }),
    dnsReadback: dnsReadback(),
  });

  assert.equal(fields.dnsAction, "manual_lock_skip");
  assert.equal(fields.dnsSkipReason, "manual_lock_enabled");
  assert.equal(getFailoverDnsDecisionLogLevel(fields), "info");
});

test("DNS API errors log safe summaries without leaking response text or tokens", () => {
  const fields = buildFailoverDnsDecisionLogFields({
    source: "alarm",
    status: healthyStatus,
    dnsReadback: dnsReadback({
      ok: false,
      error: "cloudflare_dns_api_error do-not-leak sentinel-cloudflare-dns-api-token",
    }),
  });
  const serialized = JSON.stringify(fields);

  assert.equal(fields.dnsAction, "dns_api_error");
  assert.equal(fields.dnsErrorCode, "unknown");
  assert.equal(fields.dnsSkipReason, "dns_readback_failed");
  assert.equal(getFailoverDnsDecisionLogLevel(fields), "warn");
  assert.equal(serialized.includes("do-not-leak"), false);
  assert.equal(serialized.includes("sentinel-cloudflare-dns-api-token"), false);
  assertNoSensitiveFailoverWorkersLog(fields);
});

test("DNS drift logs as a filterable decision event", () => {
  const fields = buildFailoverDnsDecisionLogFields({
    source: "alarm",
    status: status({
      desiredDnsTarget: "vps",
      activeDnsTarget: "vps",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vps",
      controllerState: "dns_drift",
    }),
    dnsReadback: dnsReadback(),
  });

  assert.equal(fields.dnsAction, "drift_detected");
  assert.equal(fields.dnsSkipReason, "actual_dns_target_differs_from_desired_target");
  assert.equal(getFailoverDnsDecisionLogLevel(fields), "warn");
  assertNoSensitiveFailoverWorkersLog(fields);
});

test("assertion rejects sensitive log fields", () => {
  assert.throws(
    () => assertNoSensitiveFailoverWorkersLog({ authorization: "Bearer sentinel-cloudflare-dns-api-token" }),
    /forbidden sensitive token/u,
  );
});
