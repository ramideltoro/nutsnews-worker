export const FAILOVER_STATUS_SCHEMA_VERSION = "nutsnews.failover.status.v1";
export const FAILOVER_CONTROLLER_DURABLE_OBJECT_NAME = "production-failover-controller-state";
export const FAILOVER_STATUS_STORAGE_KEY = "failover.status.v1";
export const FAILOVER_HISTORY_STORAGE_KEY = "failover.check_history.v1";
export const FAILOVER_DNS_ACTION_KEYS_STORAGE_KEY = "failover.dns_action_keys.v1";

export const FAILOVER_DNS_TARGETS = Object.freeze(["vps", "vercel"]);
export const FAILOVER_DNS_TARGET_CLASSIFICATIONS = Object.freeze(["vps", "vercel", "unknown", "unmanaged"]);
export const FAILOVER_OBSERVED_DEPLOYMENT_TARGETS = Object.freeze([
  "production-vps",
  "vercel-production",
  "unknown",
  "unexpected",
]);
export const FAILOVER_HEALTH_RESULTS = Object.freeze([
  "unknown",
  "reachable",
  "http_status_unreachable",
  "network_error",
  "timeout",
  "deployment_target_mismatch",
  "invalid_readiness_response",
]);
export const FAILOVER_VPS_STATUS_CODES = Object.freeze([
  "dns_error",
  "tls_error",
  "connection_refused",
  "connection_reset",
  "network_error",
  "timeout",
  "deployment_target_mismatch",
  "invalid_readiness_response",
]);
export const FAILOVER_DNS_ACTIONS = Object.freeze([
  "none",
  "dns_readback",
  "failover_to_vercel",
  "failback_to_vps",
  "manual_failover_to_vercel",
  "manual_failback_to_vps",
  "manual_lock_enabled",
  "manual_lock_disabled",
  "reconcile_dns_to_vps",
  "reconcile_dns_to_vercel",
]);
export const FAILOVER_CONTROLLER_STATES = Object.freeze([
  "vps_primary_healthy",
  "vps_health_degraded",
  "failed_over_vercel",
  "failback_pending",
  "manual_lock",
  "dns_drift",
  "stale",
]);
export const FAILOVER_STALE_REASONS = Object.freeze([
  "status_update_overdue",
  "next_check_due_missed",
  "clock_skew_detected",
]);

export const FAILOVER_CHECK_INTERVAL_SECONDS = 15;
export const FAILOVER_FAILURE_THRESHOLD = 3;
export const FAILOVER_CONTROLLER_STALE_AFTER_SECONDS = 60;
export const FAILOVER_HISTORY_LIMIT = 20;

function clean(value) {
  return String(value ?? "").trim();
}

