import {
  FAILOVER_DNS_HISTORY_ACTIONS,
  FAILOVER_DNS_HISTORY_RESULTS,
  FAILOVER_DNS_TARGET_CLASSIFICATIONS,
  FAILOVER_HEALTH_RESULTS,
  FAILOVER_HISTORY_LIMIT,
  FAILOVER_OBSERVED_DEPLOYMENT_TARGETS,
  FAILOVER_VPS_STATUS_CODES,
  applyFailoverStatusFreshness,
  assertNoSensitiveFailoverState,
  readFailoverConfig,
  sanitizeFailoverStatus,
} from "./failoverState.mjs";

export const FAILOVER_STATUS_SIGNATURE_HEADER = "X-NutsNews-Failover-Signature";
export const FAILOVER_STATUS_TIMESTAMP_HEADER = "X-NutsNews-Failover-Timestamp";
export const FAILOVER_STATUS_AUTH_SCHEME = "NutsNews-HMAC-SHA256";
export const FAILOVER_STATUS_SIGNATURE_VERSION = "v1";
export const FAILOVER_STATUS_DEFAULT_SIGNATURE_TTL_SECONDS = 300;

const encoder = new TextEncoder();

function clean(value) {
  return String(value ?? "").trim();
}

function noStoreHeaders(extra = {}) {
  return {
    "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function jsonResponse(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: noStoreHeaders(init.headers),
  });
}

function methodNotAllowed(allow) {
  return jsonResponse(
    { ok: false, error: "method_not_allowed" },
    {
      status: 405,
      headers: { Allow: allow },
    },
  );
}

async function getTextBinding(value) {
  if (value && typeof value === "object" && typeof value.get === "function") {
    return clean(await value.get());
  }

  return clean(value);
}

async function getFailoverStatusSecret(env) {
  return getTextBinding(env.NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET);
}

function getFailoverStatusSignatureTtlSeconds(env) {
  const parsed = Number(clean(env.NUTSNEWS_FAILOVER_STATUS_SIGNATURE_TTL_SECONDS));

  if (!Number.isInteger(parsed) || parsed < 30) {
    return FAILOVER_STATUS_DEFAULT_SIGNATURE_TTL_SECONDS;
  }

  return Math.min(parsed, 900);
}

function getSignedPath(request) {
  const url = new URL(request.url);

  return `${url.pathname}${url.search}`;
}

function getSignaturePayload(request, timestamp) {
  return [
    FAILOVER_STATUS_SIGNATURE_VERSION,
    request.method.toUpperCase(),
    getSignedPath(request),
    clean(timestamp),
  ].join("\n");
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return toHex(signature);
}

function parseSignature(value) {
  const raw = clean(value);

  return raw.startsWith(`${FAILOVER_STATUS_SIGNATURE_VERSION}=`)
    ? raw.slice(`${FAILOVER_STATUS_SIGNATURE_VERSION}=`.length)
    : raw;
}

function hexToFixedBytes(value) {
  const normalized = clean(value).toLowerCase();
  const bytes = new Uint8Array(32);

  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    return { bytes, valid: false };
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }

  return { bytes, valid: true };
}

function timingSafeHexEqual(candidate, expected) {
  const candidateBytes = hexToFixedBytes(candidate);
  const expectedBytes = hexToFixedBytes(expected);
  let difference = candidateBytes.valid && expectedBytes.valid ? 0 : 1;

  for (let index = 0; index < expectedBytes.bytes.length; index += 1) {
    difference |= candidateBytes.bytes[index] ^ expectedBytes.bytes[index];
  }

  return difference === 0;
}

function isTimestampFresh(rawTimestamp, nowMs, ttlSeconds) {
  const timestampSeconds = Number(clean(rawTimestamp));

  if (!Number.isInteger(timestampSeconds)) {
    return false;
  }

  return Math.abs(nowMs - timestampSeconds * 1000) <= ttlSeconds * 1000;
}

