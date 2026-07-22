import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyCloudflareDnsRecord,
  normalizeFailoverDnsTarget,
  readCloudflareFailoverDnsConfig,
  readCloudflareFailoverDnsState,
  writeCloudflareFailoverDnsTarget,
} from "../src/failoverDnsReadback.mjs";
import {
  assertNoSensitiveFailoverState,
  readFailoverConfig,
  readFailoverStatus,
  recordFailoverDnsReadback,
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

const nowMs = Date.parse("2026-07-22T04:40:00.000Z");
const apiToken = "sentinel-cloudflare-dns-api-token";
const baseEnv = {
  NUTSNEWS_DNS_FAILOVER_ZONE_ID: "sentinel-zone-id",
  NUTSNEWS_DNS_FAILOVER_DNS_API_TOKEN: apiToken,
  NUTSNEWS_DNS_FAILOVER_RECORDS_JSON: JSON.stringify([
    { id: "apex-record-id", name: "nutsnews.com", type: "CNAME" },
    { id: "www-record-id", name: "www.nutsnews.com", type: "CNAME" },
  ]),
  NUTSNEWS_DNS_FAILOVER_VPS_TARGETS: "vps.nutsnews.com",
  NUTSNEWS_DNS_FAILOVER_VERCEL_TARGETS: "cname.vercel-dns.com,76.76.21.21",
  NUTSNEWS_DNS_FAILOVER_DNS_API_TIMEOUT_MS: "5000",
};
const config = readFailoverConfig({
  NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS: "15",
  NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES: "3",
  NUTSNEWS_FAILOVER_CONTROLLER_VERSION: "test-controller-v1",
});

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

function fetchRecords(recordsById) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    const id = String(url).split("/").at(-1);
    const record = recordsById[id];

    if (!record) {
      return Response.json({ success: false, errors: [{ code: 1000, message: "not found" }] }, { status: 404 });
    }

    return Response.json(cloudflareRecord(record));
  };

  return { fetchImpl, requests };
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

      const body = JSON.parse(init.body);
      records.set(id, {
        ...record,
        content: body.content,
      });

      return Response.json({ success: true, result: { ...records.get(id), proxied: true } });
    }

    return Response.json(cloudflareRecord(record));
  };

  return { fetchImpl, requests, records };
}

test("normalizes DNS targets without relying on public DNS answers", () => {
  assert.equal(normalizeFailoverDnsTarget("CNAME.VERCEL-DNS.COM."), "cname.vercel-dns.com");
  assert.equal(normalizeFailoverDnsTarget(" vps.nutsnews.com "), "vps.nutsnews.com");
});

test("classifies Cloudflare DNS records against configured target sets", async () => {
  const dnsConfig = await readCloudflareFailoverDnsConfig(baseEnv);

  assert.equal(classifyCloudflareDnsRecord({ type: "CNAME", content: "vps.nutsnews.com." }, dnsConfig), "vps");
  assert.equal(classifyCloudflareDnsRecord({ type: "CNAME", content: "cname.vercel-dns.com." }, dnsConfig), "vercel");
  assert.equal(classifyCloudflareDnsRecord({ type: "A", content: "76.76.21.21" }, dnsConfig), "vercel");
  assert.equal(classifyCloudflareDnsRecord({ type: "TXT", content: "vps.nutsnews.com" }, dnsConfig), "unmanaged");
  assert.equal(classifyCloudflareDnsRecord({ type: "CNAME", content: "example.net" }, dnsConfig), "unknown");
});

test("reads and classifies apex and www as VPS targets through Cloudflare API record IDs", async () => {
  const { fetchImpl, requests } = fetchRecords({
    "apex-record-id": { name: "nutsnews.com", content: "vps.nutsnews.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "vps.nutsnews.com." },
  });
  const result = await readCloudflareFailoverDnsState(baseEnv, { fetchImpl, nowMs });

  assert.equal(result.ok, true);
  assert.equal(result.apexTarget, "vps");
  assert.equal(result.wwwTarget, "vps");
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => String(request.url).startsWith("https://api.cloudflare.com/client/v4/zones/sentinel-zone-id/dns_records/")));
  assert.ok(requests.every((request) => request.init.headers.Authorization === `Bearer ${apiToken}`));
  assertNoSensitiveFailoverState(result);
});

