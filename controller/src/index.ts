import { logError, logInfo, logWarn } from "./logger";
import {
  handleFailoverControllerHealthRequest,
  handleFailoverControllerStatusRequest,
} from "./failoverStatusEndpoint.mjs";
import {
  FAILOVER_CONTROLLER_DURABLE_OBJECT_NAME,
  hasStoredFailoverStatus,
  isFailoverCheckDue,
  normalizeObservedDeploymentTarget,
  readFailoverCheckHistory,
  readFailoverConfig,
  readFailoverStatus,
  recordFailoverDnsAction,
  recordFailoverHealthCheck,
} from "./failoverState.mjs";

type SecretBinding = {
  get: () => Promise<string>;
};

type Env = {
  FAILOVER_CONTROLLER_STATE?: DurableObjectNamespace;
  SHARD_COUNT?: string;
  SHARD_RUN_INTERVAL_MINUTES?: string;
  SHARD_WORKER_PREFIX?: string;
  SHARD_WORKER_SUBDOMAIN?: string;
  MAX_AI_REVIEWS_PER_SHARD?: string;
  TRANSLATION_BACKLOG_ENABLED?: string;
  NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS?: string;
  NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES?: string;
  NUTSNEWS_FAILOVER_CONTROLLER_VERSION?: string;
  NUTSNEWS_FAILOVER_VPS_READINESS_URL?: string;
  NUTSNEWS_FAILOVER_VPS_READINESS_TIMEOUT_MS?: string;
  NUTSNEWS_FAILOVER_CONTROLLER_STALE_AFTER_SECONDS?: string;
  NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET?: string | SecretBinding;
  NUTSNEWS_FAILOVER_STATUS_SIGNATURE_TTL_SECONDS?: string;
  BETTER_STACK_SOURCE_TOKEN?: string | SecretBinding;
  BETTER_STACK_INGESTING_HOST?: string | SecretBinding;
};

type ShardRunMode = 'refresh' | 'translate-backlog';
type FailoverWakeSource = "manual_fetch" | "scheduled_watchdog" | "alarm";
type FailoverWakeResult = {
  bound: boolean;
  ok: boolean;
  checked: boolean | null;
  statusCode?: number;
  error?: unknown;
};

type ShardRunResult = {
  shardIndex: number;
  shardUrl: string;
  ok: boolean;
  status: number;
  response: unknown;
  mode: ShardRunMode;
};

const DEFAULT_FAILOVER_VPS_READINESS_URL = "https://vps.nutsnews.com/readyz";
const DEFAULT_FAILOVER_VPS_READINESS_TIMEOUT_MS = 5000;

function getNumberValue(
    value: string | undefined,
    fallback: number,
    minimum: number,
): number {
  const parsed = Number(value);

  if (Number.isNaN(parsed) || parsed < minimum) {
    return fallback;
  }

  return Math.floor(parsed);
}

function getBoundedNumberValue(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
): number {
  const parsed = getNumberValue(value, fallback, minimum);

  return Math.min(parsed, maximum);
}

function getShardCount(env: Env): number {
  return getNumberValue(env.SHARD_COUNT, 25, 1);
}

function getRunIntervalMinutes(env: Env): number {
  return getNumberValue(env.SHARD_RUN_INTERVAL_MINUTES, 5, 1);
}

function getMaxAiReviewsPerShard(env: Env): number {
  return getNumberValue(env.MAX_AI_REVIEWS_PER_SHARD, 12, 1);
}

function isTranslationBacklogEnabled(env: Env): boolean {
  const value = (env.TRANSLATION_BACKLOG_ENABLED ?? "true").trim().toLowerCase();

  return !["0", "false", "off", "no"].includes(value);
}

function getShardWorkerPrefix(env: Env): string {
  return env.SHARD_WORKER_PREFIX || "nutsnews-worker";
}

function getShardWorkerSubdomain(env: Env): string {
  return env.SHARD_WORKER_SUBDOMAIN || "nutsnews";
}

function getAutomaticShardIndex(env: Env, now = Date.now()): number {
  const shardCount = getShardCount(env);
  const runIntervalMinutes = getRunIntervalMinutes(env);
  const runWindowMs = runIntervalMinutes * 60 * 1000;

  return Math.floor(now / runWindowMs) % shardCount;
}

function buildShardUrl(env: Env, shardIndex: number, mode: ShardRunMode): string {
  const prefix = getShardWorkerPrefix(env);
  const subdomain = getShardWorkerSubdomain(env);

  if (mode === "translate-backlog") {
    return `https://${prefix}-${shardIndex}.${subdomain}.workers.dev/translate-backlog`;
  }

  const limit = getMaxAiReviewsPerShard(env);

  return `https://${prefix}-${shardIndex}.${subdomain}.workers.dev/?limit=${limit}`;
}