export async function createFailoverStatusSignature({ request, secret, timestamp }) {
  return `${FAILOVER_STATUS_SIGNATURE_VERSION}=${await hmacSha256Hex(
    secret,
    getSignaturePayload(request, timestamp),
  )}`;
}

export async function verifyFailoverStatusRequest(request, env, nowMs = Date.now()) {
  const secret = await getFailoverStatusSecret(env);

  if (!secret) {
    return { ok: false, status: 503, error: "status_auth_not_configured" };
  }

  const timestamp = request.headers.get(FAILOVER_STATUS_TIMESTAMP_HEADER);
  const signature = parseSignature(request.headers.get(FAILOVER_STATUS_SIGNATURE_HEADER));

  if (!timestamp || !isTimestampFresh(timestamp, nowMs, getFailoverStatusSignatureTtlSeconds(env))) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const expectedSignature = await hmacSha256Hex(secret, getSignaturePayload(request, timestamp));

  return timingSafeHexEqual(signature, expectedSignature)
    ? { ok: true }
    : { ok: false, status: 401, error: "unauthorized" };
}

function getStatusMode(request) {
  const mode = clean(new URL(request.url).searchParams.get("mode") || "dashboard").toLowerCase();

  return mode === "dashboard" ? "dashboard" : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf(value, allowed) {
  return allowed.includes(value);
}

function nullableIsoDateTime(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Date.parse(String(value));

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeNumber(value, fallback, minimum = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeHistorySource(value) {
  const candidate = clean(value).toLowerCase();

  return /^[a-z][a-z0-9_:-]{1,63}$/.test(candidate) ? candidate : "unknown";
}

function normalizeHistoryCode(value) {
  const candidate = clean(value).toLowerCase();

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : null;
}

function normalizeHistoryTarget(value) {
  return isOneOf(value, FAILOVER_DNS_TARGET_CLASSIFICATIONS) ? value : "unknown";
}

function normalizeHistoryDnsAction(value) {
  return isOneOf(value, FAILOVER_DNS_HISTORY_ACTIONS) ? value : "no_op";
}

function normalizeHistoryDnsResult(value) {
  return isOneOf(value, FAILOVER_DNS_HISTORY_RESULTS) ? value : "unknown";
}

function normalizeHistoryHealthResult(value) {
  return isOneOf(value, FAILOVER_HEALTH_RESULTS) ? value : "unknown";
}

function normalizeHistoryObservedDeploymentTarget(value) {
  return isOneOf(value, FAILOVER_OBSERVED_DEPLOYMENT_TARGETS) ? value : "unexpected";
}

function normalizeHistoryVpsStatus(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  return isOneOf(value, FAILOVER_VPS_STATUS_CODES) ? value : "network_error";
}

function sanitizeHealthHistoryRow(value) {
  if (!isRecord(value)) {
    return null;
  }

  const checkedAt = nullableIsoDateTime(value.checkedAt);
  if (!checkedAt) {
    return null;
  }

  const healthResult = normalizeHistoryHealthResult(value.healthResult);
  const fallbackErrorCode = healthResult === "reachable" || healthResult === "unknown" ? null : healthResult;

  return Object.freeze({
    checkedAt,
    source: normalizeHistorySource(value.source),
    healthResult,
    vpsReachable: typeof value.vpsReachable === "boolean"
      ? value.vpsReachable
      : healthResult === "reachable",
    vpsStatus: normalizeHistoryVpsStatus(value.vpsStatus),
    vpsLatencyMs: value.vpsLatencyMs === null || value.vpsLatencyMs === undefined
      ? null
      : normalizeNumber(value.vpsLatencyMs, null),
    observedDeploymentTarget: normalizeHistoryObservedDeploymentTarget(value.observedDeploymentTarget),
    consecutiveVpsFailures: normalizeNumber(value.consecutiveVpsFailures, 0),
    activeDnsTarget: normalizeHistoryTarget(value.activeDnsTarget),
    desiredDnsTarget: normalizeHistoryTarget(value.desiredDnsTarget),
    errorCode: normalizeHistoryCode(value.errorCode) ?? fallbackErrorCode,
  });
}

function sanitizeHealthHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => sanitizeHealthHistoryRow(row))
    .filter((row) => row !== null)
    .slice(0, FAILOVER_HISTORY_LIMIT);
}

function sanitizeDnsHistoryRow(value) {
  if (!isRecord(value)) {
    return null;
  }

  const changedAt = nullableIsoDateTime(value.changedAt);
  if (!changedAt) {
    return null;
  }

  return Object.freeze({
    changedAt,
    dnsAction: normalizeHistoryDnsAction(value.dnsAction),
    previousTarget: normalizeHistoryTarget(value.previousTarget),
    newTarget: normalizeHistoryTarget(value.newTarget),
    activeDnsTarget: normalizeHistoryTarget(value.activeDnsTarget),
    desiredDnsTarget: normalizeHistoryTarget(value.desiredDnsTarget),
    actualApexDnsTarget: normalizeHistoryTarget(value.actualApexDnsTarget),
    actualWwwDnsTarget: normalizeHistoryTarget(value.actualWwwDnsTarget),
    result: normalizeHistoryDnsResult(value.result),
    skipReason: normalizeHistoryCode(value.skipReason),
    errorCode: normalizeHistoryCode(value.errorCode),
  });
}

function sanitizeDnsHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => sanitizeDnsHistoryRow(row))
    .filter((row) => row !== null)
    .slice(0, FAILOVER_HISTORY_LIMIT);
}

