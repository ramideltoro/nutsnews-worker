export const CLOUDFLARE_DNS_API_BASE_URL = "https://api.cloudflare.com/client/v4";
export const DEFAULT_DNS_READBACK_APEX_NAME = "nutsnews.com";
export const DEFAULT_DNS_READBACK_WWW_NAME = "www.nutsnews.com";
export const DEFAULT_DNS_READBACK_VPS_TARGET = "vps.nutsnews.com";
export const DEFAULT_DNS_READBACK_VERCEL_TARGET = "cname.vercel-dns.com";
export const DEFAULT_DNS_READBACK_TIMEOUT_MS = 5000;

function clean(value) {
  return String(value ?? "").trim();
}

async function getTextBinding(value) {
  if (value && typeof value === "object" && typeof value.get === "function") {
    return clean(await value.get());
  }

  return clean(value);
}

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(clean(value));

  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

export function normalizeFailoverDnsTarget(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\.+$/u, "");
}

function parseTargetList(value, fallback) {
  return new Set(parseTargetListValues(value, fallback));
}

function parseTargetListValues(value, fallback) {
  const targets = clean(value || fallback)
    .split(",")
    .map(normalizeFailoverDnsTarget)
    .filter(Boolean);

  return targets.length ? targets : [normalizeFailoverDnsTarget(fallback)];
}

function parseRecordsJson(value) {
  const raw = clean(value);

  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw);

  return Array.isArray(parsed) ? parsed : [];
}

function recordName(record) {
  return normalizeFailoverDnsTarget(record?.name);
}

function normalizeConfiguredRecord(record) {
  const id = clean(record?.id);
  const name = clean(record?.name);
  const type = clean(record?.type).toUpperCase();

  return id && name
    ? Object.freeze({
      id,
      name,
      type: type || "CNAME",
    })
    : null;
}

function findConfiguredRecord(records, hostname, fallbackIndex) {
  const normalizedHostname = normalizeFailoverDnsTarget(hostname);
  const exactMatch = records.find((record) => recordName(record) === normalizedHostname);

  return normalizeConfiguredRecord(exactMatch ?? records[fallbackIndex]);
}

export async function readCloudflareFailoverDnsConfig(env = {}) {
  const recordsJson = await getTextBinding(env.NUTSNEWS_DNS_FAILOVER_RECORDS_JSON);
  let records = [];
  let recordsError = null;

  try {
    records = parseRecordsJson(recordsJson);
  } catch {
    recordsError = "invalid_records_json";
  }

  const apexHostname = clean(env.NUTSNEWS_DNS_FAILOVER_APEX_HOSTNAME || DEFAULT_DNS_READBACK_APEX_NAME);
  const wwwHostname = clean(env.NUTSNEWS_DNS_FAILOVER_WWW_HOSTNAME || DEFAULT_DNS_READBACK_WWW_NAME);
  const zoneId = await getTextBinding(env.NUTSNEWS_DNS_FAILOVER_ZONE_ID);
  const apiToken = await getTextBinding(env.NUTSNEWS_DNS_FAILOVER_DNS_API_TOKEN);
  const apexRecord = findConfiguredRecord(records, apexHostname, 0);
  const wwwRecord = findConfiguredRecord(records, wwwHostname, 1);
  const missing = [];

  if (!zoneId) {
    missing.push("NUTSNEWS_DNS_FAILOVER_ZONE_ID");
  }
  if (!apiToken) {
    missing.push("NUTSNEWS_DNS_FAILOVER_DNS_API_TOKEN");
  }
  if (!recordsJson) {
    missing.push("NUTSNEWS_DNS_FAILOVER_RECORDS_JSON");
  }
  if (recordsError) {
    missing.push("NUTSNEWS_DNS_FAILOVER_RECORDS_JSON:invalid");
  }
  if (!apexRecord) {
    missing.push("NUTSNEWS_DNS_FAILOVER_RECORDS_JSON:apex");
  }
  if (!wwwRecord) {
    missing.push("NUTSNEWS_DNS_FAILOVER_RECORDS_JSON:www");
  }

  return Object.freeze({
    configured: missing.length === 0,
    missing,
    zoneId,
    apiToken,
    apexHostname,
    wwwHostname,
    apexRecord,
    wwwRecord,
    vpsTargets: parseTargetList(
      env.NUTSNEWS_DNS_FAILOVER_VPS_TARGETS || env.NUTSNEWS_DNS_FAILOVER_VPS_TARGET,
      DEFAULT_DNS_READBACK_VPS_TARGET,
    ),
    vpsTarget: parseTargetListValues(
      env.NUTSNEWS_DNS_FAILOVER_VPS_TARGET || env.NUTSNEWS_DNS_FAILOVER_VPS_TARGETS,
      DEFAULT_DNS_READBACK_VPS_TARGET,
    )[0],
    vercelTargets: parseTargetList(
      env.NUTSNEWS_DNS_FAILOVER_VERCEL_TARGETS || env.NUTSNEWS_DNS_FAILOVER_VERCEL_TARGET,
      DEFAULT_DNS_READBACK_VERCEL_TARGET,
    ),
    vercelTarget: parseTargetListValues(
      env.NUTSNEWS_DNS_FAILOVER_VERCEL_TARGET || env.NUTSNEWS_DNS_FAILOVER_VERCEL_TARGETS,
      DEFAULT_DNS_READBACK_VERCEL_TARGET,
    )[0],
    timeoutMs: readBoundedInteger(
      env.NUTSNEWS_DNS_FAILOVER_DNS_API_TIMEOUT_MS,
      DEFAULT_DNS_READBACK_TIMEOUT_MS,
      500,
      15000,
    ),
  });
}

