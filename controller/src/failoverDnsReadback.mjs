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
  const targets = clean(value || fallback)
    .split(",")
    .map(normalizeFailoverDnsTarget)
    .filter(Boolean);

  return new Set(targets);
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
    vercelTargets: parseTargetList(
      env.NUTSNEWS_DNS_FAILOVER_VERCEL_TARGETS || env.NUTSNEWS_DNS_FAILOVER_VERCEL_TARGET,
      DEFAULT_DNS_READBACK_VERCEL_TARGET,
    ),
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
