import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const controllerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptScript = path.join(
  controllerRoot,
  "scripts",
  "build-ingestion-scheduling-transition-receipt.mjs",
);
const sourceRevision = "a".repeat(40);
const backendRevision = "e".repeat(40);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function passingEnvelope(values) {
  return {
    schemaVersion: 1,
    safeMetadataOnly: true,
    status: "pass",
    checks: { stableReadback: true },
    failedChecks: [],
    ...values,
  };
}

function runReceipt(action, overrides = {}) {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "nutsnews-ingestion-transition-receipt-"),
  );
  const contractKind =
    overrides.contractKind ?? "backend_authorized";
  const invocationAction =
    overrides.invocationAction ?? (contractKind === "backend_authorized" ? action : "apply");
  const resolutionMode = overrides.resolutionMode ?? "apply";
  const previousEnabled = action === "cutover";
  const desiredEnabled = !previousEnabled;
  const beforeEnabled =
    resolutionMode === "apply" ? previousEnabled : desiredEnabled;
  const orchestrationId =
    overrides.orchestrationId ??
    (contractKind === "backend_authorized"
      ? `backend-worker-uplift-${action}-12345-2`
      : "legacy-worker-uplift-rollback-67890-2");
  const renderedConfig = '{"vars":{"INGESTION_SCHEDULING_ENABLED":"test"}}\n';
  const paths = Object.fromEntries(
    [
      "before",
      "render",
      "after",
      "config",
      "deployment",
      "authorization",
      "receipt",
    ].map((name) => [name, path.join(tempDirectory, `${name}.json`)]),
  );
  const before = passingEnvelope({
    expectedIngestionSchedulingEnabled: beforeEnabled,
    observedIngestionSchedulingEnabled: beforeEnabled,
    observedControllerSourceRevision:
      resolutionMode === "reconcile_existing_state" ? sourceRevision : "9".repeat(40),
    observedControllerDeploymentCorrelation:
      resolutionMode === "reconcile_existing_state"
        ? orchestrationId
        : "previous-deployment",
    statusContractSha256: "b".repeat(64),
    ...overrides.before,
  });
  const render = {
    schemaVersion: 1,
    safeMetadataOnly: true,
    status: "pass",
    desiredIngestionSchedulingEnabled: desiredEnabled,
    controllerSourceRevision: sourceRevision,
    deploymentCorrelation: orchestrationId,
    deploymentIdentityConfigured: true,
    protectedControllerScopeUnchanged: true,
    protectedControllerScopeSha256: "c".repeat(64),
    renderedConfigSha256: sha256(renderedConfig),
    preserves: { routes: true, bindings: true },
    ...overrides.render,
  };
  const after = passingEnvelope({
    expectedIngestionSchedulingEnabled: desiredEnabled,
    observedIngestionSchedulingEnabled: desiredEnabled,
    observedControllerSourceRevision: sourceRevision,
    observedControllerDeploymentCorrelation: orchestrationId,
    observedControllerVersionId: "version-123",
    statusContractSha256: "d".repeat(64),
    ...overrides.after,
  });
  const deployment = {
    schemaVersion: 1,
    safeMetadataOnly: true,
    status: "pass",
    workerName: "nutsnews-controller",
    versionId: "version-123",
    deployedAt: new Date().toISOString(),
    targetCount: 1,
    targetsSha256: "f".repeat(64),
    ...overrides.deployment,
  };
  const backendAuthorization = {
    schemaVersion: 1,
    safeMetadataOnly: true,
    status: "authorized",
    checkedAt: new Date().toISOString(),
    checks: {
      backendRunIdentity: true,
      backendActors: true,
      backendRunActive: true,
      authorizationJobPassed: true,
      protectedControlActive: true,
      workerMainSourceCurrent: true,
    },
    failedChecks: [],
    action,
    orchestrationId,
    expectedWorkerSourceRevision: sourceRevision,
    workerMainSourceRevision: sourceRevision,
    backendRepository: "ramideltoro/nutsnews-backend",
    backendWorkflowPath: ".github/workflows/backend-worker-uplift-cutover-controls.yml",
    backendRunId: 12345,
    backendRunAttempt: 2,
    backendSourceRevision: backendRevision,
    expectedBackendSourceRevision: backendRevision,
    backendActor: "ramideltoro",
    backendTriggeringActor: "ramideltoro",
    authorizationArtifactId: 7654,
    authorizationArtifactName:
      `worker-controller-transition-authorization-${action}-${orchestrationId}-` +
      sourceRevision,
    authorizationArtifactDigest: `sha256:${"1".repeat(64)}`,
  };
  const legacyAuthorization = {
    schemaVersion: 1,
    safeMetadataOnly: true,
    status: "authorized",
    checkedAt: new Date().toISOString(),
    checks: {
      rollbackOnly: true,
      sourceRefMain: true,
      sourceRevisionCurrent: true,
      actorsAuthorized: true,
      authorityUnexpired: true,
    },
    failedChecks: [],
    action: "rollback",
    invocationAction: "apply",
    contractKind: "legacy_rollback_compatibility",
    sourceRepository: "ramideltoro/nutsnews-worker",
    workflowRunId: "67890",
    workflowRunAttempt: "2",
    expectedWorkerSourceRevision: sourceRevision,
    workerMainSourceRevision: sourceRevision,
    actor: "ramideltoro",
    triggeringActor: "ramideltoro",
    authorityDeadline: "2026-08-03T21:00:00Z",
  };
  const authorization = {
    ...(contractKind === "backend_authorized"
      ? backendAuthorization
      : legacyAuthorization),
    ...overrides.authorization,
  };
  for (const [filePath, value] of [
    [paths.before, before],
    [paths.render, render],
    [paths.after, after],
    [paths.deployment, deployment],
    [paths.authorization, authorization],
  ]) {
    fs.writeFileSync(filePath, JSON.stringify(value));
  }
  fs.writeFileSync(paths.config, renderedConfig);

  const deploymentArgument =
    resolutionMode === "reconcile_existing_state" ? "none" : paths.deployment;
  const authorizationArgument = paths.authorization;

  try {
    const result = spawnSync(
      process.execPath,
      [
        receiptScript,
        action,
        invocationAction,
        contractKind,
        orchestrationId,
        sourceRevision,
        resolutionMode,
        paths.before,
        paths.render,
        paths.after,
        paths.config,
        deploymentArgument,
        authorizationArgument,
        paths.receipt,
      ],
      {
        cwd: controllerRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_REPOSITORY: "ramideltoro/nutsnews-worker",
          GITHUB_RUN_ATTEMPT: "2",
          GITHUB_RUN_ID: "67890",
          GITHUB_SHA: sourceRevision,
          GITHUB_ACTOR: "ramideltoro",
          GITHUB_TRIGGERING_ACTOR: "ramideltoro",
        },
      },
    );
    return {
      ...result,
      receipt: fs.existsSync(paths.receipt)
        ? JSON.parse(fs.readFileSync(paths.receipt, "utf8"))
        : null,
    };
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

