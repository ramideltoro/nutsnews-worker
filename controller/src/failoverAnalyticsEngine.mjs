import { buildFailoverDnsDecisionLogFields } from "./failoverWorkersLogs.mjs";

export const FAILOVER_ANALYTICS_SCHEMA_VERSION = "nutsnews.failover.analytics.v1";
export const FAILOVER_ANALYTICS_DATASET = "nutsnews_failover_controller";

export const FAILOVER_ANALYTICS_BLOBS = Object.freeze([
  "schema_version",
  "event_type",
  "environment",
  "controller_version",
  "source",
  "controller_state",
  "active_dns_target",
  "desired_dns_target",
  "actual_apex_dns_target",
  "actual_www_dns_target",
  "health_result",
  "dns_action",
  "error_code",
  "observed_deployment_target",
  "live_origin_dns_state",
  "manual_lock",
  "vps_reachable",
]);

export const FAILOVER_ANALYTICS_DOUBLES = Object.freeze([
  "event_count",
  "vps_latency_ms",
  "vps_status_code",
  "consecutive_vps_failures",
  "failure_threshold",
  "vps_reachable",
  "dns_update_duration_ms",
  "dns_target_changed",
  "manual_lock",
  "has_vps_latency",
  "has_vps_status_code",
  "dns_readback_ok",
]);

const DNS_CHANGE_ACTION_PREFIXES = Object.freeze([
  "failover",
  "failback",
  "manual_failover",
  "manual_failback",
  "reconcile_dns",
]);

function clean(value) {
  return String(value ?? "").trim();
}

function sanitizeIdentityValue(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/.test(candidate) ? candidate : fallback;
}

function sanitizeSource(value) {
  const candidate = clean(value || "unknown").slice(0, 64);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,63}$/.test(candidate) ? candidate : "unknown";
}

function sanitizeLogCode(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : fallback;
}

function sanitizeTarget(value, fallback = "unknown") {
  return value === "vps" || value === "vercel" || value === "unknown" || value === "unmanaged"
    ? value
    : fallback;
}

function sanitizeBooleanDimension(value) {
  return typeof value === "boolean" ? String(value) : "unknown";
}

function booleanMeasure(value) {
  return value === true ? 1 : 0;
}

function sanitizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function sanitizeHttpStatus(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function sanitizeErrorCode(value) {
  if (value === null || value === undefined || value === "") {
    return "none";
  }

  return sanitizeLogCode(value, "unknown");
}

function getFailoverAnalyticsEnvironment(env = {}) {
  return sanitizeIdentityValue(env.NUTSNEWS_FAILOVER_ANALYTICS_ENVIRONMENT || "production", "production");
}

function getSamplingIndex(environment) {
  return `nutsnews-failover:${environment}`.slice(0, 96);
}

function isDnsTargetChangeAction(action) {
  return DNS_CHANGE_ACTION_PREFIXES.some((prefix) => action === prefix || action.startsWith(`${prefix}_`));
}

function createDataPoint(fields, measures) {
  const point = Object.freeze({
    blobs: Object.freeze([
      FAILOVER_ANALYTICS_SCHEMA_VERSION,
      fields.eventType,
      fields.environment,
      fields.controllerVersion,
      fields.source,
      fields.controllerState,
      fields.activeDnsTarget,
      fields.desiredDnsTarget,
      fields.actualApexDnsTarget,
      fields.actualWwwDnsTarget,
      fields.healthResult,
      fields.dnsAction,
      fields.errorCode,
      fields.observedDeploymentTarget,
      fields.liveOriginDnsState,
      fields.manualLock,
      fields.vpsReachable,
    ]),
    doubles: Object.freeze([
      1,
      measures.vpsLatencyMs,
      measures.vpsStatusCode,
      measures.consecutiveVpsFailures,
      measures.failureThreshold,
      measures.vpsReachable,
      measures.dnsUpdateDurationMs,
      measures.dnsTargetChanged,
      measures.manualLock,
      measures.hasVpsLatency,
      measures.hasVpsStatusCode,
      measures.dnsReadbackOk,
    ]),
    indexes: Object.freeze([getSamplingIndex(fields.environment)]),
  });

  assertNoSensitiveFailoverAnalytics(point);

  return point;
}

function buildCommonFields({ env, source, status, eventType, dnsAction, errorCode }) {
  return {
    eventType: sanitizeLogCode(eventType),
    environment: getFailoverAnalyticsEnvironment(env),
    controllerVersion: sanitizeIdentityValue(status.controllerVersion),
    source: sanitizeSource(source),
    controllerState: sanitizeLogCode(status.controllerState),
    activeDnsTarget: sanitizeTarget(status.activeDnsTarget),
    desiredDnsTarget: sanitizeTarget(status.desiredDnsTarget),
    actualApexDnsTarget: sanitizeTarget(status.actualApexDnsTarget),
    actualWwwDnsTarget: sanitizeTarget(status.actualWwwDnsTarget),
    healthResult: sanitizeLogCode(status.lastHealthResult),
    dnsAction: sanitizeLogCode(dnsAction, "none"),
    errorCode: sanitizeErrorCode(errorCode),
    observedDeploymentTarget: sanitizeIdentityValue(status.observedDeploymentTarget),
    liveOriginDnsState: sanitizeLogCode(status.liveOriginReadiness?.dnsState),
    manualLock: sanitizeBooleanDimension(status.manualLock),
    vpsReachable: sanitizeBooleanDimension(status.lastVpsReachable),
  };
}

function buildCommonMeasures({ status, dnsUpdateDurationMs = 0, dnsTargetChanged = false, dnsReadbackOk = null }) {
  const vpsLatencyMs = sanitizeNumber(status.lastVpsLatencyMs);
  const vpsStatusCode = sanitizeHttpStatus(status.lastVpsStatus);

  return {
    vpsLatencyMs: vpsLatencyMs ?? 0,
    vpsStatusCode: vpsStatusCode ?? 0,
    consecutiveVpsFailures: sanitizeNumber(status.consecutiveVpsFailures) ?? 0,
    failureThreshold: sanitizeNumber(status.failureThreshold) ?? 0,
    vpsReachable: booleanMeasure(status.lastVpsReachable),
    dnsUpdateDurationMs: sanitizeNumber(dnsUpdateDurationMs) ?? 0,
    dnsTargetChanged: dnsTargetChanged ? 1 : 0,
    manualLock: booleanMeasure(status.manualLock),
    hasVpsLatency: vpsLatencyMs === null ? 0 : 1,
    hasVpsStatusCode: vpsStatusCode === null ? 0 : 1,
    dnsReadbackOk: booleanMeasure(dnsReadbackOk),
  };
}

export function buildFailoverHealthCheckAnalyticsDataPoint({ env = {}, source, status, dnsReadback }) {
  const decision = buildFailoverDnsDecisionLogFields({ source, status, dnsReadback });
  const fields = buildCommonFields({
    env,
    source,
    status,
    eventType: "health_check",
    dnsAction: decision.dnsAction,
    errorCode: decision.dnsErrorCode,
  });
  const measures = buildCommonMeasures({
    status,
    dnsReadbackOk: decision.dnsReadbackOk,
  });

  return createDataPoint(fields, measures);
}

export function buildFailoverDnsTargetChangeAnalyticsDataPoint({
  env = {},
  source = "dns_action",
  status,
  action = {},
  durationMs = 0,
}) {
  const dnsAction = sanitizeLogCode(status.lastDnsChangeReason || action.reason, "none");
  const fields = buildCommonFields({
    env,
    source: action.source || source,
    status,
    eventType: "dns_target_change",
    dnsAction,
    errorCode: action.errorCode || action.error,
  });
  const measures = buildCommonMeasures({
    status,
    dnsUpdateDurationMs: action.durationMs ?? durationMs,
    dnsTargetChanged: isDnsTargetChangeAction(dnsAction),
  });

  return createDataPoint(fields, measures);
}

export function writeFailoverAnalyticsDataPoint(env, dataPoint) {
  const dataset = env?.FAILOVER_ANALYTICS;

  if (!dataset || typeof dataset.writeDataPoint !== "function") {
    return false;
  }

  try {
    assertNoSensitiveFailoverAnalytics(dataPoint);
    dataset.writeDataPoint(dataPoint);

    return true;
  } catch {
    return false;
  }
}

export function writeFailoverHealthCheckAnalytics(env, context) {
  try {
    return writeFailoverAnalyticsDataPoint(
      env,
      buildFailoverHealthCheckAnalyticsDataPoint({ env, ...context }),
    );
  } catch {
    return false;
  }
}

export function writeFailoverDnsTargetChangeAnalytics(env, context) {
  if (context?.duplicate) {
    return false;
  }

  try {
    return writeFailoverAnalyticsDataPoint(
      env,
      buildFailoverDnsTargetChangeAnalyticsDataPoint({ env, ...context }),
    );
  } catch {
    return false;
  }
}

export function assertNoSensitiveFailoverAnalytics(value) {
  const serialized = JSON.stringify(value).toLowerCase();

  for (const forbidden of [
    "authorization",
    "bearer ",
    "cookie",
    "set-cookie",
    "cloudflareapitoken",
    "dnsprovidertoken",
    "originip",
    "vpsoriginip",
    "cf-access-client-secret",
    "cf-access-token",
    "x-vercel-protection-bypass",
    "sentinel-cloudflare-dns-api-token",
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Failover Analytics Engine payload contains forbidden sensitive token: ${forbidden}`);
    }
  }
}