test("reads and classifies apex and www as Vercel targets", async () => {
  const { fetchImpl } = fetchRecords({
    "apex-record-id": { name: "nutsnews.com", content: "cname.vercel-dns.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "cname.vercel-dns.com." },
  });
  const result = await readCloudflareFailoverDnsState(baseEnv, { fetchImpl, nowMs });

  assert.equal(result.ok, true);
  assert.equal(result.apexTarget, "vercel");
  assert.equal(result.wwwTarget, "vercel");
  assertNoSensitiveFailoverState(result);
});

test("surfaces mixed apex and www DNS state independently", async () => {
  const { fetchImpl } = fetchRecords({
    "apex-record-id": { name: "nutsnews.com", content: "vps.nutsnews.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "cname.vercel-dns.com" },
  });
  const result = await readCloudflareFailoverDnsState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  const updated = await recordFailoverDnsReadback(storage, result, { config, nowMs });

  assert.equal(result.ok, true);
  assert.equal(result.apexTarget, "vps");
  assert.equal(result.wwwTarget, "vercel");
  assert.equal(updated.status.actualApexDnsTarget, "vps");
  assert.equal(updated.status.actualWwwDnsTarget, "vercel");
  assert.equal(updated.status.controllerState, "dns_drift");
});

test("reports unknown DNS targets without inventing a public DNS classification", async () => {
  const { fetchImpl } = fetchRecords({
    "apex-record-id": { name: "nutsnews.com", content: "unexpected.example.net" },
    "www-record-id": { name: "www.nutsnews.com", content: "unexpected.example.net" },
  });
  const result = await readCloudflareFailoverDnsState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  await recordFailoverDnsReadback(storage, result, { config, nowMs });
  const status = await readFailoverStatus(storage, nowMs, config);

  assert.equal(result.ok, true);
  assert.equal(result.apexTarget, "unknown");
  assert.equal(result.wwwTarget, "unknown");
  assert.equal(status.actualApexDnsTarget, "unknown");
  assert.equal(status.actualWwwDnsTarget, "unknown");
  assertNoSensitiveFailoverState({ result, status });
});

test("DNS API failures are surfaced safely without leaking tokens or record content", async () => {
  const fetchImpl = async () => Response.json(
    { success: false, errors: [{ code: 10000, message: "do not leak sentinel-cloudflare-dns-api-token" }] },
    { status: 403 },
  );
  const result = await readCloudflareFailoverDnsState(baseEnv, { fetchImpl, nowMs });
  const storage = new MemoryStorage();
  const updated = await recordFailoverDnsReadback(storage, result, { config, nowMs });

  assert.equal(result.ok, false);
  assert.equal(result.error, "cloudflare_dns_api_error");
  assert.equal(result.apexTarget, "unknown");
  assert.equal(result.wwwTarget, "unknown");
  assert.equal(updated.status.actualApexDnsTarget, "unknown");
  assert.equal(updated.status.actualWwwDnsTarget, "unknown");
  assert.equal(JSON.stringify(result).includes(apiToken), false);
  assert.equal(JSON.stringify(result).includes("do not leak"), false);
  assertNoSensitiveFailoverState({ result, status: updated.status });
});

test("writes and verifies both Cloudflare DNS records for a manual Vercel target", async () => {
  const { fetchImpl, requests } = mutableCloudflareRecords({
    "apex-record-id": { name: "nutsnews.com", content: "vps.nutsnews.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "vps.nutsnews.com" },
  });
  const result = await writeCloudflareFailoverDnsTarget(baseEnv, {
    target: "vercel",
    expectedCurrent: {
      apexTarget: "vps",
      wwwTarget: "vps",
    },
    fetchImpl,
    nowMs,
  });
  const patchRequests = requests.filter((request) => request.init.method === "PATCH");

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.afterReadback.apexTarget, "vercel");
  assert.equal(result.afterReadback.wwwTarget, "vercel");
  assert.equal(patchRequests.length, 2);
  assert.ok(patchRequests.every((request) => JSON.parse(request.init.body).content === "cname.vercel-dns.com"));
  assert.equal(JSON.stringify(result).includes(apiToken), false);
  assert.ok(result.writes.every((write) => !Object.hasOwn(write, "content")));
  assert.equal(Object.hasOwn(result.afterReadback.records.apex, "content"), false);
  assert.equal(Object.hasOwn(result.afterReadback.records.www, "content"), false);
  assertNoSensitiveFailoverState(result);
});

test("refuses DNS writes when fresh Cloudflare readback differs from expected dashboard state", async () => {
  const { fetchImpl, requests } = mutableCloudflareRecords({
    "apex-record-id": { name: "nutsnews.com", content: "cname.vercel-dns.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "cname.vercel-dns.com" },
  });
  const result = await writeCloudflareFailoverDnsTarget(baseEnv, {
    target: "vps",
    expectedCurrent: {
      apexTarget: "vps",
      wwwTarget: "vps",
    },
    fetchImpl,
    nowMs,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "stale_dns_state");
  assert.equal(result.statusCode, 409);
  assert.equal(requests.some((request) => request.init.method === "PATCH"), false);
  assertNoSensitiveFailoverState(result);
});

test("surfaces Cloudflare DNS write failures safely", async () => {
  const { fetchImpl } = mutableCloudflareRecords({
    "apex-record-id": { name: "nutsnews.com", content: "vps.nutsnews.com" },
    "www-record-id": { name: "www.nutsnews.com", content: "vps.nutsnews.com" },
  }, { failPatch: true });
  const result = await writeCloudflareFailoverDnsTarget(baseEnv, {
    target: "vercel",
    expectedCurrent: {
      apexTarget: "vps",
      wwwTarget: "vps",
    },
    fetchImpl,
    nowMs,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "cloudflare_dns_update_failed");
  assert.equal(result.statusCode, 502);
  assert.equal(JSON.stringify(result).includes(apiToken), false);
  assert.equal(JSON.stringify(result).includes("do not leak"), false);
  assertNoSensitiveFailoverState(result);
});
