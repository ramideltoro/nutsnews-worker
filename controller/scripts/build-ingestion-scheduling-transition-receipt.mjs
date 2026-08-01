#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function reportEnvelopeValid(report, expectedStatus = "pass") {
  return (
    report?.schemaVersion === 1 &&
    report?.safeMetadataOnly === true &&
    report?.status === expectedStatus
  );
}

function checksPassed(report) {
  return (
    report?.checks &&
    Object.keys(report.checks).length > 0 &&
    Object.values(report.checks).every((passed) => passed === true) &&
    Array.isArray(report.failedChecks) &&
    report.failedChecks.length === 0
  );
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    } else {
      throw new Error("controller source surface must not contain links or special files");
    }
  }
  return files.sort();
}

function sourceTreeSha256(controllerRoot) {
  const files = [
    ...listFiles(path.join(controllerRoot, "src")),
    path.join(controllerRoot, "package.json"),
    path.join(controllerRoot, "package-lock.json"),
    path.join(controllerRoot, "wrangler.jsonc"),
  ].sort();
  const hash = crypto.createHash("sha256");
  for (const filePath of files) {
    if (!fs.statSync(filePath).isFile()) {
      throw new Error("controller source surface contains a non-file");
    }
    hash.update(path.relative(controllerRoot, filePath).split(path.sep).join("/"));
    hash.update("\0");
    hash.update(fs.readFileSync(filePath));
    hash.update("\n");
  }
  return hash.digest("hex");
}

const [
  semanticAction,
  invocationAction,
  contractKind,
  orchestrationId,
  expectedSourceRevision,
  resolutionMode,
  beforeReportPath,
  renderReportPath,
  afterReportPath,
  renderedConfigPath,
  deploymentEvidencePath,
  backendAuthorizationPath,
  outputPath,
] = process.argv.slice(2);

if (
  !new Set(["cutover", "rollback"]).has(semanticAction) ||
  !new Set(["cutover", "rollback", "apply"]).has(invocationAction) ||
  !new Set(["backend_authorized", "legacy_rollback_compatibility"]).has(contractKind) ||
  !new Set(["apply", "rebind_desired_state", "reconcile_existing_state"]).has(
    resolutionMode,
  ) ||
  !orchestrationId ||
  !/^[0-9a-f]{40}$/.test(expectedSourceRevision ?? "") ||
  !beforeReportPath ||
  !renderReportPath ||
  !afterReportPath ||
  !renderedConfigPath ||
  !deploymentEvidencePath ||
  !backendAuthorizationPath ||
  !outputPath
) {
  console.error(
    "Usage: build-ingestion-scheduling-transition-receipt.mjs <semantic-action> <invocation-action> <contract-kind> <orchestration-id> <source-revision> <resolution-mode> <before-report> <render-report> <after-report> <rendered-config> <deployment-evidence|none> <backend-authorization|none> <output>",
  );
  process.exit(2);
}

const expectedOrchestrationPattern =
  contractKind === "backend_authorized"
    ? new RegExp(`^backend-worker-uplift-${semanticAction}-[0-9]+-[0-9]+$`)
    : /^legacy-worker-uplift-rollback-[0-9]+-[0-9]+$/;
if (!expectedOrchestrationPattern.test(orchestrationId)) {
  throw new Error("transition orchestration ID does not match the semantic action");
}

const sourceRevision = process.env.GITHUB_SHA ?? "";
if (sourceRevision !== expectedSourceRevision) {
  throw new Error("transition receipt source revision does not match the executing revision");
}
if (process.env.GITHUB_REPOSITORY !== "ramideltoro/nutsnews-worker") {
  throw new Error("transition receipt repository identity is invalid");
}
if (
  !/^[0-9]+$/.test(process.env.GITHUB_RUN_ID ?? "") ||
  !/^[0-9]+$/.test(process.env.GITHUB_RUN_ATTEMPT ?? "")
) {
  throw new Error("transition receipt workflow identity is invalid");
}

const before = readJson(beforeReportPath);
const render = readJson(renderReportPath);
const after = readJson(afterReportPath);
const deploymentEvidenceRaw =
  deploymentEvidencePath === "none"
    ? null
    : fs.readFileSync(deploymentEvidencePath, "utf8");
const backendAuthorizationRaw =
  backendAuthorizationPath === "none"
    ? null
    : fs.readFileSync(backendAuthorizationPath, "utf8");
const deploymentEvidence =
  deploymentEvidenceRaw === null ? null : JSON.parse(deploymentEvidenceRaw);
const backendAuthorization =
  backendAuthorizationRaw === null ? null : JSON.parse(backendAuthorizationRaw);
const previousEnabled = semanticAction === "cutover";
const desiredEnabled = !previousEnabled;
const beforeEnabled = before.observedIngestionSchedulingEnabled;
const deploymentRequired = resolutionMode !== "reconcile_existing_state";
const beforeIdentityMatches =
  before.observedControllerSourceRevision === sourceRevision &&
  before.observedControllerDeploymentCorrelation === orchestrationId;
const authorizationAgeSeconds =
  (Date.now() - Date.parse(backendAuthorization?.checkedAt)) / 1000;
