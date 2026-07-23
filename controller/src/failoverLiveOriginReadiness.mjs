export const DEFAULT_FAILOVER_APEX_READINESS_URL = "https://nutsnews.com/readyz";
export const DEFAULT_FAILOVER_WWW_READINESS_URL = "https://www.nutsnews.com/readyz";
export const DEFAULT_FAILOVER_LIVE_ORIGIN_TIMEOUT_MS = 5000;

function clean(value) {
  return String(value ?? "").trim();
}

function readBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(clean(value));

  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function getSafeReadinessUrl(value, fallback) {
  const rawUrl = clean(value || fallback);

  try {
    const url = new URL(rawUrl);

    if (url.protocol === "https:" && !url.username && !url.password) {
      return url.toString();
    }
  } catch {
    // Fall through to the safe default.
  }

  return fallback;
}

function withCacheBust(rawUrl, cacheBustToken) {
  const url = new URL(rawUrl);

  url.searchParams.set("nutsnews-failover-readiness", clean(cacheBustToken) || String(Date.now()));

  return url.toString();
}

function readinessRequestOptions(signal) {
  return {
    method: "GET",
    redirect: "manual",
    headers: {
      "Accept": "application/json",
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      "Pragma": "no-cache",
      "User-Agent": "NutsNewsFailoverController/1.0",
      "X-NutsNews-Failover-Readiness": "live-origin",
    },
    signal,
  };
}

function sanitizeText(value, fallback = "unknown") {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/.test(candidate) ? candidate : fallback;
}

