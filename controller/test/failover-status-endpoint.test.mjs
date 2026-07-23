import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILOVER_STATUS_SIGNATURE_HEADER,
  FAILOVER_STATUS_TIMESTAMP_HEADER,
  createFailoverStatusSignature,
  handleFailoverControllerHealthRequest,
  handleFailoverControllerStatusRequest,
} from "../src/failoverStatusEndpoint.mjs";
import { assertNoSensitiveFailoverState } from "../src/failoverState.mjs";

const secret = "test-failover-status-hmac-secret";
const nowMs = Date.parse("2026-07-22T04:20:00.000Z");
const timestamp = String(Math.floor(nowMs / 1000));

const env = {
  NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET: secret,
  NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS: "15",
  NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES: "3",
  NUTSNEWS_FAILOVER_CONTROLLER_STALE_AFTER_SECONDS: "60",
  NUTSNEWS_FAILOVER_CONTROLLER_VERSION: "test-controller-v1",
  FAILOVER_CONTROLLER_STATE: {},
};

const defaultLiveOriginReadiness = Object.freeze({
  checkedAt: "2026-07-22T04:20:00.000Z",
  dnsState: "unknown",
  apex: {
    checkedAt: "2026-07-22T04:20:00.000Z",
    hostname: "nutsnews.com",
    ok: false,
    origin: "unknown",
    status: null,
    latencyMs: null,
    deploymentTarget: "unknown",
    sourceCommit: "unknown",
    buildId: "unknown",
    readinessCode: "unknown",
    runtimeEnv: "unknown",
    sideEffectsMode: "unknown",
    databaseProviderMode: "unknown",
    productionWritesPaused: null,
    cacheState: "unknown",
    error: null,
  },
  www: {
    checkedAt: "2026-07-22T04:20:00.000Z",
    hostname: "www.nutsnews.com",
    ok: false,
    origin: "unknown",
    status: null,
    latencyMs: null,
    deploymentTarget: "unknown",
    sourceCommit: "unknown",
    buildId: "unknown",
    readinessCode: "unknown",
    runtimeEnv: "unknown",
    sideEffectsMode: "unknown",
    databaseProviderMode: "unknown",
    productionWritesPaused: null,
    cacheState: "unknown",
    error: null,
  },
});

const healthyVpsStatus = Object.freeze({
  schemaVersion: "nutsnews.failover.status.v1",
  generatedAt: "2026-07-22T04:19:55.000Z",
  controllerState: "vps_primary_healthy",
  activeDnsTarget: "vps",
  desiredDnsTarget: "vps",
  actualApexDnsTarget: "vps",
  actualWwwDnsTarget: "vps",
  observedDeploymentTarget: "production-vps",
  liveOriginReadiness: defaultLiveOriginReadiness,
  lastHealthResult: "reachable",
  lastVpsCheckAt: "2026-07-22T04:19:55.000Z",
  lastVpsReachable: true,
  lastVpsStatus: 200,
  lastVpsLatencyMs: 42,
  consecutiveVpsFailures: 0,
  failureThreshold: 3,
  checkIntervalSeconds: 15,
  lastDnsChangeAt: null,
  lastDnsChangeReason: "none",
  manualLock: false,
  nextCheckDueAt: "2026-07-22T04:20:10.000Z",
  stale: false,
  staleReason: null,
  controllerVersion: "test-controller-v1",
});

const healthyHistoryRow = Object.freeze({
  checkedAt: "2026-07-22T04:19:55.000Z",
  source: "scheduled_watchdog",
  healthResult: "reachable",
  vpsReachable: true,
  vpsStatus: 200,
  vpsLatencyMs: 42,
  observedDeploymentTarget: "production-vps",
  consecutiveVpsFailures: 0,
  activeDnsTarget: "vps",
  desiredDnsTarget: "vps",
  errorCode: null,
});

const failedHistoryRow = Object.freeze({
  checkedAt: "2026-07-22T04:19:40.000Z",
  source: "manual_fetch",
  healthResult: "timeout",
  vpsReachable: false,
  vpsStatus: "timeout",
  vpsLatencyMs: 5000,
  observedDeploymentTarget: "unknown",
  consecutiveVpsFailures: 1,
  activeDnsTarget: "vps",
  desiredDnsTarget: "vps",
  errorCode: "timeout",
});

async function signedRequest(path = "/status", method = "GET", signatureOverride = null) {
  const request = new Request(`https://controller.nutsnews.workers.dev${path}`, { method });
  const signature = signatureOverride ?? await createFailoverStatusSignature({
    request,
    secret,
    timestamp,
  });

  request.headers.set(FAILOVER_STATUS_TIMESTAMP_HEADER, timestamp);
  request.headers.set(FAILOVER_STATUS_SIGNATURE_HEADER, signature);

  return request;
}

async function statusResponse(status, request = null, customEnv = env, snapshot = {}) {
  return handleFailoverControllerStatusRequest(request ?? await signedRequest(), customEnv, {
    nowMs,
    readStatusSnapshot: async () => ({ ok: true, status, ...snapshot }),
  });
}

async function readJson(response) {
  return response.json();
}

test("GET /healthz reports controller readiness without failover state details", async () => {
  const response = handleFailoverControllerHealthRequest(
    new Request("https://controller.nutsnews.workers.dev/healthz"),
    env,
  );
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, "nutsnews-controller");
  assert.equal(payload.failoverStateBound, true);
  assert.equal(response.headers.get("cache-control")?.includes("no-store"), true);
  assert.equal(Object.hasOwn(payload, "activeDnsTarget"), false);
});

