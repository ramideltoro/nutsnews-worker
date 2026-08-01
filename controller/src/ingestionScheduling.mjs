export const INGESTION_SCHEDULING_BINDING = "INGESTION_SCHEDULING_ENABLED";
export const INGESTION_SCHEDULING_STATUS_SCHEMA_VERSION = 1;

const ENABLED_VALUES = new Set(["1", "true", "on", "yes"]);
const DISABLED_VALUES = new Set(["0", "false", "off", "no"]);
const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/;
const DEPLOYMENT_CORRELATION_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const CLOUDFLARE_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function readIngestionSchedulingPolicy(env = {}) {
  const raw = env?.[INGESTION_SCHEDULING_BINDING];
  const value = clean(raw);

  if (raw === undefined || raw === null || value === "") {
    return {
      enabled: false,
      configured: false,
      valid: false,
      source: "safe_default_disabled",
    };
  }

  if (ENABLED_VALUES.has(value)) {
    return {
      enabled: true,
      configured: true,
      valid: true,
      source: "explicit_enabled",
    };
  }

  if (DISABLED_VALUES.has(value)) {
    return {
      enabled: false,
      configured: true,
      valid: true,
      source: "explicit_disabled",
    };
  }

  return {
    enabled: false,
    configured: true,
    valid: false,
    source: "invalid_safe_default_disabled",
  };
}

export function buildIngestionSchedulingStatus(env = {}) {
  const policy = readIngestionSchedulingPolicy(env);
  const sourceRevision = clean(env?.NUTSNEWS_CONTROLLER_SOURCE_REVISION);
  const deploymentCorrelation =
    typeof env?.NUTSNEWS_CONTROLLER_DEPLOYMENT_CORRELATION === "string"
      ? env.NUTSNEWS_CONTROLLER_DEPLOYMENT_CORRELATION.trim()
      : "";
  const sourceRevisionValid =
    SOURCE_REVISION_PATTERN.test(sourceRevision) && !/^0{40}$/.test(sourceRevision);
  const deploymentCorrelationValid = DEPLOYMENT_CORRELATION_PATTERN.test(
    deploymentCorrelation,
  );
  const cloudflareVersionId =
    typeof env?.CF_VERSION_METADATA?.id === "string"
      ? env.CF_VERSION_METADATA.id.trim()
      : "";
  const cloudflareVersionValid = CLOUDFLARE_VERSION_PATTERN.test(
    cloudflareVersionId,
  );

  return {
    schemaVersion: INGESTION_SCHEDULING_STATUS_SCHEMA_VERSION,
    binding: INGESTION_SCHEDULING_BINDING,
    state: policy.enabled ? "enabled" : "disabled",
    enabled: policy.enabled,
    configured: policy.configured,
    configurationValid: policy.valid,
    configurationSource: policy.source,
    legacyProductionOwner: "ramideltoro/nutsnews-worker",
    deploymentIdentity: {
      valid: sourceRevisionValid && deploymentCorrelationValid,
      sourceRevision: sourceRevisionValid ? sourceRevision : null,
      correlation: deploymentCorrelationValid ? deploymentCorrelation : null,
      cloudflareVersionId: cloudflareVersionValid ? cloudflareVersionId : null,
    },
    disabledEffects: {
      shardRefreshDispatchEnabled: policy.enabled,
      translationBacklogDispatchEnabled: policy.enabled,
      failoverWakeEnabled: true,
      failoverStatusEnabled: true,
      failoverActionsEnabled: true,
      durableObjectAlarmsEnabled: true,
      dnsReadbackEnabled: true,
      liveOriginReadinessEnabled: true,
      failoverAlertsEnabled: true,
      analyticsEventsEnabled: true,
    },
  };
}

export function handleIngestionSchedulingStatusRequest(request, env = {}) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { Allow: "GET, HEAD" } },
    );
  }

  const status = buildIngestionSchedulingStatus(env);
  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-NutsNews-Ingestion-Scheduling": status.state,
      },
    });
  }

  return Response.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * @param {{
 *   env?: Record<string, unknown>,
 *   source: string,
 *   shardIndex: number,
 *   requestedMode?: "refresh" | "translate-backlog" | null,
 *   translationBacklogEnabled?: boolean,
 *   wakeFailover: (source: string) => Promise<any>,
 *   dispatchShard: (mode: "refresh" | "translate-backlog") => Promise<any>,
 *   onFailoverWake?: (value: { failoverWake: any, scheduling: ReturnType<typeof buildIngestionSchedulingStatus> }) => Promise<any> | any,
 * }} input
 */
export async function runIngestionSchedulingCycle({
  env = {},
  source,
  shardIndex,
  requestedMode = null,
  translationBacklogEnabled = true,
  wakeFailover,
  dispatchShard,
  onFailoverWake,
}) {
  if (typeof wakeFailover !== "function") {
    throw new TypeError("wakeFailover must be a function");
  }
  if (typeof dispatchShard !== "function") {
    throw new TypeError("dispatchShard must be a function");
  }

  // Failover state is always woken before the ingestion switch is evaluated.
  const failoverWake = await wakeFailover(source);
  const scheduling = buildIngestionSchedulingStatus(env);

  if (onFailoverWake !== undefined) {
    if (typeof onFailoverWake !== "function") {
      throw new TypeError("onFailoverWake must be a function when provided");
    }
    await onFailoverWake({ failoverWake, scheduling });
  }

  if (!scheduling.enabled) {
    return {
      status: "skipped_ingestion_disabled",
      source,
      shardIndex,
      requestedMode: requestedMode ?? "refresh",
      scheduling,
      failoverWake,
      result: null,
      translationBacklogResult: null,
    };
  }

  const result = await dispatchShard(requestedMode ?? "refresh");
  const translationBacklogResult =
    requestedMode === null && translationBacklogEnabled
      ? await dispatchShard("translate-backlog")
      : null;

  return {
    status: "dispatched",
    source,
    shardIndex,
    requestedMode: requestedMode ?? "refresh",
    scheduling,
    failoverWake,
    result,
    translationBacklogResult,
  };
}
