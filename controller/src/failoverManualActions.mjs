import { writeCloudflareFailoverDnsTarget } from "./failoverDnsReadback.mjs";
import {
  assertNoSensitiveFailoverState,
  readFailoverAuditHistory,
  readFailoverConfig,
  readFailoverStatus,
  recordFailoverAuditEvent,
  recordFailoverDnsAction,
  recordFailoverDnsReadback,
} from "./failoverState.mjs";
import {
  FAILOVER_STATUS_AUTH_SCHEME,
  FAILOVER_STATUS_SIGNATURE_HEADER,
  FAILOVER_STATUS_SIGNATURE_VERSION,
  FAILOVER_STATUS_TIMESTAMP_HEADER,
} from "./failoverStatusEndpoint.mjs";

export const FAILOVER_MANUAL_ACTION_SCHEMA_VERSION = "nutsnews.failover.manual_action.v1";
export const FAILOVER_MANUAL_ACTIONS = Object.freeze([
  "enable_manual_lock",
  "disable_manual_lock",
  "force_dns_to_vercel",
  "force_dns_to_vps",
]);
export const FAILOVER_MANUAL_ACTION_CONFIRMATIONS = Object.freeze({
  enable_manual_lock: "ENABLE MANUAL LOCK",
  disable_manual_lock: "DISABLE MANUAL LOCK",
  force_dns_to_vercel: "FAILOVER TO VERCEL",
  force_dns_to_vps: "FAILBACK TO VPS",
});
export const FAILOVER_ACTION_DEFAULT_SIGNATURE_TTL_SECONDS = 180;

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
  assertNoSensitiveFailoverState(body);

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

async function getManualActionSecret(env) {
  return getTextBinding(env.NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET);
}

function getManualActionSignatureTtlSeconds(env) {
  const parsed = Number(clean(env.NUTSNEWS_FAILOVER_ACTION_SIGNATURE_TTL_SECONDS));

  if (!Number.isInteger(parsed) || parsed < 30) {
    return FAILOVER_ACTION_DEFAULT_SIGNATURE_TTL_SECONDS;
  }

  return Math.min(parsed, 600);
}

