#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function fetchJson(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "NutsNewsIngestionSchedulingProof/1.0" },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      // The report records only the parse result, never the response body.
    }
    return {
      body,
      httpOk: response.ok,
      httpStatus: response.status,
      transportOk: true,
    };
  } catch {
    return {
      body: null,
      httpOk: false,
      httpStatus: null,
      transportOk: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function boundedInteger(name, defaultValue, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const [
  requestedValue,
  outputPath,
  baseUrl = "https://nutsnews-controller.nutsnews.workers.dev",
  githubOutputPathArgument,
] = process.argv.slice(2);

if (!new Set(["true", "false", "preserve"]).has(requestedValue) || !outputPath) {
  console.error(
    "Usage: verify-ingestion-scheduling-status.mjs <true|false|preserve> <output-path> [controller-base-url] [github-output-path]",
  );
  process.exit(2);
}

const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
const githubOutputPath = githubOutputPathArgument || process.env.GITHUB_OUTPUT || null;
const expectedSourceRevision =
  process.env.NUTSNEWS_EXPECTED_CONTROLLER_SOURCE_REVISION || null;
const expectedDeploymentCorrelation =
  process.env.NUTSNEWS_EXPECTED_CONTROLLER_DEPLOYMENT_CORRELATION || null;
const expectedControllerVersionId =
  process.env.NUTSNEWS_EXPECTED_CONTROLLER_VERSION_ID || null;
if (
  (expectedSourceRevision === null) !== (expectedDeploymentCorrelation === null) ||
  (expectedSourceRevision !== null &&
    !/^[0-9a-f]{40}$/.test(expectedSourceRevision)) ||
  (expectedDeploymentCorrelation !== null &&
    !/^[A-Za-z0-9._-]{1,100}$/.test(expectedDeploymentCorrelation)) ||
  (expectedControllerVersionId !== null &&
    !/^[A-Za-z0-9._-]{1,128}$/.test(expectedControllerVersionId))
) {
  throw new Error("expected controller deployment identity is incomplete or invalid");
}
const maxAttempts = boundedInteger(
  "NUTSNEWS_SCHEDULING_VERIFY_MAX_ATTEMPTS",
  1,
  1,
  60,
);
const retryDelayMs = boundedInteger(
  "NUTSNEWS_SCHEDULING_VERIFY_RETRY_DELAY_MS",
  0,
  0,
  10_000,
);
const requiredConsecutivePasses = boundedInteger(
  "NUTSNEWS_SCHEDULING_VERIFY_REQUIRED_CONSECUTIVE_PASSES",
  1,
  1,
  maxAttempts,
);
let expectedEnabled = requestedValue === "preserve" ? null : requestedValue === "true";
let consecutivePasses = 0;
let previousPassingContractSha256 = null;
let attempt = null;
let attemptsUsed = 0;

for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
  attemptsUsed = attemptNumber;
  const [status, health] = await Promise.all([
    fetchJson(`${normalizedBaseUrl}/ingestion-scheduling/status`),
    fetchJson(`${normalizedBaseUrl}/healthz`),
  ]);
  const observedEnabled =
    typeof status.body?.enabled === "boolean" ? status.body.enabled : null;
  const observedControllerSourceRevision =
    typeof status.body?.deploymentIdentity?.sourceRevision === "string" &&
    /^[0-9a-f]{40}$/.test(status.body.deploymentIdentity.sourceRevision)
      ? status.body.deploymentIdentity.sourceRevision
      : null;
  const observedControllerDeploymentCorrelation =
    typeof status.body?.deploymentIdentity?.correlation === "string" &&
    /^[A-Za-z0-9._-]{1,100}$/.test(status.body.deploymentIdentity.correlation)
      ? status.body.deploymentIdentity.correlation
      : null;
  const observedControllerVersionId =
    typeof status.body?.deploymentIdentity?.cloudflareVersionId === "string" &&
    /^[A-Za-z0-9._-]{1,128}$/.test(
      status.body.deploymentIdentity.cloudflareVersionId,
    )
      ? status.body.deploymentIdentity.cloudflareVersionId
      : null;
  if (requestedValue === "preserve" && expectedEnabled === null && observedEnabled !== null) {
    expectedEnabled = observedEnabled;
  }
  const statusContractSha256 =
    status.body && typeof status.body === "object"
      ? sha256(JSON.stringify(status.body))
      : null;
  const checks = {
    schedulingTransportOk: status.transportOk,
    schedulingHttpOk: status.httpOk,
    schedulingSchemaValid: status.body?.schemaVersion === 1,
    schedulingStateBoolean: observedEnabled !== null,
    schedulingStateMatches:
      expectedEnabled !== null &&
      observedEnabled === expectedEnabled &&
      status.body?.state === (expectedEnabled ? "enabled" : "disabled"),
    schedulingExplicitlyConfigured: status.body?.configured === true,
    schedulingConfigurationValid: status.body?.configurationValid === true,
    deploymentIdentityMatches:
      expectedSourceRevision === null ||
      (status.body?.deploymentIdentity?.valid === true &&
        observedControllerSourceRevision === expectedSourceRevision &&
        observedControllerDeploymentCorrelation === expectedDeploymentCorrelation),
    controllerVersionMatches:
      expectedControllerVersionId === null ||
      observedControllerVersionId === expectedControllerVersionId,
    shardRefreshDispatchMatches:
      expectedEnabled !== null &&
      status.body?.disabledEffects?.shardRefreshDispatchEnabled === expectedEnabled,
    translationBacklogDispatchMatches:
      expectedEnabled !== null &&
      status.body?.disabledEffects?.translationBacklogDispatchEnabled === expectedEnabled,
    legacyOwnerUnchanged:
      status.body?.legacyProductionOwner === "ramideltoro/nutsnews-worker",
    failoverWakeRetained:
      status.body?.disabledEffects?.failoverWakeEnabled === true,
    failoverStatusRetained:
      status.body?.disabledEffects?.failoverStatusEnabled === true,
    failoverActionsRetained:
      status.body?.disabledEffects?.failoverActionsEnabled === true,
    durableObjectAlarmsRetained:
      status.body?.disabledEffects?.durableObjectAlarmsEnabled === true,
    dnsReadbackRetained:
      status.body?.disabledEffects?.dnsReadbackEnabled === true,
    liveOriginReadinessRetained:
      status.body?.disabledEffects?.liveOriginReadinessEnabled === true,
    failoverAlertsRetained:
      status.body?.disabledEffects?.failoverAlertsEnabled === true,
    analyticsEventsRetained:
      status.body?.disabledEffects?.analyticsEventsEnabled === true,
    healthTransportOk: health.transportOk,
    healthHttpOk: health.httpOk,
    healthServiceValid: health.body?.service === "nutsnews-controller",
    preserveOutputAvailable: requestedValue !== "preserve" || githubOutputPath !== null,
  };
  const individualPass = Object.values(checks).every((passed) => passed === true);
  if (individualPass) {
    consecutivePasses =
      previousPassingContractSha256 === statusContractSha256
        ? consecutivePasses + 1
        : 1;
    previousPassingContractSha256 = statusContractSha256;
  } else {
    consecutivePasses = 0;
    previousPassingContractSha256 = null;
  }
  attempt = {
    checks,
    deploymentIdentity: {
      correlation: observedControllerDeploymentCorrelation,
      sourceRevision: observedControllerSourceRevision,
      cloudflareVersionId: observedControllerVersionId,
    },
    healthHttpStatus: health.httpStatus,
    observedEnabled,
    schedulingStatusHttpStatus: status.httpStatus,
    statusContractSha256,
  };
  if (consecutivePasses >= requiredConsecutivePasses) break;
  if (attemptNumber < maxAttempts && retryDelayMs > 0) {
    await wait(retryDelayMs);
  }
}

const checks = {
  ...(attempt?.checks ?? {}),
  stableReadback: consecutivePasses >= requiredConsecutivePasses,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);

const report = {
  schemaVersion: 1,
  safeMetadataOnly: true,
  status: failedChecks.length === 0 ? "pass" : "fail",
  checkedAt: new Date().toISOString(),
  requestedOperation: requestedValue === "preserve" ? "preserve" : "assert",
  expectedControllerSourceRevision: expectedSourceRevision,
  expectedControllerDeploymentCorrelation: expectedDeploymentCorrelation,
  expectedControllerVersionId,
  expectedIngestionSchedulingEnabled: expectedEnabled,
  observedIngestionSchedulingEnabled: attempt?.observedEnabled ?? null,
  observedControllerSourceRevision:
    attempt?.deploymentIdentity?.sourceRevision ?? null,
  observedControllerDeploymentCorrelation:
    attempt?.deploymentIdentity?.correlation ?? null,
  observedControllerVersionId:
    attempt?.deploymentIdentity?.cloudflareVersionId ?? null,
  schedulingStatusHttpStatus: attempt?.schedulingStatusHttpStatus ?? null,
  healthHttpStatus: attempt?.healthHttpStatus ?? null,
  attemptsUsed,
  maxAttempts,
  retryDelayMs,
  requiredConsecutivePasses,
  consecutivePasses,
  checks,
  failedChecks,
  statusContractSha256: attempt?.statusContractSha256 ?? null,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify(report));

if (failedChecks.length > 0) {
  process.exit(1);
}

if (requestedValue === "preserve") {
  fs.appendFileSync(
    githubOutputPath,
    `ingestion_scheduling_enabled=${expectedEnabled ? "true" : "false"}\n` +
      `status_contract_sha256=${report.statusContractSha256}\n` +
      `controller_source_revision=${report.observedControllerSourceRevision ?? ""}\n` +
      `controller_deployment_correlation=${report.observedControllerDeploymentCorrelation ?? ""}\n` +
      `controller_version_id=${report.observedControllerVersionId ?? ""}\n`,
    { encoding: "utf8" },
  );
}
