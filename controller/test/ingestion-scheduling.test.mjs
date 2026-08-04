import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIngestionSchedulingStatus,
  handleIngestionSchedulingStatusRequest,
  readIngestionSchedulingPolicy,
  runIngestionSchedulingCycle,
} from "../src/ingestionScheduling.mjs";

function wakeResult(overrides = {}) {
  return {
    bound: true,
    ok: true,
    checked: true,
    ...overrides,
  };
}

test("missing configuration fails closed with legacy scheduling disabled", () => {
  assert.deepEqual(readIngestionSchedulingPolicy({}), {
    enabled: false,
    configured: false,
    valid: false,
    source: "safe_default_disabled",
  });
});

test("explicit enabled and disabled values are normalized", () => {
  for (const value of ["true", "TRUE", "1", "on", "yes"]) {
    assert.equal(
      readIngestionSchedulingPolicy({ INGESTION_SCHEDULING_ENABLED: value }).enabled,
      true,
    );
  }

  for (const value of ["false", "FALSE", "0", "off", "no"]) {
    assert.equal(
      readIngestionSchedulingPolicy({ INGESTION_SCHEDULING_ENABLED: value }).enabled,
      false,
    );
  }
});

test("invalid configuration fails closed without echoing its value", () => {
  const env = { INGESTION_SCHEDULING_ENABLED: "private-invalid-value" };
  const status = buildIngestionSchedulingStatus(env);

  assert.equal(status.enabled, false);
  assert.equal(status.configurationValid, false);
  assert.equal(status.configurationSource, "invalid_safe_default_disabled");
  assert.equal(JSON.stringify(status).includes(env.INGESTION_SCHEDULING_ENABLED), false);
});

test("machine-readable status supports GET and HEAD without caching", async () => {
  const env = {
    INGESTION_SCHEDULING_ENABLED: "false",
    SHARD_COUNT: "3",
    SHARD_RUN_INTERVAL_MINUTES: "5",
  };
  const getResponse = handleIngestionSchedulingStatusRequest(
    new Request("https://controller.example/ingestion-scheduling/status"),
    env,
  );
  const headResponse = handleIngestionSchedulingStatusRequest(
    new Request("https://controller.example/ingestion-scheduling/status", {
      method: "HEAD",
    }),
    env,
  );

  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.headers.get("cache-control"), "no-store");
  const status = await getResponse.json();
  assert.equal(status.state, "disabled");
  assert.deepEqual(status.dispatchCadence, {
    activeShardCount: 3,
    shardRunIntervalMinutes: 5,
    fullCycleMinutes: 15,
  });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.headers.get("x-nutsnews-ingestion-scheduling"), "disabled");
  assert.equal(await headResponse.text(), "");
});

test("machine-readable status rejects mutating methods", async () => {
  const response = handleIngestionSchedulingStatusRequest(
    new Request("https://controller.example/ingestion-scheduling/status", {
      method: "POST",
    }),
    {},
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "method_not_allowed",
  });
});

test("status exposes only a validated bounded deployment identity", () => {
  const valid = buildIngestionSchedulingStatus({
    INGESTION_SCHEDULING_ENABLED: "false",
    NUTSNEWS_CONTROLLER_SOURCE_REVISION: "a".repeat(40),
    NUTSNEWS_CONTROLLER_DEPLOYMENT_CORRELATION: "worker-pipeline-12345-2",
    CF_VERSION_METADATA: { id: "97108b3d-1111-2222-3333-444444444444" },
  });
  const invalid = buildIngestionSchedulingStatus({
    INGESTION_SCHEDULING_ENABLED: "false",
    NUTSNEWS_CONTROLLER_SOURCE_REVISION: "private-invalid-revision",
    NUTSNEWS_CONTROLLER_DEPLOYMENT_CORRELATION: "private invalid correlation",
    CF_VERSION_METADATA: { id: "private invalid version" },
  });

  assert.deepEqual(valid.deploymentIdentity, {
    valid: true,
    sourceRevision: "a".repeat(40),
    correlation: "worker-pipeline-12345-2",
    cloudflareVersionId: "97108b3d-1111-2222-3333-444444444444",
  });
  assert.deepEqual(invalid.deploymentIdentity, {
    valid: false,
    sourceRevision: null,
    correlation: null,
    cloudflareVersionId: null,
  });
  assert.equal(JSON.stringify(invalid).includes("private"), false);
});

