#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

const [action, orchestrationId, expectedBackendRevision, expectedWorkerRevision, outputPath] =
  process.argv.slice(2);
if (
  !new Set(["cutover", "rollback"]).has(action) ||
  !/^[0-9a-f]{40}$/.test(expectedBackendRevision ?? "") ||
  !/^[0-9a-f]{40}$/.test(expectedWorkerRevision ?? "") ||
  !outputPath
) {
  console.error(
    "Usage: verify-backend-transition-authorization.mjs <cutover|rollback> <orchestration-id> <backend-revision> <worker-revision> <output>",
  );
  process.exit(2);
}

const match = orchestrationId.match(
  new RegExp(`^backend-worker-uplift-${action}-([0-9]+)-([0-9]+)$`),
);
if (!match) throw new Error("backend orchestration ID is invalid");
const backendRunId = Number(match[1]);
const backendRunAttempt = Number(match[2]);
const apiBase = process.env.NUTSNEWS_GITHUB_API_BASE_URL || "https://api.github.com";
const workerRepositoryToken = process.env.GITHUB_TOKEN || "";
const backendActionsReadToken =
  process.env.NUTSNEWS_BACKEND_ACTIONS_READ_TOKEN || "";
const expectedArtifactName =
  `worker-controller-transition-authorization-${action}-${orchestrationId}-` +
  expectedWorkerRevision;

async function getJson(pathname, token = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "NutsNewsControllerTransitionAuthorization/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${apiBase}${pathname}`, {
      headers,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub metadata request failed with ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

const [run, jobs, artifacts, workerMainRef] = await Promise.all([
  getJson(
    `/repos/ramideltoro/nutsnews-backend/actions/runs/${backendRunId}`,
    backendActionsReadToken,
  ),
  getJson(
    `/repos/ramideltoro/nutsnews-backend/actions/runs/${backendRunId}/attempts/${backendRunAttempt}/jobs?per_page=100`,
    backendActionsReadToken,
  ),
  getJson(
    `/repos/ramideltoro/nutsnews-backend/actions/runs/${backendRunId}/artifacts?per_page=100`,
    backendActionsReadToken,
  ),
  getJson(
    "/repos/ramideltoro/nutsnews-worker/git/ref/heads/main",
    workerRepositoryToken,
  ),
]);
const authorizationJobs = (jobs.jobs ?? []).filter(
  (job) => job.name === `Authorize worker controller ${action} handoff`,
);
const protectedJobs = (jobs.jobs ?? []).filter(
  (job) => job.name === "Protected live control",
);
const authorizationArtifacts = (artifacts.artifacts ?? []).filter(
  (artifact) => artifact.name === expectedArtifactName,
);
const authorizationArtifact = authorizationArtifacts[0] ?? null;
const protectedOperationStep = protectedJobs[0]?.steps?.find(
  (step) => step.name === `Hold worker controller ${action} handoff`,
);
const ageSeconds = (Date.now() - Date.parse(run.run_started_at)) / 1000;
const artifactAgeSeconds =
  (Date.now() - Date.parse(authorizationArtifact?.created_at)) / 1000;
const checks = {
  backendRunIdentity:
    run.id === backendRunId && run.run_attempt === backendRunAttempt,
  backendWorkflowIdentity:
    run.name === "Backend Worker-Uplift Cutover Controls" &&
    run.path === ".github/workflows/backend-worker-uplift-cutover-controls.yml" &&
    run.event === "workflow_dispatch",
  backendRunName:
    run.display_title === `Backend Worker-Uplift ${action} (${orchestrationId})`,
  backendSourceIdentity:
    run.head_branch === "main" && run.head_sha === expectedBackendRevision,
  backendActors:
    run.actor?.login === "ramideltoro" &&
    run.triggering_actor?.login === "ramideltoro",
  backendRunActive: run.status === "in_progress" && run.conclusion === null,
  backendRunFresh: Number.isFinite(ageSeconds) && ageSeconds >= -60 && ageSeconds <= 1800,
  workerMainSourceCurrent:
    workerMainRef?.ref === "refs/heads/main" &&
    workerMainRef?.object?.type === "commit" &&
    workerMainRef?.object?.sha === expectedWorkerRevision,
  authorizationJobPassed:
    authorizationJobs.length === 1 &&
    authorizationJobs[0].status === "completed" &&
    authorizationJobs[0].conclusion === "success",
  protectedControlActive:
    protectedJobs.length === 1 &&
    protectedJobs[0].status === "in_progress" &&
    protectedJobs[0].conclusion === null &&
    protectedOperationStep?.status === "in_progress" &&
    protectedOperationStep?.conclusion === null,
  authorizationArtifactUnique: authorizationArtifacts.length === 1,
  authorizationArtifactValid:
    authorizationArtifact?.expired === false &&
    Number.isInteger(authorizationArtifact?.id) &&
    authorizationArtifact.id > 0 &&
    Number.isInteger(authorizationArtifact?.size_in_bytes) &&
    authorizationArtifact.size_in_bytes > 0 &&
    authorizationArtifact.size_in_bytes <= 131_072 &&
    /^sha256:[0-9a-f]{64}$/.test(authorizationArtifact?.digest ?? "") &&
    Number.isFinite(artifactAgeSeconds) &&
    artifactAgeSeconds >= -60 &&
    artifactAgeSeconds <= 1800 &&
    authorizationArtifact?.workflow_run?.id === backendRunId &&
    authorizationArtifact?.workflow_run?.head_branch === "main" &&
    authorizationArtifact?.workflow_run?.head_sha === expectedBackendRevision,
};
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name);
const report = {
  schemaVersion: 1,
  safeMetadataOnly: true,
  status: failedChecks.length === 0 ? "authorized" : "denied",
  checkedAt: new Date().toISOString(),
  action,
  orchestrationId,
  backendRepository: "ramideltoro/nutsnews-backend",
  backendWorkflowPath: ".github/workflows/backend-worker-uplift-cutover-controls.yml",
  backendRunId,
  backendRunAttempt,
  backendSourceRevision: run.head_sha ?? null,
  expectedBackendSourceRevision: expectedBackendRevision,
  backendActor: run.actor?.login ?? null,
  backendTriggeringActor: run.triggering_actor?.login ?? null,
  expectedWorkerSourceRevision: expectedWorkerRevision,
  workerMainSourceRevision: workerMainRef?.object?.sha ?? null,
  authorizationArtifactId: authorizationArtifact?.id ?? null,
  authorizationArtifactName: authorizationArtifact?.name ?? null,
  authorizationArtifactDigest: authorizationArtifact?.digest ?? null,
  authorizationArtifactSizeBytes: authorizationArtifact?.size_in_bytes ?? null,
  checks,
  failedChecks,
};
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify(report));
if (failedChecks.length > 0) process.exit(1);
