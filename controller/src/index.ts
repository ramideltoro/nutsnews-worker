type Env = {
  SHARD_COUNT?: string;
  SHARD_RUN_INTERVAL_MINUTES?: string;
  SHARD_WORKER_PREFIX?: string;
  SHARD_WORKER_SUBDOMAIN?: string;
  MAX_AI_REVIEWS_PER_SHARD?: string;
};

type ShardRunResult = {
  shardIndex: number;
  shardUrl: string;
  ok: boolean;
  status: number;
  response: unknown;
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

function buildShardUrl(env: Env, shardIndex: number): string {
  const prefix = getShardWorkerPrefix(env);
  const subdomain = getShardWorkerSubdomain(env);
  const limit = getMaxAiReviewsPerShard(env);

  return `https://${prefix}-${shardIndex}.${subdomain}.workers.dev/?limit=${limit}`;
}

async function runShard(
  env: Env,
  shardIndex: number,
): Promise<ShardRunResult> {
  const shardUrl = buildShardUrl(env, shardIndex);

  console.log(`Controller calling shard ${shardIndex}: ${shardUrl}`);

  try {
    const response = await fetch(shardUrl, {
      method: "GET",
      headers: {
        "User-Agent": "NutsNewsController/1.0",
      },
    });

    let body: unknown;

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    return {
      shardIndex,
      shardUrl,
      ok: response.ok,
      status: response.status,
      response: body,
    };
  } catch (error) {
    return {
      shardIndex,
      shardUrl,
      ok: false,
      status: 0,
      response:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : String(error),
    };
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
    throw new Error(
      `Invalid shard. Use a number from 0 to ${shardCount - 1}.`,
    );
  }

  return Math.floor(shardIndex);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    try {
      const manualShardIndex = parseManualShard(url, env);
      const shardIndex =
        manualShardIndex ?? getAutomaticShardIndex(env, Date.now());

      const result = await runShard(env, shardIndex);

      return Response.json({
        message: "NutsNews controller run complete",
        mode: manualShardIndex === null ? "automatic" : "manual",
        shardCount: getShardCount(env),
        shardRunIntervalMinutes: getRunIntervalMinutes(env),
        maxAiReviewsPerShard: getMaxAiReviewsPerShard(env),
        ...result,
      });
    } catch (error) {
      return Response.json(
        {
          message: "NutsNews controller run failed",
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
    const shardIndex = getAutomaticShardIndex(env, Date.now());

    console.log(`NutsNews controller scheduled run for shard ${shardIndex}`);

    const result = await runShard(env, shardIndex);

    console.log("NutsNews controller scheduled run finished", result);
  },
};