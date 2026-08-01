import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workerPipeline = fs.readFileSync(
  path.join(repositoryRoot, ".github/workflows/worker-pipeline.yml"),
  "utf8",
);
const schedulingOperations = fs.readFileSync(
  path.join(
    repositoryRoot,
    ".github/workflows/controller-ingestion-scheduling-operations.yml",
  ),
  "utf8",
);
const baseWranglerConfig = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "controller/wrangler.jsonc"), "utf8"),
);
const controllerPackage = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "controller/package.json"), "utf8"),
);

test("ordinary production deploys preserve rather than choose scheduling ownership", () => {
  assert.match(workerPipeline, /group: nutsnews-controller-production-deploy/);
  assert.match(workerPipeline, /queue: max/);
  assert.match(
    workerPipeline,
    /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/,
  );
  assert.doesNotMatch(
    workerPipeline,
    /github\.event_name == 'push'[\s\S]{0,120}refs\/heads\/master/,
  );
  assert.match(
    workerPipeline,
    /verify-ingestion-scheduling-status\.mjs \\\n+\s+preserve \\/,
  );
  assert.match(
    workerPipeline,
    /npx wrangler deploy -c wrangler\.ingestion-preserved\.generated\.jsonc/,
  );
  assert.doesNotMatch(workerPipeline, /^\s*run: npx wrangler deploy\s*$/m);
});

test("base controller configuration and runtime defaults fail closed", () => {
  assert.equal(baseWranglerConfig.vars.INGESTION_SCHEDULING_ENABLED, "false");
  assert.equal(baseWranglerConfig.version_metadata.binding, "CF_VERSION_METADATA");
  assert.equal(
    controllerPackage.scripts.deploy,
    "node scripts/refuse-direct-production-deploy.mjs",
  );
});

test("protected mutations distinguish cutover from rollback with fixed states", () => {
  const transitionJob = schedulingOperations.slice(
    schedulingOperations.indexOf("\n  transition:\n"),
  );
  for (const requiredText of [
    "- cutover",
    "- rollback",
    'expected="disable-legacy-for-worker-uplift-cutover"',
    'expected="restore-legacy-for-worker-uplift-rollback"',
    'desired="false"',
    'desired="true"',
    'previous="true"',
    'previous="false"',
    "backend-worker-uplift-$ACTION-",
    'EXPECTED_SOURCE_REVISION" != "$GITHUB_SHA"',
    "ENABLED: ${{ needs.validate.outputs.desired_enabled }}",
    "PREVIOUS_ENABLED: ${{ needs.validate.outputs.previous_enabled }}",
    "group: nutsnews-controller-production-deploy",
    "queue: max",
    "verify-backend-transition-authorization.mjs",
    "backend-transition-authorization-admission.json",
    "Revalidate exact transition authority at time of use",
    "transition-authorization.json",
    "GITHUB_TRIGGERING_ACTOR",
    "git ls-remote --refs origin refs/heads/main",
    "Executing worker revision is no longer current main.",
    'contract_kind="backend_authorized"',
    'contract_kind="legacy_rollback_compatibility"',
    "Deprecated apply compatibility permits rollback enablement only.",
    'compatibility_deadline="2026-08-03T21:00:00Z"',
    'GITHUB_ACTOR" != "ramideltoro"',
    'resolution_mode="reconcile_existing_state"',
    'resolution_mode="rebind_desired_state"',
    "NUTSNEWS_EXPECTED_CONTROLLER_SOURCE_REVISION",
    "NUTSNEWS_EXPECTED_CONTROLLER_DEPLOYMENT_CORRELATION",
    "WRANGLER_OUTPUT_FILE_PATH",
    "extract-wrangler-deploy-evidence.mjs",
    "build-ingestion-scheduling-transition-receipt.mjs",
    "controller-ingestion-scheduling-transition.json",
    "controller-ingestion-scheduling-${{ needs.validate.outputs.semantic_action }}-${{ needs.validate.outputs.orchestration_id }}-${{ github.run_id }}-${{ github.run_attempt }}",
  ]) {
    assert.ok(
      schedulingOperations.includes(requiredText),
      `missing protected scheduling contract fragment: ${requiredText}`,
    );
  }

  assert.match(
    schedulingOperations,
    /if \[ "\$ACTION" = "apply" \]; then[\s\S]*compatibility_deadline=/,
  );
  assert.match(
    schedulingOperations,
    /if \[ "\$ENABLED" != "true" \]; then[\s\S]*rollback enablement only/,
  );
  assert.doesNotMatch(transitionJob, /inputs\.ingestion_scheduling_enabled/);
  assert.ok(
    schedulingOperations.indexOf("Revalidate exact transition authority at time of use") <
      schedulingOperations.indexOf("Deploy exact controller transition"),
    "time-of-use authorization must immediately precede the mutation step",
  );
});