test("enabled scheduled cycles wake failover before compatible shard dispatch", async () => {
  const events = [];
  const result = await runIngestionSchedulingCycle({
    env: { INGESTION_SCHEDULING_ENABLED: "true" },
    source: "scheduled_watchdog",
    shardIndex: 7,
    translationBacklogEnabled: true,
    wakeFailover: async () => {
      events.push("failover-wake");
      return wakeResult();
    },
    onFailoverWake: async () => {
      events.push("scheduled-started");
    },
    dispatchShard: async (mode) => {
      events.push(mode);
      return { mode, ok: true, status: 200 };
    },
  });

  assert.deepEqual(events, [
    "failover-wake",
    "scheduled-started",
    "refresh",
    "translate-backlog",
  ]);
  assert.equal(result.status, "dispatched");
  assert.equal(result.result.mode, "refresh");
  assert.equal(result.translationBacklogResult.mode, "translate-backlog");
});

test("disabled scheduled cycles wake failover and send no ingestion requests", async () => {
  const events = [];
  const result = await runIngestionSchedulingCycle({
    env: { INGESTION_SCHEDULING_ENABLED: "false" },
    source: "scheduled_watchdog",
    shardIndex: 4,
    wakeFailover: async () => {
      events.push("failover-wake");
      return wakeResult();
    },
    dispatchShard: async (mode) => {
      events.push(mode);
      throw new Error("disabled scheduling must never dispatch");
    },
  });

  assert.deepEqual(events, ["failover-wake"]);
  assert.equal(result.status, "skipped_ingestion_disabled");
  assert.equal(result.result, null);
  assert.equal(result.translationBacklogResult, null);
});

test("disabled manual routes wake failover and send no shard or backlog request", async () => {
  const dispatched = [];
  const result = await runIngestionSchedulingCycle({
    env: { INGESTION_SCHEDULING_ENABLED: "false" },
    source: "manual_fetch",
    shardIndex: 3,
    requestedMode: "translate-backlog",
    wakeFailover: async () => wakeResult(),
    dispatchShard: async (mode) => {
      dispatched.push(mode);
    },
  });

  assert.deepEqual(dispatched, []);
  assert.equal(result.status, "skipped_ingestion_disabled");
  assert.equal(result.requestedMode, "translate-backlog");
});

test("explicit manual backlog mode remains one compatible dispatch when enabled", async () => {
  const dispatched = [];
  const result = await runIngestionSchedulingCycle({
    env: { INGESTION_SCHEDULING_ENABLED: "true" },
    source: "manual_fetch",
    shardIndex: 12,
    requestedMode: "translate-backlog",
    wakeFailover: async () => wakeResult(),
    dispatchShard: async (mode) => {
      dispatched.push(mode);
      return { mode, ok: true, status: 200 };
    },
  });

  assert.deepEqual(dispatched, ["translate-backlog"]);
  assert.equal(result.translationBacklogResult, null);
});

test("failover degradation is retained while disabled ingestion stays stopped", async () => {
  let dispatchCount = 0;
  const result = await runIngestionSchedulingCycle({
    env: { INGESTION_SCHEDULING_ENABLED: "false" },
    source: "scheduled_watchdog",
    shardIndex: 2,
    wakeFailover: async () => wakeResult({ ok: false, checked: false }),
    dispatchShard: async () => {
      dispatchCount += 1;
    },
  });

  assert.equal(dispatchCount, 0);
  assert.equal(result.failoverWake.ok, false);
  assert.equal(result.failoverWake.checked, false);
  assert.equal(result.scheduling.disabledEffects.failoverWakeEnabled, true);
  assert.equal(result.scheduling.disabledEffects.failoverAlertsEnabled, true);
});

test("rollback from disabled to enabled is a configuration-only transition", () => {
  const disabled = buildIngestionSchedulingStatus({
    INGESTION_SCHEDULING_ENABLED: "false",
  });
  const restored = buildIngestionSchedulingStatus({
    INGESTION_SCHEDULING_ENABLED: "true",
  });

  assert.equal(disabled.state, "disabled");
  assert.equal(disabled.disabledEffects.failoverActionsEnabled, true);
  assert.equal(disabled.disabledEffects.durableObjectAlarmsEnabled, true);
  assert.equal(restored.state, "enabled");
  assert.equal(restored.disabledEffects.shardRefreshDispatchEnabled, true);
  assert.equal(restored.disabledEffects.translationBacklogDispatchEnabled, true);
});
