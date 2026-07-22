import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAILOVER_MANUAL_ACTION_CONFIRMATIONS,
  createFailoverActionSignature,
  executeManualFailoverAction,
  handleFailoverControllerActionRequest,
} from "../src/failoverManualActions.mjs";
import {
  FAILOVER_STATUS_SIGNATURE_HEADER,
  FAILOVER_STATUS_TIMESTAMP_HEADER,
} from "../src/failoverStatusEndpoint.mjs";
import {
  assertNoSensitiveFailoverState,
  readFailoverAuditHistory,
  readFailoverConfig,
  readFailoverStatus,
} from "../src/failoverState.mjs";

class MemoryStorage {
  constructor(seed) {
    this.store = seed ?? new Map();
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
}

const secret = "test-failover-action-hmac-secret";
const nowMs = Date.parse("2026-07-22T05:10:00.000Z");
const timestamp = String(Math.floor(nowMs / 1000));
const apiToken = "sentinel-cloudflare-dns-api-token";
const env = {
  NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET: secret,
  NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS: "15",
  NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES: "3",
  NUTSNEWS_FAILOVER_CONTROLLER_VERSION: "test-controller-v1",
  NUTSNEWS_DNS_FAILOVER_ZONE_ID: "sentinel-zone-id",
  NUTSNEWS_DNS_FAILOVER_DNS_API_TOKEN: apiToken,
  NUTSNEWS_DNS_FAILOVER_RECORDS_JSON: JSON.stringify([
    { id: "apex-record-id", name: "nutsnews.com", type: "CNAME" },
    { id: "www-record-id", name: "www.nutsnews.com", type: "CNAME" },
  ]),
  NUTSNEWS_DNS_FAILOVER_VPS_TARGETS: "vps.nutsnews.com",
  NUTSNEWS_DNS_FAILOVER_VERCEL_TARGETS: "cname.vercel-dns.com",
};
const config = readFailoverConfig(env);

function actionBody(overrides = {}) {
  return {
    action: "force_dns_to_vercel",
    actor: "admin@example.com",
    confirmation: FAILOVER_MANUAL_ACTION_CONFIRMATIONS.force_dns_to_vercel,
    reason: "Operator requested failover during VPS maintenance.",
    idempotencyKey: "manual-action-1",
    expected: {
      activeDnsTarget: "vps",
      actualApexDnsTarget: "vps",
      actualWwwDnsTarget: "vps",
      statusGeneratedAt: "2026-07-22T05:09:55.000Z",
    },
    ...overrides,
  };
}

async function signedRequest(path, body = null, method = body ? "POST" : "GET") {
  const bodyText = body ? JSON.stringify(body) : "";
  const request = new Request(`https://controller.nutsnews.workers.dev${path}`, {
    method,
    body: bodyText || undefined,
    headers: bodyText ? { "Content-Type": "application/json" } : undefined,
  });
  const signature = await createFailoverActionSignature({
    request,
    secret,
    timestamp,
    bodyText,
  });

  request.headers.set(FAILOVER_STATUS_TIMESTAMP_HEADER, timestamp);
  request.headers.set(FAILOVER_STATUS_SIGNATURE_HEADER, signature);

  return request;
}

function cloudflareRecord(record) {
  return {
    success: true,
    result: {
      type: "CNAME",
      name: record.name,
      content: record.content,
      proxied: true,
    },
  };
}

function mutableCloudflareRecords(recordsById, { failPatch = false } = {}) {
  const requests = [];
  const records = new Map(Object.entries(recordsById));
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, init });
    const id = String(url).split("/").at(-1);
    const record = records.get(id);

    if (!record) {
      return Response.json({ success: false, errors: [{ code: 1000, message: "not found" }] }, { status: 404 });
    }

    if (init.method === "PATCH") {
      if (failPatch) {
        return Response.json(
          { success: false, errors: [{ code: 10000, message: "do not leak sentinel-cloudflare-dns-api-token" }] },
          { status: 403 },
        );
      }

      records.set(id, {
        ...record,
        content: JSON.parse(init.body).content,
      });

      return Response.json({ success: true, result: { ...records.get(id), proxied: true } });
    }

    return Response.json(cloudflareRecord(record));
  };

  return { fetchImpl, requests };
}