export function classifyCloudflareDnsRecord(record, config) {
  const type = clean(record?.type).toUpperCase();

  if (!["A", "AAAA", "CNAME"].includes(type)) {
    return "unmanaged";
  }

  const content = normalizeFailoverDnsTarget(record?.content);

  if (config.vpsTargets.has(content)) {
    return "vps";
  }

  if (config.vercelTargets.has(content)) {
    return "vercel";
  }

  return "unknown";
}

function safeRecordSummary(configuredRecord, apiRecord, target, ok, status = null, error = null) {
  return Object.freeze({
    ok,
    name: clean(apiRecord?.name || configuredRecord?.name),
    type: clean(apiRecord?.type || configuredRecord?.type).toUpperCase() || null,
    proxied: typeof apiRecord?.proxied === "boolean" ? apiRecord.proxied : null,
    target,
    status,
    error,
  });
}

function sanitizeDnsReadbackError(error) {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }

  return "cloudflare_dns_api_error";
}

async function fetchCloudflareDnsRecord(config, configuredRecord, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = `${CLOUDFLARE_DNS_API_BASE_URL}/zones/${encodeURIComponent(config.zoneId)}/dns_records/${encodeURIComponent(configuredRecord.id)}`;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${config.apiToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        record: null,
        status: response.status,
        error: "cloudflare_dns_api_http_error",
      };
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.success !== true || !payload.result || typeof payload.result !== "object") {
      return {
        ok: false,
        record: null,
        status: response.status,
        error: "cloudflare_dns_api_response_error",
      };
    }

    return {
      ok: true,
      record: payload.result,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      record: null,
      status: null,
      error: sanitizeDnsReadbackError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function targetContentFor(config, target) {
  if (target === "vps") {
    return config.vpsTarget || DEFAULT_DNS_READBACK_VPS_TARGET;
  }

  if (target === "vercel") {
    return config.vercelTarget || DEFAULT_DNS_READBACK_VERCEL_TARGET;
  }

  return "";
}

function expectedTarget(value) {
  const normalized = clean(value).toLowerCase();

  return ["vps", "vercel", "unknown", "unmanaged"].includes(normalized) ? normalized : "unknown";
}

function expectedDnsStateMatches(readback, expectedCurrent = {}) {
  return (
    expectedTarget(expectedCurrent.apexTarget) === readback.apexTarget &&
    expectedTarget(expectedCurrent.wwwTarget) === readback.wwwTarget
  );
}

async function patchCloudflareDnsRecord(config, configuredRecord, target, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = `${CLOUDFLARE_DNS_API_BASE_URL}/zones/${encodeURIComponent(config.zoneId)}/dns_records/${encodeURIComponent(configuredRecord.id)}`;

  try {
    const response = await fetchImpl(url, {
      method: "PATCH",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: targetContentFor(config, target),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: "cloudflare_dns_update_http_error",
      };
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.success !== true) {
      return {
        ok: false,
        status: response.status,
        error: "cloudflare_dns_update_response_error",
      };
    }

    return {
      ok: true,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: sanitizeDnsReadbackError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function safeWriteSummary(record, result) {
  return Object.freeze({
    ok: result.ok === true,
    name: clean(record?.name),
    type: clean(record?.type).toUpperCase() || null,
    status: result.status ?? null,
    error: result.error ?? null,
  });
}

export async function readCloudflareFailoverDnsState(env = {}, options = {}) {
  const checkedAt = new Date(options.nowMs ?? Date.now()).toISOString();
  const config = await readCloudflareFailoverDnsConfig(env);
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!config.configured) {
    return Object.freeze({
      ok: false,
      configured: false,
      checkedAt,
      error: "dns_readback_not_configured",
      missing: config.missing,
      apexTarget: "unknown",
      wwwTarget: "unknown",
      records: {
        apex: safeRecordSummary(config.apexRecord, null, "unknown", false, null, "not_configured"),
        www: safeRecordSummary(config.wwwRecord, null, "unknown", false, null, "not_configured"),
      },
    });
  }

  const [apexResult, wwwResult] = await Promise.all([
    fetchCloudflareDnsRecord(config, config.apexRecord, fetchImpl),
    fetchCloudflareDnsRecord(config, config.wwwRecord, fetchImpl),
  ]);
  const apexTarget = apexResult.ok ? classifyCloudflareDnsRecord(apexResult.record, config) : "unknown";
  const wwwTarget = wwwResult.ok ? classifyCloudflareDnsRecord(wwwResult.record, config) : "unknown";
  const ok = apexResult.ok && wwwResult.ok;

  return Object.freeze({
    ok,
    configured: true,
    checkedAt,
    error: ok ? null : "cloudflare_dns_api_error",
    apexTarget,
    wwwTarget,
    records: {
      apex: safeRecordSummary(config.apexRecord, apexResult.record, apexTarget, apexResult.ok, apexResult.status, apexResult.error),
      www: safeRecordSummary(config.wwwRecord, wwwResult.record, wwwTarget, wwwResult.ok, wwwResult.status, wwwResult.error),
    },
  });
}

export async function writeCloudflareFailoverDnsTarget(env = {}, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const config = await readCloudflareFailoverDnsConfig(env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const target = options.target === "vps" || options.target === "vercel" ? options.target : null;

  if (!target) {
    return Object.freeze({
      ok: false,
      changed: false,
      error: "invalid_dns_target",
      statusCode: 400,
      beforeReadback: null,
      afterReadback: null,
      writes: [],
    });
  }

  const beforeReadback = await readCloudflareFailoverDnsState(env, { fetchImpl, nowMs });

  if (!config.configured) {
    return Object.freeze({
      ok: false,
      changed: false,
      error: "dns_write_not_configured",
      statusCode: 503,
      beforeReadback,
      afterReadback: null,
      writes: [],
    });
  }

  if (!beforeReadback.ok) {
    return Object.freeze({
      ok: false,
      changed: false,
      error: "dns_readback_failed",
      statusCode: 502,
      beforeReadback,
      afterReadback: null,
      writes: [],
    });
  }

  if (!expectedDnsStateMatches(beforeReadback, options.expectedCurrent)) {
    return Object.freeze({
      ok: false,
      changed: false,
      error: "stale_dns_state",
      statusCode: 409,
      beforeReadback,
      afterReadback: null,
      writes: [],
    });
  }

  if (beforeReadback.apexTarget === target && beforeReadback.wwwTarget === target) {
    return Object.freeze({
      ok: true,
      changed: false,
      error: null,
      statusCode: 200,
      beforeReadback,
      afterReadback: beforeReadback,
      writes: [],
    });
  }

  const [apexWrite, wwwWrite] = await Promise.all([
    patchCloudflareDnsRecord(config, config.apexRecord, target, fetchImpl),
    patchCloudflareDnsRecord(config, config.wwwRecord, target, fetchImpl),
  ]);
  const writes = Object.freeze([
    safeWriteSummary(config.apexRecord, apexWrite),
    safeWriteSummary(config.wwwRecord, wwwWrite),
  ]);

  if (!apexWrite.ok || !wwwWrite.ok) {
    return Object.freeze({
      ok: false,
      changed: true,
      error: "cloudflare_dns_update_failed",
      statusCode: 502,
      beforeReadback,
      afterReadback: null,
      writes,
    });
  }

  const afterReadback = await readCloudflareFailoverDnsState(env, { fetchImpl, nowMs });

  if (!afterReadback.ok || afterReadback.apexTarget !== target || afterReadback.wwwTarget !== target) {
    return Object.freeze({
      ok: false,
      changed: true,
      error: "dns_write_verification_failed",
      statusCode: 502,
      beforeReadback,
      afterReadback,
      writes,
    });
  }

  return Object.freeze({
    ok: true,
    changed: true,
    error: null,
    statusCode: 200,
    beforeReadback,
    afterReadback,
    writes,
  });
}