function sanitizeReadinessCode(value) {
  const candidate = clean(value);

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : "unknown";
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function getHeaderOrPayload(headers, payload, headerName, ...payloadKeys) {
  const headerValue = clean(headers.get(headerName));
  if (headerValue) {
    return headerValue;
  }

  for (const key of payloadKeys) {
    const value = clean(payload?.[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

async function parseReadinessPayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    const payload = await response.json();

    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function classifyObservedLiveOrigin(deploymentTarget) {
  const target = clean(deploymentTarget).toLowerCase();

  if (target === "production-vps" || target === "vps" || target === "vps-production") {
    return "vps";
  }

  if (target === "vercel-production" || target === "vercel" || target.startsWith("vercel-")) {
    return "vercel";
  }

  return "unknown";
}

function detectCacheState(headers) {
  const age = Number(clean(headers.get("age")));
  const cfCacheStatus = clean(headers.get("cf-cache-status")).toUpperCase();
  const cacheControl = clean(headers.get("cache-control")).toLowerCase();

  if (
    (Number.isFinite(age) && age > 0) ||
    ["HIT", "STALE", "EXPIRED", "REVALIDATED", "UPDATING"].includes(cfCacheStatus)
  ) {
    return "stale";
  }

  if (cacheControl.includes("no-store") || ["BYPASS", "DYNAMIC", "MISS"].includes(cfCacheStatus)) {
    return "fresh";
  }

  return "unknown";
}

function emptyObservation(hostname, checkedAt, error, latencyMs) {
  return Object.freeze({
    checkedAt,
    hostname,
    ok: false,
    origin: "unreachable",
    status: null,
    latencyMs,
    deploymentTarget: "unknown",
    sourceCommit: "unknown",
    buildId: "unknown",
    readinessCode: error,
    runtimeEnv: "unknown",
    sideEffectsMode: "unknown",
    databaseProviderMode: "unknown",
    productionWritesPaused: null,
    cacheState: "unknown",
    error,
  });
}

function getSafeCanonicalApexRedirectUrl(response, requestUrl, config) {
  if (response.status !== 308) {
    return null;
  }

  const location = clean(response.headers.get("location"));

  if (!location) {
    return null;
  }

  try {
    const redirectUrl = new URL(location, requestUrl);
    const expectedUrl = new URL(config.wwwUrl);

    if (
      redirectUrl.protocol === "https:" &&
      !redirectUrl.username &&
      !redirectUrl.password &&
      redirectUrl.origin === expectedUrl.origin &&
      redirectUrl.pathname === expectedUrl.pathname
    ) {
      return redirectUrl.toString();
    }
  } catch {
    // Fall through to preserving the original HTTP failure.
  }

  return null;
}

async function checkLiveOriginReadiness(config, key, options) {
  const checkedAt = new Date(options.nowMs ?? Date.now()).toISOString();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const rawUrl = key === "apex" ? config.apexUrl : config.wwwUrl;
  const hostname = key === "apex" ? config.apexHostname : config.wwwHostname;
  const requestUrl = withCacheBust(rawUrl, options.cacheBustToken ?? `${options.nowMs ?? startedAt}`);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    let response = await fetchImpl(requestUrl, readinessRequestOptions(controller.signal));

    if (key === "apex") {
      const canonicalRedirectUrl = getSafeCanonicalApexRedirectUrl(response, requestUrl, config);

      if (canonicalRedirectUrl) {
        response = await fetchImpl(
          withCacheBust(canonicalRedirectUrl, options.cacheBustToken ?? `${options.nowMs ?? startedAt}`),
          readinessRequestOptions(controller.signal),
        );
      }
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    const payload = await parseReadinessPayload(response);
    const deploymentTarget = sanitizeText(
      getHeaderOrPayload(
        response.headers,
        payload,
        "x-nutsnews-deployment-target",
        "deploymentTarget",
        "deployment_target",
      ),
    );
    const origin = classifyObservedLiveOrigin(deploymentTarget);

    return Object.freeze({
      checkedAt,
      hostname,
      ok: response.ok && payload?.ok === true,
      origin,
      status: response.status,
      latencyMs,
      deploymentTarget,
      sourceCommit: sanitizeText(
        getHeaderOrPayload(response.headers, payload, "x-nutsnews-source-commit", "sourceCommit", "source_commit"),
      ),
      buildId: sanitizeText(
        getHeaderOrPayload(response.headers, payload, "x-nutsnews-build-id", "buildId", "build_id"),
      ),
      readinessCode: sanitizeReadinessCode(payload?.code),
      runtimeEnv: sanitizeText(
        getHeaderOrPayload(response.headers, payload, "x-nutsnews-runtime-environment", "runtimeEnv", "runtime_env"),
      ),
      sideEffectsMode: sanitizeReadinessCode(payload?.sideEffectsMode ?? payload?.side_effects_mode),
      databaseProviderMode: sanitizeReadinessCode(
        getHeaderOrPayload(
          response.headers,
          payload,
          "x-nutsnews-database-provider-mode",
          "databaseProviderMode",
          "database_provider_mode",
        ),
      ),
      productionWritesPaused: parseBoolean(payload?.productionWritesPaused ?? payload?.production_writes_paused),
      cacheState: detectCacheState(response.headers),
      error: response.ok ? null : "http_status_unreachable",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return emptyObservation(
      hostname,
      checkedAt,
      timedOut ? "timeout" : "network_error",
      Math.max(0, Date.now() - startedAt),
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function readLiveOriginReadinessConfig(env = {}) {
  const apexUrl = getSafeReadinessUrl(
    env.NUTSNEWS_FAILOVER_APEX_READINESS_URL,
    DEFAULT_FAILOVER_APEX_READINESS_URL,
  );
  const wwwUrl = getSafeReadinessUrl(
    env.NUTSNEWS_FAILOVER_WWW_READINESS_URL,
    DEFAULT_FAILOVER_WWW_READINESS_URL,
  );

  return Object.freeze({
    apexUrl,
    wwwUrl,
    apexHostname: new URL(apexUrl).hostname,
    wwwHostname: new URL(wwwUrl).hostname,
    timeoutMs: readBoundedInteger(
      env.NUTSNEWS_FAILOVER_LIVE_ORIGIN_READINESS_TIMEOUT_MS,
      DEFAULT_FAILOVER_LIVE_ORIGIN_TIMEOUT_MS,
      500,
      15000,
    ),
  });
}

export async function readLiveOriginReadinessState(env = {}, options = {}) {
  const config = readLiveOriginReadinessConfig(env);
  const [apex, www] = await Promise.all([
    checkLiveOriginReadiness(config, "apex", options),
    checkLiveOriginReadiness(config, "www", options),
  ]);

  return Object.freeze({
    checkedAt: new Date(options.nowMs ?? Date.now()).toISOString(),
    apex,
    www,
  });
}