test("manual failover action endpoint rejects unauthorized requests before running actions", async () => {
  let performed = false;
  const response = await handleFailoverControllerActionRequest(
    new Request("https://controller.nutsnews.workers.dev/actions", {
      method: "POST",
      body: JSON.stringify(actionBody()),
    }),
    env,
    {
      nowMs,
      performManualAction: async () => {
        performed = true;
        return { ok: true };
      },
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error, "unauthorized");
  assert.equal(performed, false);
});

test("manual failover action endpoint requires exact confirmation", async () => {
  const storage = new MemoryStorage();
  const response = await handleFailoverControllerActionRequest(
    await signedRequest("/actions", actionBody({ confirmation: "failover please" })),
    env,
    {
      nowMs,
      performManualAction: (body) => executeManualFailoverAction(storage, env, body, { nowMs }),
    },
  );
  const payload = await response.json();
  const auditHistory = await readFailoverAuditHistory(storage);

  assert.equal(response.status, 400);
  assert.equal(payload.error, "confirmation_required");
  assert.equal(auditHistory.length, 0);
});

test("manual failover refuses stale dashboard DNS state and audits the refusal", async () => {
  const storage = new MemoryStorage();
  const { fetchImpl, requests } = mutableCloudflareRecords({
    "apex-record-id": { name: "nutsnews.com", content: "cname.vercel-dns.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "cname.vercel-dns.com" },
  });
  const result = await executeManualFailoverAction(storage, env, actionBody(), { nowMs, fetchImpl });
  const auditHistory = await readFailoverAuditHistory(storage);

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 409);
  assert.equal(result.error, "stale_dns_state");
  assert.equal(requests.some((request) => request.init.method === "PATCH"), false);
  assert.equal(auditHistory.length, 1);
  assert.equal(auditHistory[0].result, "refused");
  assert.equal(auditHistory[0].newTarget, "vercel");
  assertNoSensitiveFailoverState({ result, auditHistory });
});

test("manual failover surfaces DNS write failure and audits the failure", async () => {
  const storage = new MemoryStorage();
  const { fetchImpl } = mutableCloudflareRecords({
    "apex-record-id": { name: "nutsnews.com", content: "vps.nutsnews.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "vps.nutsnews.com" },
  }, { failPatch: true });
  const result = await executeManualFailoverAction(storage, env, actionBody(), { nowMs, fetchImpl });
  const auditHistory = await readFailoverAuditHistory(storage);

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 502);
  assert.equal(result.error, "cloudflare_dns_update_failed");
  assert.equal(auditHistory.length, 1);
  assert.equal(auditHistory[0].result, "failed");
  assert.equal(JSON.stringify(result).includes(apiToken), false);
  assertNoSensitiveFailoverState({ result, auditHistory });
});

test("manual failover writes Cloudflare DNS, updates status, and audits who changed it", async () => {
  const storage = new MemoryStorage();
  const { fetchImpl, requests } = mutableCloudflareRecords({
    "apex-record-id": { name: "nutsnews.com", content: "vps.nutsnews.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "vps.nutsnews.com" },
  });
  const response = await handleFailoverControllerActionRequest(
    await signedRequest("/actions", actionBody()),
    env,
    {
      nowMs,
      performManualAction: (body) => executeManualFailoverAction(storage, env, body, { nowMs, fetchImpl }),
    },
  );
  const payload = await response.json();
  const status = await readFailoverStatus(storage, nowMs + 1000, config);
  const auditHistory = await readFailoverAuditHistory(storage);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.expectedDnsTarget, "vercel");
  assert.equal(status.activeDnsTarget, "vercel");
  assert.equal(status.desiredDnsTarget, "vercel");
  assert.equal(status.lastDnsChangeReason, "manual_failover_to_vercel");
  assert.equal(requests.filter((request) => request.init.method === "PATCH").length, 2);
  assert.equal(auditHistory.length, 1);
  assert.equal(auditHistory[0].actor, "admin@example.com");
  assert.equal(auditHistory[0].previousTarget, "vps");
  assert.equal(auditHistory[0].newTarget, "vercel");
  assert.equal(auditHistory[0].result, "success");
  assertNoSensitiveFailoverState({ payload, status, auditHistory });
});

test("manual lock action updates state, keeps health checks enabled, and writes audit", async () => {
  const storage = new MemoryStorage();
  const result = await executeManualFailoverAction(storage, env, actionBody({
    action: "enable_manual_lock",
    confirmation: FAILOVER_MANUAL_ACTION_CONFIRMATIONS.enable_manual_lock,
    idempotencyKey: "manual-lock-action-1",
  }), { nowMs });
  const status = await readFailoverStatus(storage, nowMs + 1000, config);
  const auditHistory = await readFailoverAuditHistory(storage);

  assert.equal(result.ok, true);
  assert.equal(status.manualLock, true);
  assert.equal(status.lastDnsChangeReason, "manual_lock_enabled");
  assert.equal(auditHistory.length, 1);
  assert.equal(auditHistory[0].action, "enable_manual_lock");
  assert.equal(auditHistory[0].message, "Automatic failback lock enabled. Health checks will continue.");
  assertNoSensitiveFailoverState({ result, auditHistory });
});

test("manual action audit endpoint returns protected audit history", async () => {
  const storage = new MemoryStorage();
  await executeManualFailoverAction(storage, env, actionBody({
    action: "enable_manual_lock",
    confirmation: FAILOVER_MANUAL_ACTION_CONFIRMATIONS.enable_manual_lock,
    idempotencyKey: "manual-lock-action-2",
  }), { nowMs });

  const response = await handleFailoverControllerActionRequest(
    await signedRequest("/actions/audit", null, "GET"),
    env,
    {
      nowMs,
      readAuditSnapshot: async () => ({ ok: true, auditEvents: await readFailoverAuditHistory(storage) }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.auditEvents.length, 1);
  assert.equal(payload.auditEvents[0].actor, "admin@example.com");
  assertNoSensitiveFailoverState(payload);
});
