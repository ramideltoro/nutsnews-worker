import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const controllerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proofScript = path.join(
  controllerRoot,
  "scripts",
  "verify-ingestion-scheduling-status.mjs",
);

function schedulingStatus(enabled, overrides = {}) {
  return {
    schemaVersion: 1,
    state: enabled ? "enabled" : "disabled",
    enabled,
    configured: true,
    configurationValid: true,
    legacyProductionOwner: "ramideltoro/nutsnews-worker",
    disabledEffects: {
      shardRefreshDispatchEnabled: enabled,
      translationBacklogDispatchEnabled: enabled,
      failoverWakeEnabled: true,
      failoverStatusEnabled: true,
      failoverActionsEnabled: true,
      durableObjectAlarmsEnabled: true,
      dnsReadbackEnabled: true,
      liveOriginReadinessEnabled: true,
      failoverAlertsEnabled: true,
      analyticsEventsEnabled: true,
    },
    ...overrides,
  };
}

async function runProof({
  requestedValue = "preserve",
  statusBody = schedulingStatus(false),
  healthBody = { service: "nutsnews-controller" },
  includeGithubOutput = true,
  verificationEnvironment = {},
} = {}) {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "nutsnews-ingestion-scheduling-proof-"),
  );
  const reportPath = path.join(tempDirectory, "report.json");
  const githubOutputPath = path.join(tempDirectory, "github-output.txt");
  let statusRequestCount = 0;
  const server = http.createServer((request, response) => {
    const resolvedStatusBody =
      request.url === "/ingestion-scheduling/status" && typeof statusBody === "function"
        ? statusBody(statusRequestCount++)
        : statusBody;
    const body =
      request.url === "/ingestion-scheduling/status"
        ? resolvedStatusBody
        : request.url === "/healthz"
          ? healthBody
          : { error: "not_found" };
    response.writeHead(request.url === "/healthz" || request.url === "/ingestion-scheduling/status" ? 200 : 404, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify(body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const argumentsList = [
      proofScript,
      requestedValue,
      reportPath,
      `http://127.0.0.1:${address.port}`,
    ];
    if (includeGithubOutput) {
      argumentsList.push(githubOutputPath);
    }

    const result = await new Promise((resolve, reject) => {
      const childEnvironment = { ...process.env };
      delete childEnvironment.GITHUB_OUTPUT;
      Object.assign(childEnvironment, verificationEnvironment);
      const child = spawn(process.execPath, argumentsList, {
        cwd: controllerRoot,
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", reject);
      child.once("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
    });

    return {
      ...result,
      report: fs.existsSync(reportPath)
        ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
        : null,
      githubOutput: fs.existsSync(githubOutputPath)
        ? fs.readFileSync(githubOutputPath, "utf8")
        : "",
    };
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test("preserve mode exports the exact live disabled state", async () => {
  const result = await runProof({ statusBody: schedulingStatus(false) });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.requestedOperation, "preserve");
  assert.equal(result.report.expectedIngestionSchedulingEnabled, false);
  assert.match(result.githubOutput, /^ingestion_scheduling_enabled=false$/m);
  assert.match(result.githubOutput, /^status_contract_sha256=[a-f0-9]{64}$/m);
});

test("preserve mode keeps an explicitly restored rollback state enabled", async () => {
  const result = await runProof({ statusBody: schedulingStatus(true) });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.expectedIngestionSchedulingEnabled, true);
  assert.match(result.githubOutput, /^ingestion_scheduling_enabled=true$/m);
});

test("preserve mode rejects an implicit or invalid scheduling state", async (context) => {
  await context.test("implicit binding", async () => {
    const result = await runProof({
      statusBody: schedulingStatus(false, { configured: false }),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.report.status, "fail");
    assert(result.report.failedChecks.includes("schedulingExplicitlyConfigured"));
    assert.equal(result.githubOutput, "");
  });

  await context.test("state and boolean disagree", async () => {
    const result = await runProof({
      statusBody: schedulingStatus(false, { state: "enabled" }),
    });

    assert.equal(result.exitCode, 1);
    assert.equal(result.report.status, "fail");
    assert(result.report.failedChecks.includes("schedulingStateMatches"));
    assert.equal(result.githubOutput, "");
  });
});

test("preserve mode requires a dedicated GitHub output path", async () => {
  const result = await runProof({ includeGithubOutput: false });

  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, "fail");
  assert(result.report.failedChecks.includes("preserveOutputAvailable"));
});

test("assert mode remains available for explicit cutover and rollback verification", async () => {
  const result = await runProof({
    requestedValue: "true",
    statusBody: schedulingStatus(true),
    includeGithubOutput: false,
  });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.requestedOperation, "assert");
  assert.equal(result.githubOutput, "");
});

test("bounded stable readback tolerates delayed controller propagation", async () => {
  const result = await runProof({
    requestedValue: "false",
    statusBody: (requestIndex) => schedulingStatus(requestIndex > 0 ? false : true),
    includeGithubOutput: false,
    verificationEnvironment: {
      NUTSNEWS_SCHEDULING_VERIFY_MAX_ATTEMPTS: "5",
      NUTSNEWS_SCHEDULING_VERIFY_REQUIRED_CONSECUTIVE_PASSES: "3",
      NUTSNEWS_SCHEDULING_VERIFY_RETRY_DELAY_MS: "0",
    },
  });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.status, "pass");
  assert.equal(result.report.attemptsUsed, 4);
  assert.equal(result.report.consecutivePasses, 3);
  assert.equal(result.report.checks.stableReadback, true);
});

test("bounded readback fails when the desired state never stabilizes", async () => {
  const result = await runProof({
    requestedValue: "false",
    statusBody: (requestIndex) => schedulingStatus(requestIndex % 2 === 0),
    includeGithubOutput: false,
    verificationEnvironment: {
      NUTSNEWS_SCHEDULING_VERIFY_MAX_ATTEMPTS: "4",
      NUTSNEWS_SCHEDULING_VERIFY_REQUIRED_CONSECUTIVE_PASSES: "2",
      NUTSNEWS_SCHEDULING_VERIFY_RETRY_DELAY_MS: "0",
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, "fail");
  assert(result.report.failedChecks.includes("stableReadback"));
});

test("exact deployment identity is required when supplied", async () => {
  const sourceRevision = "a".repeat(40);
  const correlation = "backend-worker-uplift-cutover-12345-2";
  const versionId = "97108b3d-1111-2222-3333-444444444444";
  const verificationEnvironment = {
    NUTSNEWS_EXPECTED_CONTROLLER_SOURCE_REVISION: sourceRevision,
    NUTSNEWS_EXPECTED_CONTROLLER_DEPLOYMENT_CORRELATION: correlation,
    NUTSNEWS_EXPECTED_CONTROLLER_VERSION_ID: versionId,
  };
  const result = await runProof({
    requestedValue: "false",
    includeGithubOutput: false,
    statusBody: schedulingStatus(false, {
      deploymentIdentity: {
        valid: true,
        sourceRevision,
        correlation,
        cloudflareVersionId: versionId,
      },
    }),
    verificationEnvironment,
  });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.report.observedControllerSourceRevision, sourceRevision);
  assert.equal(result.report.observedControllerDeploymentCorrelation, correlation);
  assert.equal(result.report.observedControllerVersionId, versionId);
  assert.equal(result.report.checks.deploymentIdentityMatches, true);
  assert.equal(result.report.checks.controllerVersionMatches, true);
});

test("a stale deployment identity cannot satisfy transition readback", async () => {
  const result = await runProof({
    requestedValue: "true",
    includeGithubOutput: false,
    statusBody: schedulingStatus(true, {
      deploymentIdentity: {
        valid: true,
        sourceRevision: "b".repeat(40),
        correlation: "stale-deployment",
      },
    }),
    verificationEnvironment: {
      NUTSNEWS_EXPECTED_CONTROLLER_SOURCE_REVISION: "a".repeat(40),
      NUTSNEWS_EXPECTED_CONTROLLER_DEPLOYMENT_CORRELATION:
        "backend-worker-uplift-rollback-12345-2",
    },
  });

  assert.equal(result.exitCode, 1);
  assert(result.report.failedChecks.includes("deploymentIdentityMatches"));
});

test("a stale active Cloudflare version cannot satisfy deploy readback", async () => {
  const sourceRevision = "a".repeat(40);
  const correlation = "worker-pipeline-12345-2";
  const result = await runProof({
    requestedValue: "false",
    includeGithubOutput: false,
    statusBody: schedulingStatus(false, {
      deploymentIdentity: {
        valid: true,
        sourceRevision,
        correlation,
        cloudflareVersionId: "stale-version",
      },
    }),
    verificationEnvironment: {
      NUTSNEWS_EXPECTED_CONTROLLER_SOURCE_REVISION: sourceRevision,
      NUTSNEWS_EXPECTED_CONTROLLER_DEPLOYMENT_CORRELATION: correlation,
      NUTSNEWS_EXPECTED_CONTROLLER_VERSION_ID: "expected-version",
    },
  });

  assert.equal(result.exitCode, 1);
  assert(result.report.failedChecks.includes("controllerVersionMatches"));
});
