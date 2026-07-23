import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILOVER_CHECK_INTERVAL_SECONDS,
  FAILOVER_FAILURE_THRESHOLD,
  FAILOVER_HISTORY_LIMIT,
  assertNoSensitiveFailoverState,
  readFailoverAuditHistory,
  readFailoverCheckHistory,
  readFailoverDnsHistory,
  readFailoverConfig,
  readFailoverStatus,
  recordFailoverAuditEvent,
  recordFailoverDnsAction,
  recordFailoverDnsReadback,
  recordFailoverHealthCheck,
} from "../src/failoverState.mjs";

class MemoryStorage {
  constructor(seed) {
    this.store = seed ?? new Map();
    this.alarms = [];
    this.transactionTail = Promise.resolve();
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async transaction(callback) {
    const run = this.transactionTail.then(() => callback(this));
    this.transactionTail = run.catch(() => {});

    return run;
  }

  async setAlarm(timestamp) {
    this.alarms.push(timestamp);
  }
}

const config = readFailoverConfig({
  NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS: String(FAILOVER_CHECK_INTERVAL_SECONDS),
  NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES: String(FAILOVER_FAILURE_THRESHOLD),
  NUTSNEWS_FAILOVER_CONTROLLER_VERSION: "test-controller-v1",
});

function failureCheck(checkedAt, status = "timeout") {
  return {
    checkedAt,
    healthResult: status === "timeout" ? "timeout" : "network_error",
    reachable: false,
    status,
    latencyMs: null,
    observedDeploymentTarget: "unknown",
  };
}

function reachableCheck(checkedAt) {
  return {
    checkedAt,
    healthResult: "reachable",
    reachable: true,
    status: 200,
    latencyMs: 42,
    observedDeploymentTarget: "production-vps",
  };
}

test("failover status rehydrates from Durable Object storage after restart", async () => {
  const backingStore = new Map();
  const storage = new MemoryStorage(backingStore);
  const firstCheckAt = "2026-07-22T04:00:00.000Z";

  const firstResult = await recordFailoverHealthCheck(storage, reachableCheck(firstCheckAt), {
    config,
    force: true,
    nowMs: Date.parse(firstCheckAt),
    source: "alarm",
  });

  assert.equal(firstResult.checked, true);
  assert.equal(firstResult.status.lastVpsReachable, true);
  assert.equal(firstResult.status.observedDeploymentTarget, "production-vps");

  const restartedStorage = new MemoryStorage(backingStore);
  const rehydratedStatus = await readFailoverStatus(
    restartedStorage,
    Date.parse("2026-07-22T04:00:05.000Z"),
    config,
  );
  const rehydratedHistory = await readFailoverCheckHistory(restartedStorage);

  assert.equal(rehydratedStatus.lastVpsCheckAt, firstCheckAt);
  assert.equal(rehydratedStatus.lastVpsStatus, 200);
  assert.equal(rehydratedStatus.consecutiveVpsFailures, 0);
  assert.equal(rehydratedHistory.length, 1);
  assertNoSensitiveFailoverState({ status: rehydratedStatus, history: rehydratedHistory });
});

test("first health check persists even when the default nextCheckDueAt is in the future", async () => {
  const storage = new MemoryStorage();
  const checkedAt = "2026-07-22T04:00:00.000Z";

  const result = await recordFailoverHealthCheck(storage, reachableCheck(checkedAt), {
    config,
    nowMs: Date.parse(checkedAt),
    source: "scheduled_watchdog",
  });
  const storedStatus = await readFailoverStatus(storage, Date.parse("2026-07-22T04:00:01.000Z"), config);
  const history = await readFailoverCheckHistory(storage);

  assert.equal(result.checked, true);
  assert.equal(storedStatus.lastVpsCheckAt, checkedAt);
  assert.equal(storedStatus.lastVpsReachable, true);
  assert.equal(history.length, 1);
});

test("watchdog wakes before nextCheckDueAt do not double-count failures", async () => {
  const storage = new MemoryStorage();
  const firstCheckAt = "2026-07-22T04:00:00.000Z";
  const duplicateWakeAt = "2026-07-22T04:00:01.000Z";
  const secondDueAt = "2026-07-22T04:00:15.000Z";

  const firstResult = await recordFailoverHealthCheck(storage, failureCheck(firstCheckAt), {
    config,
    force: true,
    nowMs: Date.parse(firstCheckAt),
    source: "alarm",
  });
  const duplicateResult = await recordFailoverHealthCheck(storage, failureCheck(duplicateWakeAt), {
    config,
    nowMs: Date.parse(duplicateWakeAt),
    source: "watchdog",
  });
  const secondResult = await recordFailoverHealthCheck(storage, failureCheck(secondDueAt), {
    config,
    nowMs: Date.parse(secondDueAt),
    source: "alarm",
  });

  assert.equal(firstResult.checked, true);
  assert.equal(firstResult.status.consecutiveVpsFailures, 1);
  assert.equal(duplicateResult.checked, false);
  assert.equal(duplicateResult.status.consecutiveVpsFailures, 1);
  assert.equal(secondResult.checked, true);
  assert.equal(secondResult.status.consecutiveVpsFailures, 2);
});

test("concurrent due wakes serialize to one persisted health check", async () => {
  const storage = new MemoryStorage();
  const firstCheckAt = "2026-07-22T04:00:00.000Z";
  const dueAt = "2026-07-22T04:00:15.000Z";

  await recordFailoverHealthCheck(storage, failureCheck(firstCheckAt), {
    config,
    force: true,
    nowMs: Date.parse(firstCheckAt),
    source: "alarm",
  });

  const results = await Promise.all([
    recordFailoverHealthCheck(storage, failureCheck(dueAt), {
      config,
      nowMs: Date.parse(dueAt),
      source: "alarm",
    }),
    recordFailoverHealthCheck(storage, failureCheck(dueAt), {
      config,
      nowMs: Date.parse(dueAt),
      source: "scheduled_watchdog",
    }),
  ]);
  const checkedResults = results.filter((result) => result.checked);
  const status = await readFailoverStatus(storage, Date.parse("2026-07-22T04:00:16.000Z"), config);
  const history = await readFailoverCheckHistory(storage);

  assert.equal(checkedResults.length, 1);
  assert.equal(status.consecutiveVpsFailures, 2);
  assert.equal(history.length, 2);
});

test("three consecutive VPS failures make Vercel the desired DNS target", async () => {
  const storage = new MemoryStorage();
  let result;

  for (let index = 0; index < FAILOVER_FAILURE_THRESHOLD; index += 1) {
    const checkedAt = new Date(Date.parse("2026-07-22T04:00:00.000Z") + index * 15_000).toISOString();
    result = await recordFailoverHealthCheck(storage, failureCheck(checkedAt), {
      config,
      force: index === 0,
      nowMs: Date.parse(checkedAt),
      source: "alarm",
    });
  }

  assert.equal(result?.status.consecutiveVpsFailures, FAILOVER_FAILURE_THRESHOLD);
  assert.equal(result?.status.desiredDnsTarget, "vercel");
  assert.equal(result?.status.activeDnsTarget, "vps");
  assert.equal(result?.status.controllerState, "failed_over_vercel");
});

test("bounded health history keeps only the latest safe check rows", async () => {
  const storage = new MemoryStorage();

  for (let index = 0; index < FAILOVER_HISTORY_LIMIT + 5; index += 1) {
    const checkedAt = new Date(Date.parse("2026-07-22T04:00:00.000Z") + index * 15_000).toISOString();
    await recordFailoverHealthCheck(storage, index % 2 === 0 ? reachableCheck(checkedAt) : failureCheck(checkedAt), {
      config,
      force: index === 0,
      nowMs: Date.parse(checkedAt),
      source: "alarm",
    });
  }

  const history = await readFailoverCheckHistory(storage);

  assert.equal(history.length, FAILOVER_HISTORY_LIMIT);
  assert.equal(history[0].checkedAt, "2026-07-22T04:06:00.000Z");
  assert.equal(history.at(-1).checkedAt, "2026-07-22T04:01:15.000Z");
  assertNoSensitiveFailoverState(history);
});

test("DNS action records are idempotent by action key", async () => {
  const storage = new MemoryStorage();
  const changedAt = "2026-07-22T04:10:00.000Z";

  const firstAction = await recordFailoverDnsAction(storage, {
    idempotencyKey: "dns-action-1",
    changedAt,
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vercel",
    reason: "failover_to_vercel",
  }, {
    config,
    nowMs: Date.parse(changedAt),
  });
  const duplicateAction = await recordFailoverDnsAction(storage, {
    idempotencyKey: "dns-action-1",
    changedAt: "2026-07-22T04:10:01.000Z",
    activeDnsTarget: "vps",
    desiredDnsTarget: "vps",
    reason: "failback_to_vps",
  }, {
    config,
    nowMs: Date.parse("2026-07-22T04:10:01.000Z"),
  });

  assert.equal(firstAction.duplicate, false);
  assert.equal(firstAction.status.activeDnsTarget, "vercel");
  assert.equal(firstAction.status.lastDnsChangeReason, "failover_to_vercel");
  assert.equal(duplicateAction.duplicate, true);
  assert.equal(duplicateAction.status.activeDnsTarget, "vercel");
  assert.equal(duplicateAction.status.lastDnsChangeReason, "failover_to_vercel");
});

test("DNS history records readback decisions and manual DNS actions safely", async () => {
  const storage = new MemoryStorage();
  const noOpAt = "2026-07-22T04:09:00.000Z";
  const driftAt = "2026-07-22T04:09:15.000Z";
  const errorAt = "2026-07-22T04:09:30.000Z";
  const failureStartAt = "2026-07-22T04:09:45.000Z";
  const pendingFailoverAt = "2026-07-22T04:10:30.000Z";
  const manualAt = "2026-07-22T04:10:45.000Z";

  await recordFailoverDnsReadback(storage, {
    checkedAt: noOpAt,
    ok: true,
    apexTarget: "vps",
    wwwTarget: "vps",
  }, {
    config,
    nowMs: Date.parse(noOpAt),
  });
  await recordFailoverDnsReadback(storage, {
    checkedAt: driftAt,
    ok: true,
    apexTarget: "vercel",
    wwwTarget: "vps",
  }, {
    config,
    nowMs: Date.parse(driftAt),
  });
  await recordFailoverDnsReadback(storage, {
    checkedAt: errorAt,
    ok: false,
    error: "cloudflare_dns_api_error",
    apexTarget: "unknown",
    wwwTarget: "unknown",
    cloudflareApiToken: "do-not-leak-token",
  }, {
    config,
    nowMs: Date.parse(errorAt),
  });

  for (let index = 0; index < FAILOVER_FAILURE_THRESHOLD; index += 1) {
    const checkedAt = new Date(Date.parse(failureStartAt) + index * 15_000).toISOString();
    await recordFailoverHealthCheck(storage, failureCheck(checkedAt), {
      config,
      force: index === 0,
      nowMs: Date.parse(checkedAt),
      source: "alarm",
    });
  }

  await recordFailoverDnsReadback(storage, {
    checkedAt: pendingFailoverAt,
    ok: true,
    apexTarget: "vps",
    wwwTarget: "vps",
  }, {
    config,
    nowMs: Date.parse(pendingFailoverAt),
  });
  await recordFailoverDnsAction(storage, {
    idempotencyKey: "manual-dns-history-1",
    changedAt: manualAt,
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vercel",
    reason: "manual_failover_to_vercel",
  }, {
    config,
    nowMs: Date.parse(manualAt),
  });

  const history = await readFailoverDnsHistory(storage);

  assert.deepEqual(history.map((row) => row.dnsAction), [
    "manual_failover_to_vercel",
    "failover_to_vercel",
    "dns_api_error",
    "drift_detected",
    "no_op",
  ]);
  assert.equal(history[0].result, "success");
  assert.equal(history[0].previousTarget, "vps");
  assert.equal(history[0].newTarget, "vercel");
  assert.equal(history[1].result, "skipped");
  assert.equal(history[1].skipReason, "dns_write_not_implemented_for_observation_only_controller");
  assert.equal(history[2].result, "failed");
  assert.equal(history[2].errorCode, "cloudflare_dns_api_error");
  assert.equal(history[3].skipReason, "actual_dns_target_differs_from_desired_target");
  assert.equal(history[4].result, "success");
  assert.equal(history[4].skipReason, "active_dns_target_matches_desired_target");
  assert.equal(JSON.stringify(history).includes("do-not-leak"), false);
  assertNoSensitiveFailoverState(history);
});

test("concurrent duplicate DNS actions persist one state transition", async () => {
  const storage = new MemoryStorage();
  const changedAt = "2026-07-22T04:11:00.000Z";

  const actions = await Promise.all([
    recordFailoverDnsAction(storage, {
      idempotencyKey: "dns-action-concurrent",
      changedAt,
      activeDnsTarget: "vercel",
      desiredDnsTarget: "vercel",
      reason: "failover_to_vercel",
    }, {
      config,
      nowMs: Date.parse(changedAt),
    }),
    recordFailoverDnsAction(storage, {
      idempotencyKey: "dns-action-concurrent",
      changedAt,
      activeDnsTarget: "vps",
      desiredDnsTarget: "vps",
      reason: "failback_to_vps",
    }, {
      config,
      nowMs: Date.parse(changedAt),
    }),
  ]);
  const duplicateCount = actions.filter((action) => action.duplicate).length;
  const status = await readFailoverStatus(storage, Date.parse("2026-07-22T04:11:01.000Z"), config);

  assert.equal(duplicateCount, 1);
  assert.equal(status.activeDnsTarget, "vercel");
  assert.equal(status.lastDnsChangeReason, "failover_to_vercel");
});

test("manual lock state is persisted by DNS state actions", async () => {
  const storage = new MemoryStorage();
  const changedAt = "2026-07-22T04:12:00.000Z";

  const locked = await recordFailoverDnsAction(storage, {
    idempotencyKey: "manual-lock-1",
    changedAt,
    activeDnsTarget: "vps",
    desiredDnsTarget: "vercel",
    reason: "manual_lock_enabled",
    manualLock: true,
  }, {
    config,
    nowMs: Date.parse(changedAt),
  });
  const status = await readFailoverStatus(storage, Date.parse("2026-07-22T04:12:01.000Z"), config);

  assert.equal(locked.status.manualLock, true);
  assert.equal(locked.status.controllerState, "manual_lock");
  assert.equal(status.manualLock, true);
  assert.equal(status.desiredDnsTarget, "vercel");
});

test("manual lock prevents automatic failback while health checks continue", async () => {
  const storage = new MemoryStorage();
  const changedAt = "2026-07-22T04:12:00.000Z";
  const healthyAt = "2026-07-22T04:12:15.000Z";

  await recordFailoverDnsAction(storage, {
    idempotencyKey: "manual-lock-vercel",
    changedAt,
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vercel",
    reason: "manual_lock_enabled",
    manualLock: true,
  }, {
    config,
    nowMs: Date.parse(changedAt),
  });

  const result = await recordFailoverHealthCheck(storage, reachableCheck(healthyAt), {
    config,
    nowMs: Date.parse(healthyAt),
    source: "alarm",
  });
  const history = await readFailoverCheckHistory(storage);

  assert.equal(result.checked, true);
  assert.equal(result.status.lastVpsReachable, true);
  assert.equal(result.status.manualLock, true);
  assert.equal(result.status.desiredDnsTarget, "vercel");
  assert.equal(result.status.controllerState, "manual_lock");
  assert.equal(history.length, 1);
});

test("manual failover audit events persist safe actor, target, reason, and result", async () => {
  const storage = new MemoryStorage();
  const eventAt = "2026-07-22T04:13:00.000Z";

  const result = await recordFailoverAuditEvent(storage, {
    id: "audit-1",
    idempotencyKey: "manual-action-1",
    createdAt: eventAt,
    actor: "Admin@Example.COM",
    action: "force_dns_to_vercel",
    previousTarget: "vps",
    newTarget: "vercel",
    reason: "Operator requested failover during VPS maintenance.",
    result: "success",
    message: "Cloudflare DNS verified on vercel.",
    manualLock: false,
  }, {
    nowMs: Date.parse(eventAt),
  });
  const history = await readFailoverAuditHistory(storage);

  assert.equal(result.auditEvent.actor, "admin@example.com");
  assert.equal(result.auditEvent.previousTarget, "vps");
  assert.equal(result.auditEvent.newTarget, "vercel");
  assert.equal(result.auditEvent.result, "success");
  assert.equal(history.length, 1);
  assert.deepEqual(history[0], result.auditEvent);
  assertNoSensitiveFailoverState(history);
});
