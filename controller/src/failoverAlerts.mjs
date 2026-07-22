export const FAILOVER_ALERT_SCHEMA_VERSION = "nutsnews.failover.alert.v1";
export const FAILOVER_ALERT_STATE_STORAGE_KEY = "failover.alerts.v1";
export const DEFAULT_FAILOVER_ALERT_RATE_LIMIT_SECONDS = 3600;
export const DEFAULT_FAILOVER_STATUS_URL = "https://nutsnews-controller.nutsnews.workers.dev/status";

const FAILOVER_TO_VERCEL_REASONS = Object.freeze([
  "failover_to_vercel",
  "manual_failover_to_vercel",
  "reconcile_dns_to_vercel",
]);
const FAILBACK_TO_VPS_REASONS = Object.freeze([
  "failback_to_vps",
  "manual_failback_to_vps",
  "reconcile_dns_to_vps",
]);

function clean(value) {
  return String(value ?? "").trim();
}

async function resolveTextBinding(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value.get === "function") {
    return (await value.get()).trim();
  }

  return "";
}

function readPositiveInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(clean(value));

  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function sanitizeLogCode(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : fallback;
}

function sanitizeSource(value) {
  const candidate = clean(value || "unknown").slice(0, 64);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,63}$/.test(candidate) ? candidate : "unknown";
}

function sanitizeTarget(value, fallback = "unknown") {
  return value === "vps" || value === "vercel" || value === "unknown" || value === "unmanaged"
    ? value
    : fallback;
}

function sanitizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function sanitizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

function sanitizeHealthStatus(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  return sanitizeLogCode(value, "unknown");
}

function sanitizePublicHttpsUrl(value, fallback) {
  try {
    const url = new URL(clean(value || fallback));

    if (url.protocol !== "https:" || url.username || url.password) {
      return fallback;
    }

    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return fallback;
  }
}