function readPositiveInteger(value, fallback, minimum = 1) {
  const parsed = Number(clean(value));

  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

function isOneOf(value, values) {
  return values.includes(value);
}

function toIsoDateTime(value, fallbackMs) {
  if (typeof value === "string") {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return new Date(fallbackMs).toISOString();
}

function nullableIsoDateTime(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Date.parse(String(value));

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeNumber(value, fallback, minimum = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizeDnsTarget(value, fallback = "vps") {
  return isOneOf(value, FAILOVER_DNS_TARGETS) ? value : fallback;
}

function normalizeDnsTargetClassification(value, fallback = "unknown") {
  return isOneOf(value, FAILOVER_DNS_TARGET_CLASSIFICATIONS) ? value : fallback;
}

export function normalizeObservedDeploymentTarget(value) {
  return isOneOf(value, FAILOVER_OBSERVED_DEPLOYMENT_TARGETS) ? value : "unexpected";
}

function normalizeHealthResult(value, fallback = "unknown") {
  return isOneOf(value, FAILOVER_HEALTH_RESULTS) ? value : fallback;
}

function normalizeDnsAction(value, fallback = "none") {
  return isOneOf(value, FAILOVER_DNS_ACTIONS) ? value : fallback;
}

function normalizeStaleReason(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return isOneOf(value, FAILOVER_STALE_REASONS) ? value : null;
}

function normalizeVpsStatus(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  return isOneOf(value, FAILOVER_VPS_STATUS_CODES) ? value : "network_error";
}

function normalizeControllerVersion(value, fallback) {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/.test(candidate) ? candidate : fallback;
}

export function readFailoverConfig(env = {}) {
  return Object.freeze({
    checkIntervalSeconds: readPositiveInteger(
      env.NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS,
      FAILOVER_CHECK_INTERVAL_SECONDS,
    ),
    failureThreshold: readPositiveInteger(
      env.NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES,
      FAILOVER_FAILURE_THRESHOLD,
    ),
    controllerVersion: normalizeControllerVersion(
      env.NUTSNEWS_FAILOVER_CONTROLLER_VERSION,
      "controller-failover-storage-v1",
    ),
    staleAfterSeconds: readPositiveInteger(
      env.NUTSNEWS_FAILOVER_CONTROLLER_STALE_AFTER_SECONDS,
      FAILOVER_CONTROLLER_STALE_AFTER_SECONDS,
    ),
  });
}

export function createDefaultFailoverStatus(nowMs = Date.now(), config = readFailoverConfig()) {
  const now = new Date(nowMs).toISOString();

  return Object.freeze({
    schemaVersion: FAILOVER_STATUS_SCHEMA_VERSION,
    generatedAt: now,
    controllerState: "vps_primary_healthy",
    activeDnsTarget: "vps",
    desiredDnsTarget: "vps",
    actualApexDnsTarget: "unknown",
    actualWwwDnsTarget: "unknown",
    observedDeploymentTarget: "unknown",
    lastHealthResult: "unknown",
    lastVpsCheckAt: null,
    lastVpsReachable: false,
    lastVpsStatus: null,
    lastVpsLatencyMs: null,
    consecutiveVpsFailures: 0,
    failureThreshold: config.failureThreshold,
    checkIntervalSeconds: config.checkIntervalSeconds,
    lastDnsChangeAt: null,
    lastDnsChangeReason: "none",
    manualLock: false,
    nextCheckDueAt: new Date(nowMs + config.checkIntervalSeconds * 1000).toISOString(),
    stale: false,
    staleReason: null,
    controllerVersion: config.controllerVersion,
  });
}

export function sanitizeFailoverStatus(value, nowMs = Date.now(), config = readFailoverConfig()) {
  if (!value || typeof value !== "object") {
    return createDefaultFailoverStatus(nowMs, config);
  }

  const generatedAt = toIsoDateTime(value.generatedAt, nowMs);
  const staleReason = normalizeStaleReason(value.staleReason);

  return Object.freeze({
    schemaVersion: FAILOVER_STATUS_SCHEMA_VERSION,
    generatedAt,
    controllerState: isOneOf(value.controllerState, FAILOVER_CONTROLLER_STATES)
      ? value.controllerState
      : "vps_primary_healthy",
    activeDnsTarget: normalizeDnsTarget(value.activeDnsTarget),
    desiredDnsTarget: normalizeDnsTarget(value.desiredDnsTarget),
    actualApexDnsTarget: normalizeDnsTargetClassification(value.actualApexDnsTarget),
    actualWwwDnsTarget: normalizeDnsTargetClassification(value.actualWwwDnsTarget),
    observedDeploymentTarget: normalizeObservedDeploymentTarget(value.observedDeploymentTarget ?? "unknown"),
    lastHealthResult: normalizeHealthResult(value.lastHealthResult),
    lastVpsCheckAt: nullableIsoDateTime(value.lastVpsCheckAt),
    lastVpsReachable: normalizeBoolean(value.lastVpsReachable),
    lastVpsStatus: normalizeVpsStatus(value.lastVpsStatus),
    lastVpsLatencyMs: value.lastVpsLatencyMs === null
      ? null
      : normalizeNumber(value.lastVpsLatencyMs, null),
    consecutiveVpsFailures: normalizeNumber(value.consecutiveVpsFailures, 0),
    failureThreshold: config.failureThreshold,
    checkIntervalSeconds: config.checkIntervalSeconds,
    lastDnsChangeAt: nullableIsoDateTime(value.lastDnsChangeAt),
    lastDnsChangeReason: normalizeDnsAction(value.lastDnsChangeReason),
    manualLock: normalizeBoolean(value.manualLock),
    nextCheckDueAt: nullableIsoDateTime(
      value.nextCheckDueAt,
      new Date(Date.parse(generatedAt) + config.checkIntervalSeconds * 1000).toISOString(),
    ),
    stale: normalizeBoolean(value.stale),
    staleReason,
    controllerVersion: normalizeControllerVersion(value.controllerVersion, config.controllerVersion),
  });
}

export function applyFailoverStatusFreshness(status, nowMs = Date.now(), config = readFailoverConfig()) {
  const staleAfterMs = config.staleAfterSeconds * 1000;
  const generatedAtMs = Date.parse(String(status.generatedAt || ""));
  const nextCheckDueMs = Date.parse(String(status.nextCheckDueAt || ""));
  let staleReason = status.stale ? normalizeStaleReason(status.staleReason) ?? "status_update_overdue" : null;

  if (Number.isFinite(generatedAtMs) && generatedAtMs - nowMs > staleAfterMs) {
    staleReason = "clock_skew_detected";
  } else if (Number.isFinite(generatedAtMs) && nowMs - generatedAtMs > staleAfterMs) {
    staleReason = "status_update_overdue";
  } else if (Number.isFinite(nextCheckDueMs) && nowMs - nextCheckDueMs > staleAfterMs) {
    staleReason = "next_check_due_missed";
  }

  if (!staleReason) {
    return status.stale || status.staleReason
      ? Object.freeze({
        ...status,
        stale: false,
        staleReason: null,
        controllerState: deriveControllerState({ ...status, stale: false, staleReason: null }),
      })
      : status;
  }

  return Object.freeze({
    ...status,
    stale: true,
    staleReason,
    controllerState: "stale",
  });
}

async function storageGet(storage, key) {
  return storage.get(key);
}

async function storagePut(storage, key, value) {
  await storage.put(key, value);
}

async function withStorageTransaction(storage, callback) {
  if (typeof storage.transaction === "function") {
    return storage.transaction(callback);
  }

  return callback(storage);
}

export async function readFailoverStatus(storage, nowMs = Date.now(), config = readFailoverConfig()) {
  return applyFailoverStatusFreshness(
    sanitizeFailoverStatus(await storageGet(storage, FAILOVER_STATUS_STORAGE_KEY), nowMs, config),
    nowMs,
    config,
  );
}

export async function hasStoredFailoverStatus(storage) {
  const status = await storageGet(storage, FAILOVER_STATUS_STORAGE_KEY);

  return status !== null && status !== undefined;
}

export async function readFailoverCheckHistory(storage) {
  const history = await storageGet(storage, FAILOVER_HISTORY_STORAGE_KEY);

  return Array.isArray(history) ? history.slice(0, FAILOVER_HISTORY_LIMIT) : [];
}

export function isFailoverCheckDue(status, nowMs = Date.now()) {
  const nextCheckDueMs = Date.parse(String(status.nextCheckDueAt ?? ""));

  return !Number.isFinite(nextCheckDueMs) || nextCheckDueMs <= nowMs;
}

function deriveControllerState(status) {
  if (status.stale) {
    return "stale";
  }

  if (status.manualLock) {
    return "manual_lock";
  }

  if (
    status.actualApexDnsTarget !== "unknown" &&
    status.actualWwwDnsTarget !== "unknown" &&
    (status.actualApexDnsTarget !== status.activeDnsTarget ||
      status.actualWwwDnsTarget !== status.activeDnsTarget)
  ) {
    return "dns_drift";
  }

  if (status.activeDnsTarget === "vercel" && status.desiredDnsTarget === "vps") {
    return "failback_pending";
  }

  if (status.activeDnsTarget === "vercel" || status.desiredDnsTarget === "vercel") {
    return "failed_over_vercel";
  }

  if (!status.lastVpsReachable && status.consecutiveVpsFailures > 0) {
    return "vps_health_degraded";
  }

  return "vps_primary_healthy";
}

function appendHistory(history, row) {
  return [row, ...history].slice(0, FAILOVER_HISTORY_LIMIT);
}

function createHistoryRow(status, check, source) {
  return Object.freeze({
    checkedAt: status.lastVpsCheckAt,
    healthResult: status.lastHealthResult,
    vpsReachable: status.lastVpsReachable,
    vpsStatus: status.lastVpsStatus,
    vpsLatencyMs: status.lastVpsLatencyMs,
    observedDeploymentTarget: status.observedDeploymentTarget,
    consecutiveVpsFailures: status.consecutiveVpsFailures,
    activeDnsTarget: status.activeDnsTarget,
    desiredDnsTarget: status.desiredDnsTarget,
    source: clean(source || check.source || "unknown").slice(0, 64),
  });
}

export function applyFailoverHealthCheck(currentStatus, check, nowMs, config = readFailoverConfig()) {
  const checkedAt = toIsoDateTime(check.checkedAt, nowMs);
  const lastHealthResult = normalizeHealthResult(check.healthResult);
  const lastVpsReachable = lastHealthResult === "reachable" && check.reachable !== false;
  const consecutiveVpsFailures = lastVpsReachable
    ? 0
    : currentStatus.consecutiveVpsFailures + 1;
  const desiredDnsTarget = currentStatus.manualLock
    ? currentStatus.desiredDnsTarget
    : lastVpsReachable
      ? "vps"
      : consecutiveVpsFailures >= config.failureThreshold
        ? "vercel"
        : currentStatus.desiredDnsTarget;
  const nextStatus = {
    ...currentStatus,
    generatedAt: checkedAt,
    desiredDnsTarget,
    observedDeploymentTarget: normalizeObservedDeploymentTarget(check.observedDeploymentTarget ?? "unknown"),
    lastHealthResult,
    lastVpsCheckAt: checkedAt,
    lastVpsReachable,
    lastVpsStatus: normalizeVpsStatus(check.status),
    lastVpsLatencyMs: check.latencyMs === null || check.latencyMs === undefined
      ? null
      : normalizeNumber(check.latencyMs, null),
    consecutiveVpsFailures,
    failureThreshold: config.failureThreshold,
    checkIntervalSeconds: config.checkIntervalSeconds,
    nextCheckDueAt: new Date(Date.parse(checkedAt) + config.checkIntervalSeconds * 1000).toISOString(),
    stale: false,
    staleReason: null,
    controllerVersion: config.controllerVersion,
  };

  return Object.freeze({
    ...nextStatus,
    controllerState: deriveControllerState(nextStatus),
  });
}

export async function recordFailoverHealthCheck(
  storage,
  check,
  { config = readFailoverConfig(), nowMs = Date.now(), force = false, source = check.source } = {},
) {
  return withStorageTransaction(storage, async (transaction) => {
    const storedStatus = await storageGet(transaction, FAILOVER_STATUS_STORAGE_KEY);
    const currentStatus = sanitizeFailoverStatus(storedStatus, nowMs, config);
    const statusExists = storedStatus !== null && storedStatus !== undefined;

    if (statusExists && !force && !isFailoverCheckDue(currentStatus, nowMs)) {
      return Object.freeze({
        checked: false,
        status: currentStatus,
        history: await readFailoverCheckHistory(transaction),
      });
    }

    const nextStatus = applyFailoverHealthCheck(currentStatus, check, nowMs, config);
    const history = appendHistory(
      await readFailoverCheckHistory(transaction),
      createHistoryRow(nextStatus, check, source),
    );

    await storagePut(transaction, FAILOVER_STATUS_STORAGE_KEY, nextStatus);
    await storagePut(transaction, FAILOVER_HISTORY_STORAGE_KEY, history);

    return Object.freeze({
      checked: true,
      status: nextStatus,
      history,
    });
  });
}

export async function recordFailoverDnsAction(
  storage,
  action,
  { config = readFailoverConfig(), nowMs = Date.now() } = {},
) {
  return withStorageTransaction(storage, async (transaction) => {
    const currentStatus = await readFailoverStatus(transaction, nowMs, config);
    const recentKeys = await storageGet(transaction, FAILOVER_DNS_ACTION_KEYS_STORAGE_KEY);
    const idempotencyKey = clean(action.idempotencyKey);
    const safeRecentKeys = Array.isArray(recentKeys) ? recentKeys.slice(0, FAILOVER_HISTORY_LIMIT) : [];

    if (idempotencyKey && safeRecentKeys.includes(idempotencyKey)) {
      return Object.freeze({
        duplicate: true,
        status: currentStatus,
        recentKeys: safeRecentKeys,
      });
    }

    const changedAt = toIsoDateTime(action.changedAt, nowMs);
    const nextStatus = {
      ...currentStatus,
      generatedAt: changedAt,
      activeDnsTarget: normalizeDnsTarget(action.activeDnsTarget, currentStatus.activeDnsTarget),
      desiredDnsTarget: normalizeDnsTarget(action.desiredDnsTarget, currentStatus.desiredDnsTarget),
      lastDnsChangeAt: changedAt,
      lastDnsChangeReason: normalizeDnsAction(action.reason),
      manualLock: normalizeBoolean(action.manualLock, currentStatus.manualLock),
      controllerVersion: config.controllerVersion,
    };
    const derivedStatus = Object.freeze({
      ...nextStatus,
      controllerState: deriveControllerState(nextStatus),
    });
    const nextRecentKeys = idempotencyKey
      ? [idempotencyKey, ...safeRecentKeys].slice(0, FAILOVER_HISTORY_LIMIT)
      : safeRecentKeys;

    await storagePut(transaction, FAILOVER_STATUS_STORAGE_KEY, derivedStatus);
    await storagePut(transaction, FAILOVER_DNS_ACTION_KEYS_STORAGE_KEY, nextRecentKeys);

    return Object.freeze({
      duplicate: false,
      status: derivedStatus,
      recentKeys: nextRecentKeys,
    });
  });
}

export function assertNoSensitiveFailoverState(value) {
  const serialized = JSON.stringify(value);

  for (const forbidden of [
    "cloudflareApiToken",
    "dnsProviderToken",
    "readinessRequestHeaders",
    "originIp",
    "vpsOriginIp",
    "authorization",
    "bearer ",
    "x-vercel-protection-bypass",
  ]) {
    if (serialized.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`Failover state contains forbidden sensitive token: ${forbidden}`);
    }
  }
}
