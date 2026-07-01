import { logError, logInfo, logWarn } from "./logger";

type SecretBinding = {
  get: () => Promise<string>;
};

type Env = {
  SHARD_COUNT?: string;
  SHARD_RUN_INTERVAL_MINUTES?: string;
  SHARD_WORKER_PREFIX?: string;
  SHARD_WORKER_SUBDOMAIN?: string;
  MAX_AI_REVIEWS_PER_SHARD?: string;
  TRANSLATION_BACKLOG_ENABLED?: string;
  BETTER_STACK_SOURCE_TOKEN?: string | SecretBinding;
  BETTER_STACK_INGESTING_HOST?: string | SecretBinding;
};

type ShardRunMode = 'refresh' | 'translate-backlog';

type ShardRunResult = {
  shardIndex: number;
  shardUrl: string;
  ok: boolean;
  status: number;
  response: unknown;
  mode: ShardRunMode;
};

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

export default {
  async fetch(request: Request, env: Env) {
    const startedAt = Date.now();
    const requestId = createRequestId();
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
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

    await logInfo(
        env,
        "controller.scheduled_started",
        "NutsNews controller scheduled run started",
        {
          requestId,
          shardIndex,
          shardCount: getShardCount(env),
          shardRunIntervalMinutes: getRunIntervalMinutes(env),
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
          durationMs: Date.now() - startedAt,
        },
    );
  },
};