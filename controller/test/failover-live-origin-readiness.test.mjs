import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyObservedLiveOrigin,
  readLiveOriginReadinessState,
} from "../src/failoverLiveOriginReadiness.mjs";
import {
  assertNoSensitiveFailoverState,
  readFailoverConfig,
  recordFailoverDnsAction,
  recordFailoverDnsReadback,
  recordFailoverLiveOriginReadiness,
} from "../src/failoverState.mjs";

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

  async transaction(callback) {
    return callback(this);
  }
}

const nowMs = Date.parse("2026-07-22T05:10:00.000Z");
const sourceCommit = "a".repeat(40);
const buildId = "1784697000-1";
const baseEnv = {
  NUTSNEWS_FAILOVER_APEX_READINESS_URL: "https://nutsnews.com/readyz",
  NUTSNEWS_FAILOVER_WWW_READINESS_URL: "https://www.nutsnews.com/readyz",
  NUTSNEWS_FAILOVER_LIVE_ORIGIN_READINESS_TIMEOUT_MS: "5000",
  NUTSNEWS_FAILOVER_LIVE_ORIGIN_PROPAGATION_WINDOW_SECONDS: "300",
};
const config = readFailoverConfig({
  NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS: "15",
  NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES: "3",
  NUTSNEWS_FAILOVER_CONTROLLER_VERSION: "test-controller-v1",
  NUTSNEWS_FAILOVER_LIVE_ORIGIN_PROPAGATION_WINDOW_SECONDS: "300",
});

function readinessResponse({
  deploymentTarget,
  status = 200,
  ok = true,
  code = "ready",
  headers = {},
  body = {},
} = {}) {
  return Response.json(
    {
      ok,
      service: "nutsnews-web",
      runtimeEnv: "production",
      sideEffectsMode: "enabled",
      databaseProviderMode: "backend_postgres_primary",
      productionWritesPaused: false,
      code,
      ...body,
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        "X-NutsNews-Deployment-Target": deploymentTarget,
        "X-NutsNews-Source-Commit": sourceCommit,
        "X-NutsNews-Build-Id": buildId,
        "X-NutsNews-Runtime-Environment": "production",
        "X-NutsNews-Database-Provider-Mode": "backend_postgres_primary",
        ...headers,
      },
    },
  );
}

function fetchReadinessByHost(recordsByHost) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    const parsed = new URL(String(url));
    const record = recordsByHost[parsed.hostname];

    if (!record) {
      return readinessResponse({
        deploymentTarget: "unknown",
        status: 404,
        ok: false,
        code: "not_found",
      });
    }

    return typeof record === "function" ? record(parsed, init) : record;
  };

  return { fetchImpl, requests };
}

async function persistDnsTargets(storage, apexTarget, wwwTarget) {
  return recordFailoverDnsReadback(storage, {
    checkedAt: new Date(nowMs).toISOString(),
    apexTarget,
    wwwTarget,
  }, {
    config,
    nowMs,
  });
}

test("classifies observed deployment targets into live origins", () => {
  assert.equal(classifyObservedLiveOrigin("production-vps"), "vps");
  assert.equal(classifyObservedLiveOrigin("vercel-production"), "vercel");
  assert.equal(classifyObservedLiveOrigin("unexpected-edge"), "unknown");
});

test("records cache-busted apex and www live readiness serving VPS", async () => {
  const { fetchImpl, requests } = fetchReadinessByHost({
    "nutsnews.com": readinessResponse({ deploymentTarget: "production-vps" }),
    "www.nutsnews.com": readinessResponse({ deploymentTarget: "production-vps" }),
  });
  const liveReadiness = await readLiveOriginReadinessState(baseEnv, {
    fetchImpl,
    nowMs,
    cacheBustToken: "test-cache-bust",
  });
  const storage = new MemoryStorage();
  await persistDnsTargets(storage, "vps", "vps");
  const updated = await recordFailoverLiveOriginReadiness(storage, liveReadiness, { config, nowMs });

  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => new URL(String(request.url)).searchParams.has("nutsnews-failover-readiness")));
  assert.ok(requests.every((request) => request.init.headers["Cache-Control"].includes("no-store")));
  assert.equal(updated.status.liveOriginReadiness.dnsState, "in_sync");
  assert.equal(updated.status.liveOriginReadiness.apex.origin, "vps");
  assert.equal(updated.status.liveOriginReadiness.www.origin, "vps");
  assert.equal(updated.status.liveOriginReadiness.apex.status, 200);
  assert.equal(updated.status.liveOriginReadiness.apex.sourceCommit, sourceCommit);
  assert.equal(updated.status.liveOriginReadiness.apex.buildId, buildId);
  assert.equal(updated.status.liveOriginReadiness.apex.readinessCode, "ready");
  assert.equal(updated.status.liveOriginReadiness.apex.sideEffectsMode, "enabled");
  assert.equal(updated.status.liveOriginReadiness.apex.databaseProviderMode, "backend_postgres_primary");
  assert.equal(updated.status.liveOriginReadiness.apex.cacheState, "fresh");
  assertNoSensitiveFailoverState(updated.status);
});

