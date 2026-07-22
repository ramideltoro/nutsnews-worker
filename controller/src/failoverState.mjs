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
export const FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS = Object.freeze([
  "vps",
  "vercel",
  "unknown",
  "unreachable",
]);
export const FAILOVER_LIVE_ORIGIN_DNS_STATES = Object.freeze([
  "unknown",
  "in_sync",
  "propagating",
  "mismatch",
  "partial",
  "unreachable",
]);
export const FAILOVER_LIVE_ORIGIN_CACHE_STATES = Object.freeze([
  "unknown",
  "fresh",
  "stale",
]);
export const FAILOVER_LIVE_ORIGIN_ERROR_CODES = Object.freeze([
  "timeout",
  "network_error",
  "http_status_unreachable",
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
export const FAILOVER_LIVE_ORIGIN_PROPAGATION_WINDOW_SECONDS = 300;
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

function normalizeLiveOrigin(value, fallback = "unknown") {
  return isOneOf(value, FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS) ? value : fallback;
}

function normalizeLiveOriginDnsState(value, fallback = "unknown") {
  return isOneOf(value, FAILOVER_LIVE_ORIGIN_DNS_STATES) ? value : fallback;
}

function normalizeLiveOriginCacheState(value, fallback = "unknown") {
  return isOneOf(value, FAILOVER_LIVE_ORIGIN_CACHE_STATES) ? value : fallback;
}

function normalizeLiveOriginError(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return isOneOf(value, FAILOVER_LIVE_ORIGIN_ERROR_CODES) ? value : "network_error";
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

function normalizeIdentityValue(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/.test(candidate) ? candidate : fallback;
}

function normalizeReadinessCode(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : fallback;
}

function normalizeHttpStatus(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function createDefaultLiveOriginHostReadiness(hostname, checkedAt) {
  return Object.freeze({
    checkedAt,
    hostname,
    ok: false,
    origin: "unknown",
    status: null,
    latencyMs: null,
    deploymentTarget: "unknown",
    sourceCommit: "unknown",
    buildId: "unknown",
    readinessCode: "unknown",
    runtimeEnv: "unknown",
    sideEffectsMode: "unknown",
    databaseProviderMode: "unknown",
    productionWritesPaused: null,
    cacheState: "unknown",
    error: null,
  });
}

function sanitizeLiveOriginHostReadiness(value, hostname, fallbackCheckedAt) {
  if (!value || typeof value !== "object") {
    return createDefaultLiveOriginHostReadiness(hostname, fallbackCheckedAt);
  }

  const checkedAt = toIsoDateTime(value.checkedAt, Date.parse(fallbackCheckedAt));

  return Object.freeze({
    checkedAt,
    hostname: normalizeIdentityValue(value.hostname, hostname),
    ok: normalizeBoolean(value.ok),
    origin: normalizeLiveOrigin(value.origin),
    status: normalizeHttpStatus(value.status),
    latencyMs: value.latencyMs === null || value.latencyMs === undefined
      ? null
      : normalizeNumber(value.latencyMs, null),
    deploymentTarget: normalizeIdentityValue(value.deploymentTarget),
    sourceCommit: normalizeIdentityValue(value.sourceCommit),
    buildId: normalizeIdentityValue(value.buildId),
    readinessCode: normalizeReadinessCode(value.readinessCode),
    runtimeEnv: normalizeIdentityValue(value.runtimeEnv),
    sideEffectsMode: normalizeReadinessCode(value.sideEffectsMode),
    databaseProviderMode: normalizeReadinessCode(value.databaseProviderMode),
    productionWritesPaused: typeof value.productionWritesPaused === "boolean"
      ? value.productionWritesPaused
      : null,
    cacheState: normalizeLiveOriginCacheState(value.cacheState),
    error: normalizeLiveOriginError(value.error),
  });
}

function createDefaultLiveOriginReadiness(nowMs = Date.now()) {
  const checkedAt = new Date(nowMs).toISOString();

  return Object.freeze({
    checkedAt,
    dnsState: "unknown",
    apex: createDefaultLiveOriginHostReadiness("nutsnews.com", checkedAt),
    www: createDefaultLiveOriginHostReadiness("www.nutsnews.com", checkedAt),
  });
}

function sanitizeLiveOriginReadiness(value, nowMs = Date.now()) {
  if (!value || typeof value !== "object") {
    return createDefaultLiveOriginReadiness(nowMs);
  }

  const checkedAt = toIsoDateTime(value.checkedAt, nowMs);

  return Object.freeze({
    checkedAt,
    dnsState: normalizeLiveOriginDnsState(value.dnsState),
    apex: sanitizeLiveOriginHostReadiness(value.apex, "nutsnews.com", checkedAt),
    www: sanitizeLiveOriginHostReadiness(value.www, "www.nutsnews.com", checkedAt),
  });
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
    liveOriginPropagationWindowSeconds: readPositiveInteger(
      env.NUTSNEWS_FAILOVER_LIVE_ORIGIN_PROPAGATION_WINDOW_SECONDS,
      FAILOVER_LIVE_ORIGIN_PROPAGATION_WINDOW_SECONDS,
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
    liveOriginReadiness: createDefaultLiveOriginReadiness(nowMs),
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
    liveOriginReadiness: sanitizeLiveOriginReadiness(value.liveOriginReadiness, nowMs),
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

function deriveActiveTargetFromActual(apexTarget, wwwTarget, fallback) {
  if (apexTarget === wwwTarget && isOneOf(apexTarget, FAILOVER_DNS_TARGETS)) {
    return apexTarget;
  }

  return fallback;
}

function deriveLiveOriginDnsState(status, liveOriginReadiness, nowMs, config) {
  const observations = [
    {
      actual: status.actualApexDnsTarget,
      observed: liveOriginReadiness.apex.origin,
    },
    {
      actual: status.actualWwwDnsTarget,
      observed: liveOriginReadiness.www.origin,
    },
  ];

  if (observations.some(({ observed }) => observed === "unreachable")) {
    return "unreachable";
  }

  const comparable = observations.filter(
    ({ actual, observed }) => isOneOf(actual, FAILOVER_DNS_TARGETS) && isOneOf(observed, FAILOVER_DNS_TARGETS),
  );

  if (comparable.length === 0) {
    return "unknown";
  }

  const hasMismatch = comparable.some(({ actual, observed }) => actual !== observed);

  if (!hasMismatch) {
    return comparable.length === observations.length ? "in_sync" : "partial";
  }

  const lastDnsChangeAtMs = Date.parse(String(status.lastDnsChangeAt || ""));
  const propagationWindowMs = config.liveOriginPropagationWindowSeconds * 1000;

  if (Number.isFinite(lastDnsChangeAtMs) && nowMs - lastDnsChangeAtMs <= propagationWindowMs) {
    return "propagating";
  }

  return "mismatch";
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
    [status.actualApexDnsTarget, status.actualWwwDnsTarget]
      .filter((target) => target !== "unknown")
      .some((target) => target !== status.desiredDnsTarget)
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

export async function recordFailoverDnsReadback(
  storage,
  readback,
  { config = readFailoverConfig(), nowMs = Date.now() } = {},
) {
  return withStorageTransaction(storage, async (transaction) => {
    const currentStatus = await readFailoverStatus(transaction, nowMs, config);
    const checkedAt = toIsoDateTime(readback.checkedAt, nowMs);
    const actualApexDnsTarget = normalizeDnsTargetClassification(readback.apexTarget);
    const actualWwwDnsTarget = normalizeDnsTargetClassification(readback.wwwTarget);
    const nextStatus = {
      ...currentStatus,
      generatedAt: checkedAt,
      activeDnsTarget: deriveActiveTargetFromActual(
        actualApexDnsTarget,
        actualWwwDnsTarget,
        currentStatus.activeDnsTarget,
      ),
      actualApexDnsTarget,
      actualWwwDnsTarget,
      stale: false,
      staleReason: null,
      controllerVersion: config.controllerVersion,
    };
    const derivedStatus = Object.freeze({
      ...nextStatus,
      controllerState: deriveControllerState(nextStatus),
    });

    await storagePut(transaction, FAILOVER_STATUS_STORAGE_KEY, derivedStatus);

    return Object.freeze({
      status: derivedStatus,
    });
  });
}

export async function recordFailoverLiveOriginReadiness(
  storage,
  liveOriginReadiness,
  { config = readFailoverConfig(), nowMs = Date.now() } = {},
) {
  return withStorageTransaction(storage, async (transaction) => {
    const currentStatus = await readFailoverStatus(transaction, nowMs, config);
    const checkedAt = toIsoDateTime(liveOriginReadiness.checkedAt, nowMs);
    const sanitizedReadiness = sanitizeLiveOriginReadiness(liveOriginReadiness, nowMs);
    const nextReadiness = Object.freeze({
      ...sanitizedReadiness,
      checkedAt,
      dnsState: deriveLiveOriginDnsState(currentStatus, sanitizedReadiness, nowMs, config),
    });
    const nextStatus = {
      ...currentStatus,
      generatedAt: checkedAt,
      liveOriginReadiness: nextReadiness,
      stale: false,
      staleReason: null,
      controllerVersion: config.controllerVersion,
    };
    const derivedStatus = Object.freeze({
      ...nextStatus,
      controllerState: deriveControllerState(nextStatus),
    });

    assertNoSensitiveFailoverState(derivedStatus);
    await storagePut(transaction, FAILOVER_STATUS_STORAGE_KEY, derivedStatus);

    return Object.freeze({
      status: derivedStatus,
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
    "cookie",
    "set-cookie",
    "cf-access-client-secret",
    "cf-access-token",
    "x-vercel-protection-bypass",
  ]) {
    if (serialized.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`Failover state contains forbidden sensitive token: ${forbidden}`);
    }
  }
}