function getSignedPath(request) {
  const url = new URL(request.url);

  return `${url.pathname}${url.search}`;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
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

async function getSignaturePayload(request, timestamp, bodyText) {
  return [
    FAILOVER_STATUS_SIGNATURE_VERSION,
    request.method.toUpperCase(),
    getSignedPath(request),
    clean(timestamp),
    await sha256Hex(bodyText),
  ].join("\n");
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

export async function createFailoverActionSignature({ request, secret, timestamp, bodyText = "" }) {
  return `${FAILOVER_STATUS_SIGNATURE_VERSION}=${await hmacSha256Hex(
    secret,
    await getSignaturePayload(request, timestamp, bodyText),
  )}`;
}

export async function verifyFailoverActionRequest(request, env, bodyText, nowMs = Date.now()) {
  const secret = await getManualActionSecret(env);

  if (!secret) {
    return { ok: false, status: 503, error: "action_auth_not_configured" };
  }

  const timestamp = request.headers.get(FAILOVER_STATUS_TIMESTAMP_HEADER);
  const signature = parseSignature(request.headers.get(FAILOVER_STATUS_SIGNATURE_HEADER));

  if (!timestamp || !isTimestampFresh(timestamp, nowMs, getManualActionSignatureTtlSeconds(env))) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const expectedSignature = await hmacSha256Hex(
    secret,
    await getSignaturePayload(request, timestamp, bodyText),
  );

  return timingSafeHexEqual(signature, expectedSignature)
    ? { ok: true }
    : { ok: false, status: 401, error: "unauthorized" };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeAction(value) {
  return FAILOVER_MANUAL_ACTIONS.includes(value) ? value : null;
}

function safeDnsTarget(value) {
  return value === "vps" || value === "vercel" || value === "unknown" || value === "unmanaged"
    ? value
    : "unknown";
}

function safeEmail(value) {
  const candidate = clean(value).toLowerCase();

  return /^[a-z0-9._%+-]{1,96}@[a-z0-9.-]{1,96}\.[a-z]{2,24}$/.test(candidate)
    ? candidate
    : "";
}

function safeReason(value) {
  return clean(value).replace(/\s+/gu, " ").slice(0, 240);
}

function safeIdempotencyKey(value) {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

function expectedFromBody(value) {
  const row = isRecord(value) ? value : {};

  return Object.freeze({
    activeDnsTarget: safeDnsTarget(row.activeDnsTarget),
    actualApexDnsTarget: safeDnsTarget(row.actualApexDnsTarget),
    actualWwwDnsTarget: safeDnsTarget(row.actualWwwDnsTarget),
    statusGeneratedAt: clean(row.statusGeneratedAt).slice(0, 64),
  });
}

export function parseManualFailoverActionBody(value) {
  if (!isRecord(value)) {
    return { ok: false, status: 400, error: "invalid_json_body" };
  }

  const action = safeAction(value.action);
  if (!action) {
    return { ok: false, status: 400, error: "unsupported_manual_action" };
  }

  const confirmation = clean(value.confirmation).toUpperCase();
  if (confirmation !== FAILOVER_MANUAL_ACTION_CONFIRMATIONS[action]) {
    return { ok: false, status: 400, error: "confirmation_required" };
  }

  const actor = safeEmail(value.actor);
  if (!actor) {
    return { ok: false, status: 400, error: "actor_required" };
  }

  const reason = safeReason(value.reason);
  if (reason.length < 8) {
    return { ok: false, status: 400, error: "reason_required" };
  }

  const parsed = Object.freeze({
    schemaVersion: FAILOVER_MANUAL_ACTION_SCHEMA_VERSION,
    action,
    actor,
    reason,
    expected: expectedFromBody(value.expected),
    idempotencyKey: safeIdempotencyKey(value.idempotencyKey),
  });

  assertNoSensitiveFailoverState(parsed);

  return { ok: true, action: parsed };
}

function targetForAction(action) {
  if (action === "force_dns_to_vercel") {
    return "vercel";
  }

  if (action === "force_dns_to_vps") {
    return "vps";
  }

  return null;
}

function reasonForAction(action) {
  if (action === "force_dns_to_vercel") {
    return "manual_failover_to_vercel";
  }

  if (action === "force_dns_to_vps") {
    return "manual_failback_to_vps";
  }

  if (action === "enable_manual_lock") {
    return "manual_lock_enabled";
  }

  return "manual_lock_disabled";
}

function messageForDnsWriteFailure(writeResult) {
  if (writeResult.error === "stale_dns_state") {
    return "Current Cloudflare DNS no longer matches the dashboard snapshot. Refresh before retrying.";
  }

  if (writeResult.error === "dns_write_not_configured") {
    return "Cloudflare DNS write configuration is not available to the controller.";
  }

  if (writeResult.error === "dns_readback_failed") {
    return "Cloudflare DNS readback failed before the controller could write DNS.";
  }

  return "Cloudflare DNS update failed before the requested target was verified.";
}

function auditResultForWrite(writeResult) {
  return writeResult.error === "stale_dns_state" ? "refused" : "failed";
}

async function audit(storage, action, currentStatus, event, nowMs) {
  const auditResult = await recordFailoverAuditEvent(storage, {
    id: `${action.idempotencyKey}:audit:${event.result}`,
    idempotencyKey: action.idempotencyKey,
    createdAt: new Date(nowMs).toISOString(),
    actor: action.actor,
    action: action.action,
    previousTarget: currentStatus.activeDnsTarget,
    newTarget: event.newTarget,
    reason: action.reason,
    result: event.result,
    message: event.message,
    manualLock: event.manualLock ?? currentStatus.manualLock,
  }, { nowMs });

  return auditResult.auditEvent;
}

async function executeManualLock(storage, action, currentStatus, config, nowMs) {
  const manualLock = action.action === "enable_manual_lock";
  const stateResult = await recordFailoverDnsAction(storage, {
    idempotencyKey: action.idempotencyKey,
    changedAt: new Date(nowMs).toISOString(),
    activeDnsTarget: currentStatus.activeDnsTarget,
    desiredDnsTarget: currentStatus.desiredDnsTarget,
    reason: reasonForAction(action.action),
    manualLock,
  }, {
    config,
    nowMs,
  });
  const result = stateResult.duplicate ? "duplicate" : "success";
  const auditEvent = await audit(storage, action, currentStatus, {
    newTarget: stateResult.status.activeDnsTarget,
    result,
    message: manualLock
      ? "Automatic failback lock enabled. Health checks will continue."
      : "Automatic failback lock disabled. Health checks will continue.",
    manualLock,
  }, nowMs);

  return Object.freeze({
    ok: true,
    statusCode: 200,
    result,
    message: auditEvent.message,
    expectedDnsTarget: stateResult.status.desiredDnsTarget,
    activeDnsTarget: stateResult.status.activeDnsTarget,
    manualLock: stateResult.status.manualLock,
    status: stateResult.status,
    auditEvent,
  });
}

async function executeDnsAction(storage, env, action, currentStatus, config, options, nowMs) {
  const target = targetForAction(action.action);
  const writeResult = await writeCloudflareFailoverDnsTarget(env, {
    target,
    nowMs,
    fetchImpl: options.fetchImpl,
    expectedCurrent: {
      apexTarget: action.expected.actualApexDnsTarget,
      wwwTarget: action.expected.actualWwwDnsTarget,
    },
  });

  if (!writeResult.ok) {
    const message = messageForDnsWriteFailure(writeResult);
    const auditEvent = await audit(storage, action, currentStatus, {
      newTarget: target,
      result: auditResultForWrite(writeResult),
      message,
    }, nowMs);

    return Object.freeze({
      ok: false,
      statusCode: writeResult.statusCode ?? 502,
      error: writeResult.error,
      message,
      expectedDnsTarget: currentStatus.desiredDnsTarget,
      activeDnsTarget: currentStatus.activeDnsTarget,
      manualLock: currentStatus.manualLock,
      dnsReadback: writeResult.beforeReadback,
      auditEvent,
    });
  }

  if (writeResult.afterReadback) {
    await recordFailoverDnsReadback(storage, writeResult.afterReadback, {
      config,
      nowMs,
    });
  }

  const stateResult = await recordFailoverDnsAction(storage, {
    idempotencyKey: action.idempotencyKey,
    changedAt: new Date(nowMs).toISOString(),
    activeDnsTarget: target,
    desiredDnsTarget: target,
    reason: reasonForAction(action.action),
    manualLock: currentStatus.manualLock,
  }, {
    config,
    nowMs,
  });
  const result = stateResult.duplicate ? "duplicate" : "success";
  const auditEvent = await audit(storage, action, currentStatus, {
    newTarget: target,
    result,
    message: writeResult.changed
      ? `Cloudflare DNS verified on ${target}.`
      : `Cloudflare DNS already pointed to ${target}.`,
    manualLock: stateResult.status.manualLock,
  }, nowMs);

  return Object.freeze({
    ok: true,
    statusCode: 200,
    result,
    message: auditEvent.message,
    expectedDnsTarget: stateResult.status.desiredDnsTarget,
    activeDnsTarget: stateResult.status.activeDnsTarget,
    manualLock: stateResult.status.manualLock,
    status: stateResult.status,
    dnsReadback: writeResult.afterReadback,
    auditEvent,
  });
}

export async function executeManualFailoverAction(storage, env, body, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const parsed = parseManualFailoverActionBody(body);

  if (!parsed.ok) {
    return Object.freeze({
      ok: false,
      statusCode: parsed.status,
      error: parsed.error,
      message: parsed.error,
    });
  }

  const config = readFailoverConfig(env);
  const currentStatus = await readFailoverStatus(storage, nowMs, config);

  if (parsed.action.action === "enable_manual_lock" || parsed.action.action === "disable_manual_lock") {
    const result = await executeManualLock(storage, parsed.action, currentStatus, config, nowMs);

    assertNoSensitiveFailoverState(result);

    return result;
  }

  const result = await executeDnsAction(storage, env, parsed.action, currentStatus, config, options, nowMs);

  assertNoSensitiveFailoverState(result);

  return result;
}

export async function handleFailoverControllerActionRequest(request, env, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const url = new URL(request.url);
  const bodyText = request.method === "POST" ? await request.text() : "";
  const auth = await verifyFailoverActionRequest(request, env, bodyText, nowMs);

  if (!auth.ok) {
    return jsonResponse(
      { ok: false, error: auth.error },
      {
        status: auth.status,
        headers: {
          "WWW-Authenticate": `${FAILOVER_STATUS_AUTH_SCHEME} realm="failover-actions"`,
        },
      },
    );
  }

  if (url.pathname === "/actions/audit") {
    if (request.method !== "GET") {
      return methodNotAllowed("GET");
    }

    if (typeof options.readAuditSnapshot !== "function") {
      return jsonResponse({ ok: false, error: "audit_reader_unavailable" }, { status: 503 });
    }

    const snapshot = await options.readAuditSnapshot();

    return jsonResponse({
      ok: snapshot?.ok === true,
      auditEvents: Array.isArray(snapshot?.auditEvents) ? snapshot.auditEvents : [],
      error: snapshot?.ok === true ? null : snapshot?.error || "audit_unavailable",
    }, { status: snapshot?.statusCode || 200 });
  }

  if (url.pathname !== "/actions") {
    return jsonResponse({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  if (typeof options.performManualAction !== "function") {
    return jsonResponse({ ok: false, error: "action_runner_unavailable" }, { status: 503 });
  }

  let body;
  try {
    body = JSON.parse(bodyText || "{}");
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json_body" }, { status: 400 });
  }

  const result = await options.performManualAction(body);

  return jsonResponse(result, { status: result.statusCode || (result.ok ? 200 : 400) });
}

export async function readManualFailoverAuditSnapshot(storage) {
  const auditEvents = await readFailoverAuditHistory(storage);

  assertNoSensitiveFailoverState(auditEvents);

  return Object.freeze({
    ok: true,
    auditEvents,
  });
}