function serializeUnknown(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

async function runShard(
    env: Env,
    shardIndex: number,
    requestId: string,
    mode: ShardRunMode = "refresh",
): Promise<ShardRunResult> {
  const startedAt = Date.now();
  const shardUrl = buildShardUrl(env, shardIndex, mode);

  await logInfo(env, "controller.shard.call_started", "Controller calling shard", {
    requestId,
    shardIndex,
    shardUrl,
    mode,
    maxAiReviewsPerShard: getMaxAiReviewsPerShard(env),
  });

  try {
    const response = await fetch(shardUrl, {
      method: "GET",
      headers: {
        "User-Agent": "NutsNewsController/1.0",
        "X-NutsNews-Request-Id": requestId,
      },
    });

    let body: unknown;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    const result = {
      shardIndex,
      shardUrl,
      mode,
      ok: response.ok,
      status: response.status,
      response: body,
    };

    const logFields = {
      requestId,
      shardIndex,
      shardUrl,
      mode,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
    };

    if (response.ok) {
      await logInfo(
          env,
          "controller.shard.call_completed",
          "Controller shard call completed",
          logFields,
      );
    } else {
      await logWarn(
          env,
          "controller.shard.call_failed_status",
          "Controller shard call returned non-OK status",
          {
            ...logFields,
            response: body,
          },
      );
    }

    return result;
  } catch (error) {
    const result = {
      shardIndex,
      shardUrl,
      mode,
      ok: false,
      status: 0,
      response: serializeUnknown(error),
    };

    await logError(
        env,
        "controller.shard.call_failed_exception",
        "Controller failed to call shard",
        error,
        {
          requestId,
          shardIndex,
          shardUrl,
          durationMs: Date.now() - startedAt,
        },
    );

    return result;
  }
}

function parseManualShard(url: URL, env: Env): number | null {
  const shardParam = url.searchParams.get("shard");

  if (shardParam === null) {
    return null;
  }

  const shardIndex = Number(shardParam);
  const shardCount = getShardCount(env);

  if (
      Number.isNaN(shardIndex) ||
      shardIndex < 0 ||
      shardIndex >= shardCount
  ) {
    throw new Error(`Invalid shard. Use a number from 0 to ${shardCount - 1}.`);
  }

  return Math.floor(shardIndex);
}

function parseManualControllerMode(url: URL): ShardRunMode | null {
  const mode = (url.searchParams.get("mode") ?? "").trim().toLowerCase();

  if (url.pathname === "/translate-backlog" || mode === "translate-backlog" || mode === "translation-backlog") {
    return "translate-backlog";
  }

  return null;
}

function createRequestId() {
  return crypto.randomUUID();
}

function getFailoverVpsReadinessUrl(env: Env) {
  const rawUrl = (env.NUTSNEWS_FAILOVER_VPS_READINESS_URL || DEFAULT_FAILOVER_VPS_READINESS_URL).trim();

  try {
    const url = new URL(rawUrl);

    if (url.protocol === "https:" && !url.username && !url.password) {
      return url.toString();
    }
  } catch {
    // Fall through to the safe default.
  }

  return DEFAULT_FAILOVER_VPS_READINESS_URL;
}

function getFailoverReadinessTimeoutMs(env: Env) {
  return getBoundedNumberValue(
      env.NUTSNEWS_FAILOVER_VPS_READINESS_TIMEOUT_MS,
      DEFAULT_FAILOVER_VPS_READINESS_TIMEOUT_MS,
      500,
      15000,
  );
}

async function parseReadinessPayload(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function checkVpsReadiness(env: Env) {
  const startedAt = Date.now();
  const checkedAt = new Date(startedAt).toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getFailoverReadinessTimeoutMs(env));

  try {
    const response = await fetch(getFailoverVpsReadinessUrl(env), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "NutsNewsFailoverController/1.0",
      },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    const observedDeploymentTarget = normalizeObservedDeploymentTarget(
        response.headers.get("x-nutsnews-deployment-target")?.trim() || "unknown",
    );

    if (!response.ok) {
      return {
        checkedAt,
        healthResult: "http_status_unreachable",
        reachable: false,
        status: response.status,
        latencyMs,
        observedDeploymentTarget,
      };
    }

    if (observedDeploymentTarget !== "production-vps") {
      return {
        checkedAt,
        healthResult: "deployment_target_mismatch",
        reachable: false,
        status: "deployment_target_mismatch",
        latencyMs,
        observedDeploymentTarget,
      };
    }

    const payload = await parseReadinessPayload(response);
    if (!payload || typeof payload !== "object" || (payload as { ok?: unknown }).ok !== true) {
      return {
        checkedAt,
        healthResult: "invalid_readiness_response",
        reachable: false,
        status: "invalid_readiness_response",
        latencyMs,
        observedDeploymentTarget,
      };
    }

    return {
      checkedAt,
      healthResult: "reachable",
      reachable: true,
      status: response.status,
      latencyMs,
      observedDeploymentTarget,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      checkedAt,
      healthResult: timedOut ? "timeout" : "network_error",
      reachable: false,
      status: timedOut ? "timeout" : "network_error",
      latencyMs,
      observedDeploymentTarget: "unknown",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function scheduleNextFailoverAlarm(storage: DurableObjectStorage, status: { nextCheckDueAt?: string | null }) {
  const nextCheckDueMs = Date.parse(String(status.nextCheckDueAt || ""));

  if (Number.isFinite(nextCheckDueMs)) {
    await storage.setAlarm(nextCheckDueMs);
  }
}

function getFailoverStateStub(env: Env) {
  if (!env.FAILOVER_CONTROLLER_STATE) {
    return null;
  }

  const id = env.FAILOVER_CONTROLLER_STATE.idFromName(FAILOVER_CONTROLLER_DURABLE_OBJECT_NAME);

  return env.FAILOVER_CONTROLLER_STATE.get(id);
}

function parseFailoverWakeSource(value: unknown): Exclude<FailoverWakeSource, "alarm"> {
  return value === "manual_fetch" || value === "scheduled_watchdog" ? value : "scheduled_watchdog";
}

async function wakeFailoverStateOwner(
    env: Env,
    requestId: string,
    source: Exclude<FailoverWakeSource, "alarm">,
): Promise<FailoverWakeResult> {
  const stub = getFailoverStateStub(env);

  if (!stub) {
    return { bound: false, ok: false, checked: null };
  }

  try {
    const response = await stub.fetch("https://failover-controller.internal/internal/failover/wake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, source }),
    });

    if (!response.ok) {
      return { bound: true, ok: false, checked: null, statusCode: response.status };
    }

    const payload = await response.json() as { checked?: unknown };

    return {
      bound: true,
      ok: true,
      checked: typeof payload.checked === "boolean" ? payload.checked : null,
      statusCode: response.status,
    };
  } catch (error) {
    await logWarn(
        env,
        "controller.failover_state.wake_failed",
        "Controller failed to wake failover state owner",
        {
          requestId,
          source,
          error: serializeUnknown(error),
        },
    );

    return { bound: true, ok: false, checked: null, error: serializeUnknown(error) };
  }
}

async function readFailoverStatusSnapshot(env: Env) {
  const stub = getFailoverStateStub(env);

  if (!stub) {
    return { ok: false, statusCode: 503, error: "failover_state_unbound" };
  }

  try {
    const response = await stub.fetch("https://failover-controller.internal/internal/failover/state", {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return { ok: false, statusCode: response.status, error: "failover_state_unavailable" };
    }

    const payload = await response.json() as { status?: unknown };

    return { ok: true, status: payload.status };
  } catch (error) {
    return {
      ok: false,
      statusCode: 503,
      error: "failover_state_unavailable",
      detail: serializeUnknown(error),
    };
  }
}

export class FailoverControllerStateObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const config = readFailoverConfig(this.env);

    if (request.method === "POST" && url.pathname === "/internal/failover/wake") {
      const body = await request.json().catch(() => ({})) as { source?: unknown };
      const result = await this.runHealthCheck(parseFailoverWakeSource(body.source));

      return Response.json(result);
    }

    if (request.method === "GET" && url.pathname === "/internal/failover/state") {
      const status = await readFailoverStatus(this.state.storage, Date.now(), config);
      const history = await readFailoverCheckHistory(this.state.storage);

      return Response.json({ status, history });
    }

    if (request.method === "POST" && url.pathname === "/internal/failover/dns-action") {
      const body = await request.json().catch(() => ({}));
      const result = await recordFailoverDnsAction(this.state.storage, body, {
        config,
        nowMs: Date.now(),
      });

      return Response.json(result);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async alarm() {
    await this.runHealthCheck("alarm");
  }

  private async runHealthCheck(source: FailoverWakeSource) {
    const config = readFailoverConfig(this.env);
    const nowMs = Date.now();
    const statusExists = await hasStoredFailoverStatus(this.state.storage);
    const currentStatus = await readFailoverStatus(this.state.storage, nowMs, config);

    if (statusExists && !isFailoverCheckDue(currentStatus, nowMs)) {
      await scheduleNextFailoverAlarm(this.state.storage, currentStatus);

      return {
        checked: false,
        status: currentStatus,
      };
    }

    const check = await checkVpsReadiness(this.env);
    const result = await recordFailoverHealthCheck(this.state.storage, check, {
      config,
      nowMs,
      source,
    });

    await scheduleNextFailoverAlarm(this.state.storage, result.status);

    return result;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const startedAt = Date.now();
    const requestId = createRequestId();
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/healthz") {
      return handleFailoverControllerHealthRequest(request, env);
    }

    if (url.pathname === "/status") {
      return handleFailoverControllerStatusRequest(request, env, {
        readStatusSnapshot: () => readFailoverStatusSnapshot(env),
      });
    }

    await logInfo(
        env,
        "controller.request_started",
        "NutsNews controller request started",
        {
          requestId,
          method: request.method,
          path: url.pathname,
          query: url.search,
        },
    );

    try {
      const failoverWake = await wakeFailoverStateOwner(env, requestId, "manual_fetch");
      const manualShardIndex = parseManualShard(url, env);
      const requestedMode = parseManualControllerMode(url);
      const shardIndex =
          manualShardIndex ?? getAutomaticShardIndex(env, Date.now());

      const result = await runShard(env, shardIndex, requestId, requestedMode ?? "refresh");
      const translationBacklogResult =
          requestedMode === null && isTranslationBacklogEnabled(env)
              ? await runShard(env, shardIndex, requestId, "translate-backlog")
              : null;

      const responseBody = {
        message: "NutsNews controller run complete",
        controllerMode: manualShardIndex === null ? "automatic" : "manual",
        requestedMode: requestedMode ?? "refresh",
        translationBacklogEnabled: isTranslationBacklogEnabled(env),
        shardCount: getShardCount(env),
        shardRunIntervalMinutes: getRunIntervalMinutes(env),
        maxAiReviewsPerShard: getMaxAiReviewsPerShard(env),
        requestId,
        result,
        translationBacklogResult,
      };

      await logInfo(
          env,
          "controller.request_completed",
          "NutsNews controller request completed",
          {
            requestId,
            controllerMode: manualShardIndex === null ? "automatic" : "manual",
            requestedMode: requestedMode ?? "refresh",
            failoverStateBound: failoverWake.bound,
            failoverStateWakeOk: failoverWake.ok,
            failoverStateChecked: failoverWake.checked,
            translationBacklogOk: translationBacklogResult?.ok ?? null,
            shardIndex,
            ok: result.ok,
            status: result.status,
            durationMs: Date.now() - startedAt,
          },
      );

      return Response.json(responseBody);
    } catch (error) {
      await logError(
          env,
          "controller.request_failed",
          "NutsNews controller request failed",
          error,
          {
            requestId,
            method: request.method,
            path: url.pathname,
            query: url.search,
            durationMs: Date.now() - startedAt,
          },
      );

      return Response.json(
          {
            message: "NutsNews controller run failed",
            requestId,
            error:
                error instanceof Error
                    ? {
                      name: error.name,
                      message: error.message,
                    }
                    : String(error),
          },
          {
            status: 400,
          },
      );
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    const startedAt = Date.now();
    const requestId = createRequestId();
    const shardIndex = getAutomaticShardIndex(env, Date.now());
    const failoverWake = await wakeFailoverStateOwner(env, requestId, "scheduled_watchdog");

    await logInfo(
        env,
        "controller.scheduled_started",
        "NutsNews controller scheduled run started",
        {
          requestId,
          shardIndex,
          shardCount: getShardCount(env),
          shardRunIntervalMinutes: getRunIntervalMinutes(env),
          failoverStateBound: failoverWake.bound,
          failoverStateWakeOk: failoverWake.ok,
          failoverStateChecked: failoverWake.checked,
        },
    );

    const result = await runShard(env, shardIndex, requestId, "refresh");
    const translationBacklogResult = isTranslationBacklogEnabled(env)
        ? await runShard(env, shardIndex, requestId, "translate-backlog")
        : null;

    await logInfo(
        env,
        "controller.scheduled_completed",
        "NutsNews controller scheduled run completed",
        {
          requestId,
          shardIndex,
          ok: result.ok,
          status: result.status,
          translationBacklogEnabled: isTranslationBacklogEnabled(env),
          translationBacklogOk: translationBacklogResult?.ok ?? null,
          translationBacklogStatus: translationBacklogResult?.status ?? null,
          failoverStateBound: failoverWake.bound,
          failoverStateWakeOk: failoverWake.ok,
          failoverStateChecked: failoverWake.checked,
          durationMs: Date.now() - startedAt,
        },
    );
  },
};