test("GET /status rejects unauthorized requests before reading state", async () => {
  let readAttempted = false;
  const response = await handleFailoverControllerStatusRequest(
    new Request("https://controller.nutsnews.workers.dev/status"),
    env,
    {
      nowMs,
      readStatusSnapshot: async () => {
        readAttempted = true;
        return { ok: true, status: healthyVpsStatus };
      },
    },
  );
  const payload = await readJson(response);

  assert.equal(response.status, 401);
  assert.equal(payload.error, "unauthorized");
  assert.equal(readAttempted, false);
  assert.equal(response.headers.get("cache-control")?.includes("no-store"), true);
});

test("GET /status rejects invalid signatures", async () => {
  const response = await statusResponse(healthyVpsStatus, await signedRequest("/status", "GET", "v1=00"));
  const payload = await readJson(response);

  assert.equal(response.status, 401);
  assert.equal(payload.error, "unauthorized");
});

test("GET /status returns the public-safe healthy VPS-primary status contract", async () => {
  const response = await statusResponse(healthyVpsStatus);
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(payload, { ...healthyVpsStatus, healthHistory: [] });
  assert.equal(response.headers.get("x-nutsnews-failover-status-mode"), "dashboard");
  assert.equal(response.headers.get("cache-control")?.includes("no-store"), true);
  assertNoSensitiveFailoverState(payload);
});

test("GET /status exposes recent public-safe health history", async () => {
  const response = await statusResponse(healthyVpsStatus, null, env, {
    history: [
      {
        ...healthyHistoryRow,
        source: "SCHEDULED_WATCHDOG",
        errorCode: "do-not-leak-sentinel-token",
      },
      failedHistoryRow,
      {
        checkedAt: "not-a-date",
        source: "cloudflareApiToken",
        healthResult: "reachable",
      },
    ],
  });
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(payload.healthHistory, [
    {
      ...healthyHistoryRow,
      source: "scheduled_watchdog",
      errorCode: null,
    },
    failedHistoryRow,
  ]);
  assert.equal(JSON.stringify(payload).includes("do-not-leak"), false);
  assert.equal(JSON.stringify(payload).includes("cloudflareApiToken"), false);
  assertNoSensitiveFailoverState(payload);
});

test("GET /status returns empty health history when controller has no recent rows", async () => {
  const response = await statusResponse(healthyVpsStatus, null, env, { history: [] });
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(payload.healthHistory, []);
  assertNoSensitiveFailoverState(payload);
});

test("GET /status returns empty health history for old snapshots that omit history", async () => {
  const response = await statusResponse(healthyVpsStatus);
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.deepEqual(payload.healthHistory, []);
  assertNoSensitiveFailoverState(payload);
});

test("GET /status reports unavailable history when failover state cannot be read", async () => {
  const response = await handleFailoverControllerStatusRequest(await signedRequest(), env, {
    nowMs,
    readStatusSnapshot: async () => ({
      ok: false,
      statusCode: 503,
      error: "failover_state_unavailable",
    }),
  });
  const payload = await readJson(response);

  assert.equal(response.status, 503);
  assert.equal(payload.error, "failover_state_unavailable");
  assert.equal(Object.hasOwn(payload, "healthHistory"), false);
});

test("GET /status reports stale controller state from old generatedAt timestamps", async () => {
  const response = await statusResponse({
    ...healthyVpsStatus,
    generatedAt: "2026-07-22T04:18:30.000Z",
    lastVpsCheckAt: "2026-07-22T04:18:30.000Z",
    nextCheckDueAt: "2026-07-22T04:18:45.000Z",
  });
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.controllerState, "stale");
  assert.equal(payload.stale, true);
  assert.equal(payload.staleReason, "status_update_overdue");
});

test("GET /status reports Vercel failover target and latest VPS failure fields", async () => {
  const failedOverStatus = {
    ...healthyVpsStatus,
    generatedAt: "2026-07-22T04:19:58.000Z",
    controllerState: "failed_over_vercel",
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vercel",
    actualApexDnsTarget: "vercel",
    actualWwwDnsTarget: "vercel",
    observedDeploymentTarget: "vercel-production",
    lastHealthResult: "timeout",
    lastVpsCheckAt: "2026-07-22T04:19:58.000Z",
    lastVpsReachable: false,
    lastVpsStatus: "timeout",
    lastVpsLatencyMs: null,
    consecutiveVpsFailures: 3,
    lastDnsChangeAt: "2026-07-22T04:19:59.000Z",
    lastDnsChangeReason: "failover_to_vercel",
    nextCheckDueAt: "2026-07-22T04:20:13.000Z",
  };
  const response = await statusResponse(failedOverStatus);
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.activeDnsTarget, "vercel");
  assert.equal(payload.desiredDnsTarget, "vercel");
  assert.equal(payload.lastHealthResult, "timeout");
  assert.equal(payload.consecutiveVpsFailures, 3);
  assert.equal(payload.lastDnsChangeReason, "failover_to_vercel");
  assert.equal(payload.manualLock, false);
  assert.equal(payload.nextCheckDueAt, "2026-07-22T04:20:13.000Z");
  assertNoSensitiveFailoverState(payload);
});
