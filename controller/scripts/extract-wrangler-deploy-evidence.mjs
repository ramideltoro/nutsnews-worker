#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

const [inputPath, outputPath, githubOutputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error(
    "Usage: extract-wrangler-deploy-evidence.mjs <wrangler-ndjson> <output> [github-output]",
  );
  process.exit(2);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const records = fs
  .readFileSync(inputPath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const deployments = records.filter((record) => record?.type === "deploy");
if (deployments.length !== 1) {
  throw new Error("Wrangler evidence must contain exactly one completed deploy record");
}
const deployment = deployments[0];
const targets = Array.isArray(deployment.targets) ? [...deployment.targets].sort() : [];
if (
  deployment.version !== 1 ||
  deployment.worker_name !== "nutsnews-controller" ||
  !/^[A-Za-z0-9._-]{1,128}$/.test(deployment.version_id ?? "") ||
  !/^https:\/\//.test(targets[0] ?? "") ||
  Number.isNaN(Date.parse(deployment.timestamp))
) {
  throw new Error("Wrangler deploy record is incomplete or invalid");
}

const evidence = {
  schemaVersion: 1,
  safeMetadataOnly: true,
  status: "pass",
  workerName: deployment.worker_name,
  versionId: deployment.version_id,
  deployedAt: deployment.timestamp,
  targetCount: targets.length,
  targetsSha256: sha256(JSON.stringify(targets)),
};
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
if (githubOutputPath) {
  fs.appendFileSync(githubOutputPath, `wrangler_version_id=${evidence.versionId}\n`, {
    encoding: "utf8",
  });
}
console.log(JSON.stringify(evidence));
