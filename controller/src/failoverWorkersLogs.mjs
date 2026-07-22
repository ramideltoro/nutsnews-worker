const FAILOVER_DNS_DECISION_ACTIONS = Object.freeze([
  "no_op",
  "failover_to_vercel",
  "failback_to_vps",
  "manual_lock_skip",
  "dns_api_error",
  "drift_detected",
]);

function clean(value) {
  return String(value ?? "").trim();
}

function isTarget(value) {
  return value === "vps" || value === "vercel";
}

function sanitizeTarget(value, fallback = "unknown") {
  return isTarget(value) || value === "unknown" || value === "unmanaged" ? value : fallback;
}

function sanitizeDnsAction(value) {
  return FAILOVER_DNS_DECISION_ACTIONS.includes(value) ? value : "no_op";
}

function sanitizeLogCode(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : fallback;
}

function sanitizeIdentityValue(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/.test(candidate) ? candidate : fallback;
}

function sanitizeHealthStatus(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  return sanitizeLogCode(value, "unknown");
}

function sanitizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function sanitizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function hasDnsDrift(status) {
  return [status.actualApexDnsTarget, status.actualWwwDnsTarget]
    .filter((target) => target !== "unknown")
    .some((target) => target !== status.desiredDnsTarget);
}

function deriveDnsDecisionAction(status, dnsReadback) {
  if (status.manualLock) {
    return {
      dnsAction: "manual_lock_skip",
      dnsSkipReason: "manual_lock_enabled",
      dnsErrorCode: null,
    };
  }

  if (dnsReadback?.configured === false) {
    return {
      dnsAction: "no_op",
      dnsSkipReason: "dns_readback_not_configured",
      dnsErrorCode: null,
    };
  }

  if (dnsReadback?.configured === true && dnsReadback.ok !== true) {
    return {
      dnsAction: "dns_api_error",
      dnsSkipReason: "dns_readback_failed",
      dnsErrorCode: sanitizeLogCode(dnsReadback.error || "cloudflare_dns_api_error"),
    };
  }

  if (status.desiredDnsTarget !== status.activeDnsTarget && isTarget(status.desiredDnsTarget)) {
    return {
      dnsAction: status.desiredDnsTarget === "vercel" ? "failover_to_vercel" : "failback_to_vps",
      dnsSkipReason: "dns_write_not_implemented_for_observation_only_controller",
      dnsErrorCode: null,
    };
  }

  if (hasDnsDrift(status)) {
    return {
      dnsAction: "drift_detected",
      dnsSkipReason: "actual_dns_target_differs_from_desired_target",
      dnsErrorCode: null,
    };
  }

  return {
    dnsAction: "no_op",
    dnsSkipReason: "active_dns_target_matches_desired_target",
    dnsErrorCode: null,
  };
}

export function buildFailoverHealthCheckLogFields({ source, status }) {
  const fields = {
    failoverEventType: "health_check",
    checkedAt: status.lastVpsCheckAt,
    source: clean(source || "unknown").slice(0, 64),
    controllerState: sanitizeLogCode(status.controllerState),
    activeDnsTarget: sanitizeTarget(status.activeDnsTarget),
    desiredDnsTarget: sanitizeTarget(status.desiredDnsTarget),
    actualApexDnsTarget: sanitizeTarget(status.actualApexDnsTarget),
    actualWwwDnsTarget: sanitizeTarget(status.actualWwwDnsTarget),
    healthResult: sanitizeLogCode(status.lastHealthResult),
    vpsReachable: sanitizeBoolean(status.lastVpsReachable),
    vpsStatus: sanitizeHealthStatus(status.lastVpsStatus),
    vpsLatencyMs: sanitizeNumber(status.lastVpsLatencyMs),
    observedDeploymentTarget: sanitizeIdentityValue(status.observedDeploymentTarget),
    consecutiveVpsFailures: sanitizeNumber(status.consecutiveVpsFailures),
    failureThreshold: sanitizeNumber(status.failureThreshold),
    liveOriginDnsState: sanitizeLogCode(status.liveOriginReadiness?.dnsState),
  };

  assertNoSensitiveFailoverWorkersLog(fields);

  return Object.freeze(fields);
}

export function getFailoverHealthCheckLogLevel(status) {
  return status.lastVpsReachable ? "info" : "warn";
}

export function buildFailoverDnsDecisionLogFields({ source, status, dnsReadback }) {
  const decision = deriveDnsDecisionAction(status, dnsReadback);
  const fields = {
    failoverEventType: "dns_decision",
    checkedAt: status.generatedAt,
    source: clean(source || "unknown").slice(0, 64),
    controllerState: sanitizeLogCode(status.controllerState),
    activeDnsTarget: sanitizeTarget(status.activeDnsTarget),
    desiredDnsTarget: sanitizeTarget(status.desiredDnsTarget),
    actualApexDnsTarget: sanitizeTarget(status.actualApexDnsTarget),
    actualWwwDnsTarget: sanitizeTarget(status.actualWwwDnsTarget),
    healthResult: sanitizeLogCode(status.lastHealthResult),
    vpsReachable: sanitizeBoolean(status.lastVpsReachable),
    vpsLatencyMs: sanitizeNumber(status.lastVpsLatencyMs),
    consecutiveVpsFailures: sanitizeNumber(status.consecutiveVpsFailures),
    dnsAction: sanitizeDnsAction(decision.dnsAction),
    dnsWriteAttempted: false,
    dnsWriteSkipped: true,
    dnsSkipReason: sanitizeLogCode(decision.dnsSkipReason),
    dnsErrorCode: decision.dnsErrorCode,
    dnsReadbackConfigured: sanitizeBoolean(dnsReadback?.configured),
    dnsReadbackOk: sanitizeBoolean(dnsReadback?.ok),
    liveOriginDnsState: sanitizeLogCode(status.liveOriginReadiness?.dnsState),
  };

  assertNoSensitiveFailoverWorkersLog(fields);

  return Object.freeze(fields);
}

export function getFailoverDnsDecisionLogLevel(fields) {
  if (fields.dnsAction === "dns_api_error" || fields.dnsAction === "drift_detected") {
    return "warn";
  }

  if (fields.dnsAction === "failover_to_vercel" || fields.dnsAction === "failback_to_vps") {
    return "warn";
  }

  return "info";
}

export function assertNoSensitiveFailoverWorkersLog(value) {
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
      throw new Error(`Failover Workers Log contains forbidden sensitive token: ${forbidden}`);
    }
  }
}
