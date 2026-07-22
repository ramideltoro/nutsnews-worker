import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILOVER_ALERT_SCHEMA_VERSION,
  assertNoSensitiveFailoverAlert,
  buildFailoverAlertLogFields,
  buildFailoverAlertCandidates,
  emitFailoverAlerts,
  readFailoverAlertConfig,
} from "../src/failoverAlerts.mjs";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }
}

const nowMs = Date.parse("2026-07-22T06:00:00.000Z");
const baseStatus = Object.freeze({
  generatedAt: "2026-07-22T05:59:55.000Z",
  controllerState: "vps_primary_healthy",
  activeDnsTarget: "vps",
  desiredDnsTarget: "vps",
  actualApexDnsTarget: "vps",
  actualWwwDnsTarget: "vps",
  observedDeploymentTarget: "production-vps",
  lastHealthResult: "reachable",
  lastVpsCheckAt: "2026-07-22T05:59:55.000Z",
  lastVpsReachable: true,
  lastVpsStatus: 200,
  lastVpsLatencyMs: 42,
  consecutiveVpsFailures: 0,
  failureThreshold: 3,
  lastDnsChangeAt: null,
  lastDnsChangeReason: "none",
  manualLock: false,
  stale: false,
  staleReason: null,
  liveOriginReadiness: {
    dnsState: "in_sync",
  },
});