test("records live readiness serving Vercel when DNS readback targets Vercel", async () => {
  const { fetchImpl } = fetchReadinessByHost({
    "nutsnews.com": readinessResponse({ deploymentTarget: "vercel-production" }),
    "www.nutsnews.com": readinessResponse({ deploymentTarget: "vercel-production" }),
  });
  const liveReadiness = await readLiveOriginReadinessState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  await persistDnsTargets(storage, "vercel", "vercel");
  const updated = await recordFailoverLiveOriginReadiness(storage, liveReadiness, { config, nowMs });

  assert.equal(liveReadiness.apex.origin, "vercel");
  assert.equal(liveReadiness.www.origin, "vercel");
  assert.equal(updated.status.liveOriginReadiness.dnsState, "in_sync");
  assert.equal(updated.status.liveOriginReadiness.apex.deploymentTarget, "vercel-production");
  assertNoSensitiveFailoverState(updated.status);
});

test("records unexpected deployment targets as unknown without leaking arbitrary body text", async () => {
  const { fetchImpl } = fetchReadinessByHost({
    "nutsnews.com": readinessResponse({
      deploymentTarget: "unexpected-edge",
      body: { code: "do-not-leak-sentinel-token" },
    }),
    "www.nutsnews.com": readinessResponse({
      deploymentTarget: "unexpected-edge",
      body: { code: "do-not-leak-sentinel-token" },
    }),
  });
  const liveReadiness = await readLiveOriginReadinessState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  await persistDnsTargets(storage, "vps", "vps");
  const updated = await recordFailoverLiveOriginReadiness(storage, liveReadiness, { config, nowMs });
  const serialized = JSON.stringify(updated.status);

  assert.equal(updated.status.liveOriginReadiness.dnsState, "unknown");
  assert.equal(updated.status.liveOriginReadiness.apex.origin, "unknown");
  assert.equal(updated.status.liveOriginReadiness.apex.deploymentTarget, "unexpected-edge");
  assert.equal(updated.status.liveOriginReadiness.apex.readinessCode, "unknown");
  assert.equal(serialized.includes("do-not-leak"), false);
  assertNoSensitiveFailoverState(updated.status);
});

test("records timeout failures as unreachable live origins", async () => {
  const timeoutError = new DOMException("Timed out", "AbortError");
  const fetchImpl = async () => {
    throw timeoutError;
  };
  const liveReadiness = await readLiveOriginReadinessState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  await persistDnsTargets(storage, "vps", "vps");
  const updated = await recordFailoverLiveOriginReadiness(storage, liveReadiness, { config, nowMs });

  assert.equal(updated.status.liveOriginReadiness.dnsState, "unreachable");
  assert.equal(updated.status.liveOriginReadiness.apex.origin, "unreachable");
  assert.equal(updated.status.liveOriginReadiness.www.origin, "unreachable");
  assert.equal(updated.status.liveOriginReadiness.apex.error, "timeout");
  assertNoSensitiveFailoverState(updated.status);
});

test("records stale cache indicators without changing origin classification", async () => {
  const { fetchImpl } = fetchReadinessByHost({
    "nutsnews.com": readinessResponse({
      deploymentTarget: "production-vps",
      headers: {
        "Age": "45",
        "CF-Cache-Status": "HIT",
      },
    }),
    "www.nutsnews.com": readinessResponse({ deploymentTarget: "production-vps" }),
  });
  const liveReadiness = await readLiveOriginReadinessState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  await persistDnsTargets(storage, "vps", "vps");
  const updated = await recordFailoverLiveOriginReadiness(storage, liveReadiness, { config, nowMs });

  assert.equal(updated.status.liveOriginReadiness.dnsState, "in_sync");
  assert.equal(updated.status.liveOriginReadiness.apex.origin, "vps");
  assert.equal(updated.status.liveOriginReadiness.apex.cacheState, "stale");
  assert.equal(updated.status.liveOriginReadiness.www.cacheState, "fresh");
});

test("marks recent live/DNS mismatches as propagation instead of controller drift", async () => {
  const { fetchImpl } = fetchReadinessByHost({
    "nutsnews.com": readinessResponse({ deploymentTarget: "production-vps" }),
    "www.nutsnews.com": readinessResponse({ deploymentTarget: "production-vps" }),
  });
  const liveReadiness = await readLiveOriginReadinessState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  await recordFailoverDnsAction(storage, {
    idempotencyKey: "failover-to-vercel",
    changedAt: new Date(nowMs - 60_000).toISOString(),
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vercel",
    reason: "failover_to_vercel",
  }, {
    config,
    nowMs,
  });
  await persistDnsTargets(storage, "vercel", "vercel");
  const updated = await recordFailoverLiveOriginReadiness(storage, liveReadiness, { config, nowMs });

  assert.equal(updated.status.actualApexDnsTarget, "vercel");
  assert.equal(updated.status.liveOriginReadiness.apex.origin, "vps");
  assert.equal(updated.status.liveOriginReadiness.dnsState, "propagating");
  assert.equal(updated.status.controllerState, "failed_over_vercel");
});