for (const action of ["cutover", "rollback"]) {
  test(`${action} receipt binds backend authorization, deployment, and exact source`, () => {
    const result = runReceipt(action);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.receipt.status, "pass");
    assert.equal(result.receipt.action, action);
    assert.equal(result.receipt.contractKind, "backend_authorized");
    assert.equal(
      result.receipt.orchestrationId,
      `backend-worker-uplift-${action}-12345-2`,
    );
    assert.equal(result.receipt.expectedSourceRevision, sourceRevision);
    assert.equal(result.receipt.sourceRevision, sourceRevision);
    assert.equal(result.receipt.sourceRepository, "ramideltoro/nutsnews-worker");
    assert.equal(result.receipt.desiredIngestionSchedulingEnabled, action === "rollback");
    assert.equal(result.receipt.observedIngestionSchedulingEnabled, action === "rollback");
    assert.equal(result.receipt.wranglerVersionId, "version-123");
    assert.equal(result.receipt.backendSourceRevision, backendRevision);
    assert.match(result.receipt.controllerSourceTreeSha256, /^[a-f0-9]{64}$/);
    assert.match(result.receipt.deployedControllerSurfaceSha256, /^[a-f0-9]{64}$/);
  });
}

test("deprecated apply remains a bounded rollback-only compatibility receipt", () => {
  const result = runReceipt("rollback", {
    contractKind: "legacy_rollback_compatibility",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.receipt.invocationAction, "apply");
  assert.equal(result.receipt.action, "rollback");
  assert.equal(result.receipt.contractKind, "legacy_rollback_compatibility");
  assert.equal(result.receipt.backendRunId, null);
});

test("an exact already-deployed identity reconciles without deploy evidence", () => {
  const result = runReceipt("cutover", {
    resolutionMode: "reconcile_existing_state",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.receipt.resolutionMode, "reconcile_existing_state");
  assert.equal(result.receipt.mutationPerformed, false);
  assert.equal(result.receipt.wranglerVersionId, "version-123");
});

test("a desired state with stale identity is rebound with deploy evidence", () => {
  const result = runReceipt("rollback", {
    resolutionMode: "rebind_desired_state",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.receipt.resolutionMode, "rebind_desired_state");
  assert.equal(result.receipt.mutationPerformed, true);
  assert.equal(result.receipt.wranglerVersionId, "version-123");
});

test("receipt generation rejects a failed or mismatched post-transition identity", () => {
  const result = runReceipt("cutover", {
    after: { observedControllerDeploymentCorrelation: "wrong-correlation" },
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.receipt, null);
  assert.match(result.stderr, /afterStateMatches/);
});