function sanitizeWebhookUrl(value) {
  try {
    const url = new URL(clean(value));

    if (url.protocol !== "https:" || url.username || url.password) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function getDnsChangeReason(status, action) {
  return sanitizeLogCode(status.lastDnsChangeReason || action?.reason, "none");
}

function hasActualDnsDrift(status) {
  const desiredTarget = sanitizeTarget(status.desiredDnsTarget);

  if (desiredTarget !== "vps" && desiredTarget !== "vercel") {
    return false;
  }

  return [status.actualApexDnsTarget, status.actualWwwDnsTarget]
    .map((target) => sanitizeTarget(target))
    .filter((target) => target !== "unknown" && target !== "unmanaged")
    .some((target) => target !== desiredTarget);
}

function isPastPropagationWindow(status, nowMs, propagationWindowSeconds) {
  const lastDnsChangeAtMs = Date.parse(String(status.lastDnsChangeAt || ""));

  if (!Number.isFinite(lastDnsChangeAtMs)) {
    return true;
  }

  return nowMs - lastDnsChangeAtMs > propagationWindowSeconds * 1000;
}

function createAlert({
  alertType,
  severity,
  title,
  message,
  fingerprint,
  source,
  status,
  nowMs,
  statusUrl,
  rateLimitSeconds,
}) {
  const payload = {
    alertSchemaVersion: FAILOVER_ALERT_SCHEMA_VERSION,
    alertType: sanitizeLogCode(alertType),
    severity: sanitizeLogCode(severity),
    title: clean(title).slice(0, 160),
    message: clean(message).slice(0, 400),
    fingerprint: clean(fingerprint).slice(0, 160),
    detectedAt: new Date(nowMs).toISOString(),
    source: sanitizeSource(source),
    activeDnsTarget: sanitizeTarget(status.activeDnsTarget),
    desiredDnsTarget: sanitizeTarget(status.desiredDnsTarget),
    actualApexDnsTarget: sanitizeTarget(status.actualApexDnsTarget),
    actualWwwDnsTarget: sanitizeTarget(status.actualWwwDnsTarget),
    controllerState: sanitizeLogCode(status.controllerState),
    healthResult: sanitizeLogCode(status.lastHealthResult),
    vpsReachable: sanitizeBoolean(status.lastVpsReachable),
    vpsStatus: sanitizeHealthStatus(status.lastVpsStatus),
    vpsLatencyMs: sanitizeNumber(status.lastVpsLatencyMs),
    consecutiveVpsFailures: sanitizeNumber(status.consecutiveVpsFailures),
    failureThreshold: sanitizeNumber(status.failureThreshold),
    lastVpsCheckAt: status.lastVpsCheckAt ?? null,
    lastDnsChangeAt: status.lastDnsChangeAt ?? null,
    lastDnsChangeReason: sanitizeLogCode(status.lastDnsChangeReason, "none"),
    liveOriginDnsState: sanitizeLogCode(status.liveOriginReadiness?.dnsState),
    manualLock: sanitizeBoolean(status.manualLock),
    statusUrl,
    rateLimitSeconds,
  };

  assertNoSensitiveFailoverAlert(payload);

  return Object.freeze(payload);
}

export async function readFailoverAlertConfig(env = {}) {
  return Object.freeze({
    rateLimitSeconds: readPositiveInteger(
      env.NUTSNEWS_FAILOVER_ALERT_RATE_LIMIT_SECONDS,
      DEFAULT_FAILOVER_ALERT_RATE_LIMIT_SECONDS,
      60,
      86400,
    ),
    statusUrl: sanitizePublicHttpsUrl(
      env.NUTSNEWS_FAILOVER_STATUS_URL,
      DEFAULT_FAILOVER_STATUS_URL,
    ),
    webhookUrl: sanitizeWebhookUrl(await resolveTextBinding(env.NUTSNEWS_FAILOVER_ALERT_WEBHOOK_URL)),
    webhookToken: await resolveTextBinding(env.NUTSNEWS_FAILOVER_ALERT_WEBHOOK_TOKEN),
  });
}

export function buildFailoverAlertCandidates({
  source = "unknown",
  status,
  action = {},
  nowMs = Date.now(),
  alertConfig = {},
  failoverConfig = {},
}) {
  const rateLimitSeconds = readPositiveInteger(
    alertConfig.rateLimitSeconds,
    DEFAULT_FAILOVER_ALERT_RATE_LIMIT_SECONDS,
    60,
    86400,
  );
  const statusUrl = sanitizePublicHttpsUrl(alertConfig.statusUrl, DEFAULT_FAILOVER_STATUS_URL);
  const propagationWindowSeconds = readPositiveInteger(
    failoverConfig.liveOriginPropagationWindowSeconds,
    300,
    1,
    86400,
  );
  const reason = getDnsChangeReason(status, action);
  const alerts = [];

  if (status.activeDnsTarget === "vercel" && FAILOVER_TO_VERCEL_REASONS.includes(reason)) {
    alerts.push(createAlert({
      alertType: "failover_to_vercel",
      severity: "critical",
      title: "NutsNews DNS failed over to Vercel",
      message: "nutsnews.com is now serving from the Vercel failover target.",
      fingerprint: `failover_to_vercel:${status.lastDnsChangeAt || reason}`,
      source,
      status,
      nowMs,
      statusUrl,
      rateLimitSeconds,
    }));
  }

  if (status.activeDnsTarget === "vps" && FAILBACK_TO_VPS_REASONS.includes(reason)) {
    alerts.push(createAlert({
      alertType: "failback_to_vps",
      severity: "warning",
      title: "NutsNews DNS failed back to VPS",
      message: "nutsnews.com is now serving from the VPS primary target.",
      fingerprint: `failback_to_vps:${status.lastDnsChangeAt || reason}`,
      source,
      status,
      nowMs,
      statusUrl,
      rateLimitSeconds,
    }));
  }

  if (status.stale === true || status.controllerState === "stale") {
    alerts.push(createAlert({
      alertType: "stale_controller",
      severity: "critical",
      title: "NutsNews failover controller is stale",
      message: "No recent failover health check has completed within the expected window.",
      fingerprint: `stale_controller:${status.staleReason || "unknown"}`,
      source,
      status,
      nowMs,
      statusUrl,
      rateLimitSeconds,
    }));
  }

  if (
    hasActualDnsDrift(status) &&
    (
      status.liveOriginReadiness?.dnsState === "mismatch" ||
      isPastPropagationWindow(status, nowMs, propagationWindowSeconds)
    )
  ) {
    alerts.push(createAlert({
      alertType: "dns_drift",
      severity: "critical",
      title: "NutsNews DNS target drift detected",
      message: "Desired DNS target and observed Cloudflare DNS targets disagree outside the propagation window.",
      fingerprint: `dns_drift:${status.desiredDnsTarget}:${status.actualApexDnsTarget}:${status.actualWwwDnsTarget}`,
      source,
      status,
      nowMs,
      statusUrl,
      rateLimitSeconds,
    }));
  }

  if (status.manualLock === true || reason === "manual_lock_enabled") {
    alerts.push(createAlert({
      alertType: "manual_lock_enabled",
      severity: "warning",
      title: "NutsNews failover manual lock is enabled",
      message: "Automatic failback is disabled while manual lock remains enabled.",
      fingerprint: "manual_lock_enabled",
      source,
      status,
      nowMs,
      statusUrl,
      rateLimitSeconds,
    }));
  }

  return Object.freeze(alerts);
}

async function readAlertState(storage) {
  const value = await storage.get(FAILOVER_ALERT_STATE_STORAGE_KEY);

  if (!value || typeof value !== "object" || !value.sentByFingerprint || typeof value.sentByFingerprint !== "object") {
    return { sentByFingerprint: {} };
  }

  return {
    sentByFingerprint: { ...value.sentByFingerprint },
  };
}

async function writeAlertState(storage, state) {
  const entries = Object.entries(state.sentByFingerprint)
    .sort(([, left], [, right]) => Date.parse(String(right.sentAt || "")) - Date.parse(String(left.sentAt || "")))
    .slice(0, 100);

  await storage.put(FAILOVER_ALERT_STATE_STORAGE_KEY, {
    sentByFingerprint: Object.fromEntries(entries),
  });
}

function isRateLimited(state, alert, nowMs) {
  const previous = state.sentByFingerprint[alert.fingerprint];
  const previousSentAtMs = Date.parse(String(previous?.sentAt || ""));

  return Number.isFinite(previousSentAtMs) && nowMs - previousSentAtMs < alert.rateLimitSeconds * 1000;
}

export async function sendFailoverAlertWebhook(config, alert) {
  if (!config.webhookUrl) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  const headers = {
    "Content-Type": "application/json",
  };

  if (config.webhookToken) {
    headers.Authorization = `Bearer ${config.webhookToken}`;
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(alert),
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildFailoverAlertLogFields(alert, alertConfig = {}) {
  return {
    ...alert,
    alertDestination: alertConfig.webhookUrl ? "webhook_and_workers_logs" : "workers_logs",
  };
}

export async function deliverFailoverAlert(env, alert, alertConfig) {
  void env;
  console.warn(JSON.stringify({
    dt: new Date().toISOString(),
    level: "warn",
    service: "nutsnews-controller",
    environment: "production",
    event: "failover.alert",
    message: alert.title,
    ...buildFailoverAlertLogFields(alert, alertConfig),
  }));

  return sendFailoverAlertWebhook(alertConfig, alert);
}

export async function emitFailoverAlerts(
  env,
  storage,
  {
    source = "unknown",
    status,
    action = {},
    nowMs = Date.now(),
    failoverConfig = {},
  },
  { deliverAlert = deliverFailoverAlert } = {},
) {
  try {
    const alertConfig = await readFailoverAlertConfig(env);
    const candidates = buildFailoverAlertCandidates({
      source,
      status,
      action,
      nowMs,
      alertConfig,
      failoverConfig,
    });
    const state = await readAlertState(storage);
    const sent = [];
    const suppressed = [];

    for (const candidate of candidates) {
      if (isRateLimited(state, candidate, nowMs)) {
        suppressed.push(candidate);
        continue;
      }

      state.sentByFingerprint[candidate.fingerprint] = {
        alertType: candidate.alertType,
        sentAt: new Date(nowMs).toISOString(),
      };
      sent.push(candidate);

      try {
        await deliverAlert(env, candidate, alertConfig);
      } catch {
        // Alert delivery must not break failover decisions.
      }
    }

    if (sent.length > 0) {
      await writeAlertState(storage, state);
    }

    return Object.freeze({
      sent,
      suppressed,
    });
  } catch {
    return Object.freeze({
      sent: [],
      suppressed: [],
    });
  }
}

export function assertNoSensitiveFailoverAlert(value) {
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
      throw new Error(`Failover alert contains forbidden sensitive token: ${forbidden}`);
    }
  }
}
