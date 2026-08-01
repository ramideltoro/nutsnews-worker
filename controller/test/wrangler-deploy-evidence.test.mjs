import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const controllerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(controllerRoot, "scripts/extract-wrangler-deploy-evidence.mjs");

test("extracts a bounded Cloudflare version receipt from Wrangler NDJSON", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nutsnews-wrangler-evidence-"));
  const input = path.join(directory, "input.ndjson");
  const output = path.join(directory, "output.json");
  const githubOutput = path.join(directory, "github-output.txt");
  fs.writeFileSync(
    input,
    `${JSON.stringify({ type: "wrangler-session", version: 1 })}\n${JSON.stringify({
      type: "deploy",
      version: 1,
      worker_name: "nutsnews-controller",
      version_id: "97108b3d-1111-2222-3333-444444444444",
      targets: ["https://nutsnews-controller.nutsnews.workers.dev"],
      timestamp: "2026-08-01T19:01:23.303Z",
    })}\n`,
  );

  try {
    const result = spawnSync(process.execPath, [script, input, output, githubOutput], {
      cwd: controllerRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(evidence.status, "pass");
    assert.equal(evidence.workerName, "nutsnews-controller");
    assert.equal(evidence.versionId, "97108b3d-1111-2222-3333-444444444444");
    assert.equal(
      fs.readFileSync(githubOutput, "utf8"),
      "wrangler_version_id=97108b3d-1111-2222-3333-444444444444\n",
    );
    assert.match(evidence.targetsSha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