function status(overrides = {}) {
  return {
    ...baseStatus,
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildFailoverAlertCandidates({
    source: "alarm",
    nowMs,
    alertConfig: {
      rateLimitSeconds: 3600,
      statusUrl: "https://ops.nutsnews.com/failover?token=do-not-include",
    },
    failoverConfig: {
      liveOriginPropagationWindowSeconds: 300,
    },
    ...overrides,
  });
}

test("failover to Vercel creates one clear safe alert", () => {
  const alerts = build({
    source: "dns_action",
    status: status({
      controllerState: "failed_over_vercel",
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vercel",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vercel",
      lastHealthResult: "timeout",
      lastVpsReachable: false,
      lastVpsStatus: "timeout",
      lastVpsLatencyMs: null,
      consecutiveVpsFailures: 3,
      lastDnsChangeAt: "2026-07-22T05:59:59.000Z",
      lastDnsChangeReason: "failover_to_vercel",
    }),
    action: { reason: "failover_to_vercel" },
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertSchemaVersion, FAILOVER_ALERT_SCHEMA_VERSION);
  assert.equal(alerts[0].alertType, "failover_to_vercel");
  assert.equal(alerts[0].activeDnsTarget, "vercel");
  assert.equal(alerts[0].desiredDnsTarget, "vercel");
  assert.equal(alerts[0].consecutiveVpsFailures, 3);
  assert.equal(alerts[0].statusUrl, "https://ops.nutsnews.com/failover");
  assertNoSensitiveFailoverAlert(alerts[0]);
});

test("failback to VPS creates a target-restored alert", () => {
  const alerts = build({
    source: "dns_action",
    status: status({
      controllerState: "vps_primary_healthy",
      activeDnsTarget: "vps",
      desiredDnsTarget: "vps",
      lastDnsChangeAt: "2026-07-22T05:59:59.000Z",
      lastDnsChangeReason: "failback_to_vps",
    }),
    action: { reason: "failback_to_vps" },
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertType, "failback_to_vps");
  assert.equal(alerts[0].activeDnsTarget, "vps");
});

test("stale controller creates a critical alert", () => {
  const alerts = build({
    status: status({
      controllerState: "stale",
      stale: true,
      staleReason: "status_update_overdue",
      lastVpsCheckAt: "2026-07-22T05:57:00.000Z",
    }),
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertType, "stale_controller");
  assert.equal(alerts[0].severity, "critical");
});

test("DNS drift waits for the propagation window", () => {
  const insideWindow = build({
    status: status({
      controllerState: "dns_drift",
      desiredDnsTarget: "vps",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vercel",
      lastDnsChangeAt: "2026-07-22T05:58:00.000Z",
      liveOriginReadiness: {
        dnsState: "propagating",
      },
    }),
  });
  const outsideWindow = build({
    status: status({
      controllerState: "dns_drift",
      desiredDnsTarget: "vps",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vercel",
      lastDnsChangeAt: "2026-07-22T05:50:00.000Z",
      liveOriginReadiness: {
        dnsState: "mismatch",
      },
    }),
  });

  assert.equal(insideWindow.length, 0);
  assert.equal(outsideWindow.length, 1);
  assert.equal(outsideWindow[0].alertType, "dns_drift");
});

test("DNS drift ignores unknown or missing readback targets", () => {
  const alerts = build({
    status: status({
      controllerState: "vps_primary_healthy",
      desiredDnsTarget: "vps",
      actualApexDnsTarget: undefined,
      actualWwwDnsTarget: "unknown",
      lastDnsChangeAt: "2026-07-22T05:50:00.000Z",
      liveOriginReadiness: {
        dnsState: "unknown",
      },
    }),
  });

  assert.equal(alerts.length, 0);
});

test("manual lock creates an automatic-failback disabled alert", () => {
  const alerts = build({
    source: "dns_action",
    status: status({
      controllerState: "manual_lock",
      desiredDnsTarget: "vercel",
      manualLock: true,
      lastDnsChangeAt: "2026-07-22T05:59:59.000Z",
      lastDnsChangeReason: "manual_lock_enabled",
    }),
    action: { reason: "manual_lock_enabled" },
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertType, "manual_lock_enabled");
  assert.equal(alerts[0].manualLock, true);
});

test("alert emission rate-limits repeated incident fingerprints", async () => {
  const storage = new MemoryStorage();
  const delivered = [];
  const context = {
    source: "dns_action",
    nowMs,
    failoverConfig: {
      liveOriginPropagationWindowSeconds: 300,
    },
    status: status({
      controllerState: "failed_over_vercel",
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vercel",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vercel",
      lastDnsChangeAt: "2026-07-22T05:59:59.000Z",
      lastDnsChangeReason: "failover_to_vercel",
      consecutiveVpsFailures: 3,
    }),
    action: { reason: "failover_to_vercel" },
  };

  const first = await emitFailoverAlerts({}, storage, context, {
    deliverAlert: async (_env, alert) => delivered.push(alert),
  });
  const second = await emitFailoverAlerts({}, storage, context, {
    deliverAlert: async (_env, alert) => delivered.push(alert),
  });

  assert.equal(first.sent.length, 1);
  assert.equal(first.suppressed.length, 0);
  assert.equal(second.sent.length, 0);
  assert.equal(second.suppressed.length, 1);
  assert.equal(delivered.length, 1);
});

test("alert delivery failures do not throw or break failover path", async () => {
  const storage = new MemoryStorage();
  const result = await emitFailoverAlerts({}, storage, {
    source: "dns_action",
    nowMs,
    status: status({
      controllerState: "failed_over_vercel",
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vercel",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vercel",
      lastDnsChangeAt: "2026-07-22T05:59:59.000Z",
      lastDnsChangeReason: "failover_to_vercel",
    }),
    action: { reason: "failover_to_vercel" },
  }, {
    deliverAlert: async () => {
      throw new Error("webhook unavailable");
    },
  });

  assert.equal(result.sent.length, 1);
  assert.equal(result.suppressed.length, 0);
});

test("alert log fields expose destination without leaking webhook URL", () => {
  const [alert] = build({
    source: "dns_action",
    status: status({
      controllerState: "failed_over_vercel",
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vercel",
      actualApexDnsTarget: "vercel",
      actualWwwDnsTarget: "vercel",
      lastDnsChangeAt: "2026-07-22T05:59:59.000Z",
      lastDnsChangeReason: "failover_to_vercel",
    }),
    action: { reason: "failover_to_vercel" },
  });
  const fields = buildFailoverAlertLogFields(alert, {
    webhookUrl: "sentinel_webhook_destination",
  });

  assert.equal(fields.alertDestination, "webhook_and_workers_logs");
  assert.equal(JSON.stringify(fields).includes("sentinel_webhook_destination"), false);
  assertNoSensitiveFailoverAlert(fields);
});

test("alert config sanitizes status URLs and accepts optional webhook secrets", async () => {
  const config = await readFailoverAlertConfig({
    NUTSNEWS_FAILOVER_ALERT_RATE_LIMIT_SECONDS: "90",
    NUTSNEWS_FAILOVER_STATUS_URL: "https://ops.nutsnews.com/failover?token=do-not-leak",
    NUTSNEWS_FAILOVER_ALERT_WEBHOOK_URL: {
      get: async () => "https://hooks.example.com/nutsnews",
    },
    NUTSNEWS_FAILOVER_ALERT_WEBHOOK_TOKEN: {
      get: async () => "sentinel-webhook-token",
    },
  });

  assert.equal(config.rateLimitSeconds, 90);
  assert.equal(config.statusUrl, "https://ops.nutsnews.com/failover");
  assert.equal(config.webhookUrl, "https://hooks.example.com/nutsnews");
  assert.equal(config.webhookToken, "sentinel-webhook-token");
});

test("sensitive alert payloads are rejected", () => {
  assert.throws(
    () => assertNoSensitiveFailoverAlert({ authorization: "Bearer sentinel-cloudflare-dns-api-token" }),
    /forbidden sensitive token/u,
  );
});
