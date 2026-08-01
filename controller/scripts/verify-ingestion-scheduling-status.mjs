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
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

const [expectedValue, outputPath, baseUrl = "https://nutsnews-controller.nutsnews.workers.dev"] =
  process.argv.slice(2);

if (!new Set(["true", "false"]).has(expectedValue) || !outputPath) {
  console.error(
    "Usage: verify-ingestion-scheduling-status.mjs <true|false> <output-path> [controller-base-url]",
  );
  process.exit(2);
}

const expectedEnabled = expectedValue === "true";
const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
const status = await fetchJson(`${normalizedBaseUrl}/ingestion-scheduling/status`);
const health = await fetchJson(`${normalizedBaseUrl}/healthz`);

const checks = {
  schedulingHttpOk: status.response.ok,
  schedulingSchemaValid: status.body?.schemaVersion === 1,
  schedulingStateMatches:
    status.body?.enabled === expectedEnabled &&
    status.body?.state === (expectedEnabled ? "enabled" : "disabled"),
  schedulingConfigurationValid: status.body?.configurationValid === true,
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
  healthHttpOk: health.response.ok,
  healthServiceValid: health.body?.service === "nutsnews-controller",
};

const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);

const report = {
  schemaVersion: 1,
  safeMetadataOnly: true,
  status: failedChecks.length === 0 ? "pass" : "fail",
  checkedAt: new Date().toISOString(),
  expectedIngestionSchedulingEnabled: expectedEnabled,
  observedIngestionSchedulingEnabled:
    typeof status.body?.enabled === "boolean" ? status.body.enabled : null,
  schedulingStatusHttpStatus: status.response.status,
  healthHttpStatus: health.response.status,
  checks,
  failedChecks,
  statusContractSha256:
    status.body && typeof status.body === "object"
      ? sha256(JSON.stringify(status.body))
      : null,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify(report));

if (failedChecks.length > 0) {
  process.exit(1);
}