const deploymentAgeSeconds =
  (Date.now() - Date.parse(deploymentEvidence?.deployedAt)) / 1000;
const backendOrchestrationMatch = orchestrationId.match(
  /^backend-worker-uplift-(?:cutover|rollback)-([0-9]+)-([0-9]+)$/,
);
const expectedBackendRunId = Number(backendOrchestrationMatch?.[1]);
const expectedBackendRunAttempt = Number(backendOrchestrationMatch?.[2]);
const expectedAuthorizationArtifactName =
  `worker-controller-transition-authorization-${semanticAction}-${orchestrationId}-` +
  sourceRevision;
const checks = {
  invocationContract:
    (contractKind === "backend_authorized" && invocationAction === semanticAction) ||
    (contractKind === "legacy_rollback_compatibility" &&
      invocationAction === "apply" &&
      semanticAction === "rollback"),
  beforePassed: reportEnvelopeValid(before) && checksPassed(before),
  beforeStateMatches:
    before.expectedIngestionSchedulingEnabled === beforeEnabled &&
    (beforeEnabled === previousEnabled || beforeEnabled === desiredEnabled),
  resolutionMatches:
    (resolutionMode === "apply" && beforeEnabled === previousEnabled) ||
    (resolutionMode === "rebind_desired_state" &&
      beforeEnabled === desiredEnabled &&
      !beforeIdentityMatches) ||
    (resolutionMode === "reconcile_existing_state" &&
      beforeEnabled === desiredEnabled &&
      beforeIdentityMatches),
  renderPassed: reportEnvelopeValid(render),
  renderDesiredStateMatches:
    render.desiredIngestionSchedulingEnabled === desiredEnabled &&
    render.controllerSourceRevision === sourceRevision &&
    render.deploymentCorrelation === orchestrationId &&
    render.deploymentIdentityConfigured === true,
  protectedControllerScopeUnchanged:
    render.protectedControllerScopeUnchanged === true &&
    /^[0-9a-f]{64}$/.test(render.protectedControllerScopeSha256 ?? "") &&
    Object.keys(render.preserves ?? {}).length > 0 &&
    Object.values(render.preserves ?? {}).every((preserved) => preserved === true),
  afterPassed: reportEnvelopeValid(after) && checksPassed(after),
  afterStateMatches:
    after.expectedIngestionSchedulingEnabled === desiredEnabled &&
    after.observedIngestionSchedulingEnabled === desiredEnabled &&
    after.observedControllerSourceRevision === sourceRevision &&
    after.observedControllerDeploymentCorrelation === orchestrationId &&
    (!deploymentRequired ||
      after.observedControllerVersionId === deploymentEvidence?.versionId),
  statusContractDigestsValid:
    /^[0-9a-f]{64}$/.test(before.statusContractSha256 ?? "") &&
    /^[0-9a-f]{64}$/.test(after.statusContractSha256 ?? ""),
  renderedConfigDigestMatches:
    sha256(fs.readFileSync(renderedConfigPath)) === render.renderedConfigSha256,
  deploymentEvidenceMatches:
    deploymentRequired === (deploymentEvidence !== null) &&
    (!deploymentRequired ||
      (reportEnvelopeValid(deploymentEvidence) &&
        deploymentEvidence.workerName === "nutsnews-controller" &&
        /^[A-Za-z0-9._-]{1,128}$/.test(deploymentEvidence.versionId ?? "") &&
        Number.isFinite(deploymentAgeSeconds) &&
        deploymentAgeSeconds >= -60 &&
        deploymentAgeSeconds <= 900 &&
        Number.isInteger(deploymentEvidence.targetCount) &&
        deploymentEvidence.targetCount > 0 &&
        /^[0-9a-f]{64}$/.test(deploymentEvidence.targetsSha256 ?? ""))),
  backendAuthorizationMatches:
    Number.isFinite(authorizationAgeSeconds) &&
    authorizationAgeSeconds >= -60 &&
    authorizationAgeSeconds <= 900 &&
    ((contractKind === "legacy_rollback_compatibility" &&
      reportEnvelopeValid(backendAuthorization, "authorized") &&
      checksPassed(backendAuthorization) &&
      backendAuthorization.action === "rollback" &&
      backendAuthorization.invocationAction === "apply" &&
      backendAuthorization.contractKind === "legacy_rollback_compatibility" &&
      backendAuthorization.sourceRepository === "ramideltoro/nutsnews-worker" &&
      backendAuthorization.workflowRunId === process.env.GITHUB_RUN_ID &&
      backendAuthorization.workflowRunAttempt === process.env.GITHUB_RUN_ATTEMPT &&
      backendAuthorization.expectedWorkerSourceRevision === sourceRevision &&
      backendAuthorization.workerMainSourceRevision === sourceRevision &&
      backendAuthorization.actor === "ramideltoro" &&
      backendAuthorization.triggeringActor === "ramideltoro" &&
      backendAuthorization.authorityDeadline === "2026-08-03T21:00:00Z" &&
      backendAuthorization.checkedAt <= backendAuthorization.authorityDeadline) ||
    (contractKind === "backend_authorized" &&
      reportEnvelopeValid(backendAuthorization, "authorized") &&
      checksPassed(backendAuthorization) &&
      backendAuthorization.action === semanticAction &&
      backendAuthorization.orchestrationId === orchestrationId &&
      backendAuthorization.backendRepository === "ramideltoro/nutsnews-backend" &&
      backendAuthorization.backendWorkflowPath ===
        ".github/workflows/backend-worker-uplift-cutover-controls.yml" &&
      backendAuthorization.backendRunId === expectedBackendRunId &&
      backendAuthorization.backendRunAttempt === expectedBackendRunAttempt &&
      backendAuthorization.backendActor === "ramideltoro" &&
      backendAuthorization.backendTriggeringActor === "ramideltoro" &&
      backendAuthorization.expectedWorkerSourceRevision === sourceRevision &&
      backendAuthorization.workerMainSourceRevision === sourceRevision &&
      backendAuthorization.backendSourceRevision ===
        backendAuthorization.expectedBackendSourceRevision &&
      /^[0-9a-f]{40}$/.test(backendAuthorization.backendSourceRevision ?? "") &&
      backendAuthorization.authorizationArtifactName ===
        expectedAuthorizationArtifactName &&
      Number.isInteger(backendAuthorization.authorizationArtifactId) &&
      backendAuthorization.authorizationArtifactId > 0 &&
      backendAuthorization.checks.backendActors === true &&
      backendAuthorization.checks.backendRunActive === true &&
      backendAuthorization.checks.authorizationJobPassed === true &&
      backendAuthorization.checks.protectedControlActive === true &&
      backendAuthorization.checks.workerMainSourceCurrent === true &&
      /^sha256:[0-9a-f]{64}$/.test(
        backendAuthorization.authorizationArtifactDigest ?? "",
      ))),
  workflowActorsAuthorized:
    process.env.GITHUB_ACTOR === "ramideltoro" &&
    process.env.GITHUB_TRIGGERING_ACTOR === "ramideltoro",
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);
if (failedChecks.length > 0) {
  throw new Error(`transition receipt checks failed: ${failedChecks.join(",")}`);
}

const controllerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const controllerSourceTreeSha256 = sourceTreeSha256(controllerRoot);
const deployedControllerSurface = {
  controllerSourceTreeSha256,
  renderedConfigSha256: render.renderedConfigSha256,
  protectedControllerScopeSha256: render.protectedControllerScopeSha256,
  desiredIngestionSchedulingEnabled: desiredEnabled,
  deploymentCorrelation: orchestrationId,
  wranglerVersionId:
    deploymentEvidence?.versionId ?? after.observedControllerVersionId ?? null,
  wranglerDeploymentEvidenceSha256:
    deploymentEvidenceRaw === null ? null : sha256(deploymentEvidenceRaw),
  transitionAuthorizationSha256: sha256(backendAuthorizationRaw),
};
const receipt = {
  schemaVersion: 1,
  safeMetadataOnly: true,
  status: "pass",
  action: semanticAction,
  invocationAction,
  contractKind,
  resolutionMode,
  orchestrationId,
  sourceRepository: process.env.GITHUB_REPOSITORY ?? null,
  expectedSourceRevision,
  sourceRevision,
  workflowRunId: process.env.GITHUB_RUN_ID ?? null,
  workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  previousIngestionSchedulingEnabled: previousEnabled,
  desiredIngestionSchedulingEnabled: desiredEnabled,
  observedIngestionSchedulingEnabled: after.observedIngestionSchedulingEnabled,
  observedControllerSourceRevision: after.observedControllerSourceRevision,
  observedControllerDeploymentCorrelation:
    after.observedControllerDeploymentCorrelation,
  observedControllerVersionId: after.observedControllerVersionId ?? null,
  mutationPerformed: deploymentRequired,
  wranglerVersionId:
    deploymentEvidence?.versionId ?? after.observedControllerVersionId ?? null,
  controllerSourceTreeSha256,
  renderedConfigSha256: render.renderedConfigSha256,
  protectedControllerScopeSha256: render.protectedControllerScopeSha256,
  deployedControllerSurfaceSha256: sha256(JSON.stringify(deployedControllerSurface)),
  beforeStatusContractSha256: before.statusContractSha256,
  afterStatusContractSha256: after.statusContractSha256,
  backendRepository: backendAuthorization?.backendRepository ?? null,
  backendRunId: backendAuthorization?.backendRunId ?? null,
  backendRunAttempt: backendAuthorization?.backendRunAttempt ?? null,
  backendSourceRevision: backendAuthorization?.backendSourceRevision ?? null,
  backendAuthorizationArtifactId:
    backendAuthorization?.authorizationArtifactId ?? null,
  backendAuthorizationArtifactDigest:
    backendAuthorization?.authorizationArtifactDigest ?? null,
  transitionAuthorizationCheckedAt: backendAuthorization.checkedAt,
  legacyCompatibilityDeadline:
    backendAuthorization.authorityDeadline ?? null,
  checks,
};

fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify(receipt));