function toDashboardStatus(value, env, nowMs) {
  const config = readFailoverConfig(env);
  const status = applyFailoverStatusFreshness(
    sanitizeFailoverStatus(value, nowMs, config),
    nowMs,
    config,
  );

  assertNoSensitiveFailoverState(status);

  return status;
}

export async function handleFailoverControllerStatusRequest(request, env, options = {}) {
  if (request.method !== "GET") {
    return methodNotAllowed("GET");
  }

  const nowMs = options.nowMs ?? Date.now();
  const mode = getStatusMode(request);

  if (mode !== "dashboard") {
    return jsonResponse({ ok: false, error: "unsupported_status_mode" }, { status: 400 });
  }

  const auth = await verifyFailoverStatusRequest(request, env, nowMs);
  if (!auth.ok) {
    return jsonResponse(
      { ok: false, error: auth.error },
      {
        status: auth.status,
        headers: {
          "WWW-Authenticate": `${FAILOVER_STATUS_AUTH_SCHEME} realm="failover-status"`,
        },
      },
    );
  }

  const readStatusSnapshot = options.readStatusSnapshot;
  if (typeof readStatusSnapshot !== "function") {
    return jsonResponse({ ok: false, error: "status_reader_unavailable" }, { status: 503 });
  }

  const snapshot = await readStatusSnapshot();
  if (!snapshot?.ok) {
    return jsonResponse(
      {
        ok: false,
        error: snapshot?.error || "failover_state_unavailable",
      },
      { status: snapshot?.statusCode || 503 },
    );
  }
  const payload = Object.freeze({
    ...toDashboardStatus(snapshot.status, env, nowMs),
    healthHistory: sanitizeHealthHistory(snapshot.history),
    dnsHistory: sanitizeDnsHistory(snapshot.dnsHistory),
  });

  assertNoSensitiveFailoverState(payload);

  return Response.json(payload, {
    headers: noStoreHeaders({
      "X-NutsNews-Failover-Status-Mode": mode,
      "Vary": `${FAILOVER_STATUS_SIGNATURE_HEADER}, ${FAILOVER_STATUS_TIMESTAMP_HEADER}`,
    }),
  });
}

export function handleFailoverControllerHealthRequest(request, env) {
  if (request.method !== "GET") {
    return methodNotAllowed("GET");
  }

  const config = readFailoverConfig(env);

  return jsonResponse({
    ok: true,
    service: "nutsnews-controller",
    failoverStateBound: Boolean(env.FAILOVER_CONTROLLER_STATE),
    controllerVersion: config.controllerVersion,
  });
}
