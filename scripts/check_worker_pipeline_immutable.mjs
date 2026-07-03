#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = path.join(repoRoot, '.github', 'worker-pipeline-immutable.manifest');
const approvalEnv = 'NUTSNEWS_APPROVE_PIPELINE_TEST_CHANGES';

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.allowFailure ? 'pipe' : 'inherit'],
  });
}

function hasRef(ref) {
  try {
    runGit(['rev-parse', '--verify', ref], { allowFailure: true });
    return true;
  } catch {
    return false;
  }
}

function getBaseRef() {
  if (process.env.NUTSNEWS_PIPELINE_IMMUTABLE_BASE_REF) {
    return process.env.NUTSNEWS_PIPELINE_IMMUTABLE_BASE_REF;
  }

  if (process.env.GITHUB_BASE_REF) {
    const remoteRef = `origin/${process.env.GITHUB_BASE_REF}`;
    return hasRef(remoteRef) ? remoteRef : process.env.GITHUB_BASE_REF;
  }

  if (hasRef('origin/main')) return 'origin/main';
  if (hasRef('origin/master')) return 'origin/master';
  if (hasRef('HEAD~1')) return 'HEAD~1';
  return null;
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing immutable pipeline manifest: ${path.relative(repoRoot, manifestPath)}`);
  }

  return new Set(
    fs
      .readFileSync(manifestPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  );
}

const immutablePaths = readManifest();

if (process.env[approvalEnv] === 'true') {
  console.log(`Worker pipeline immutable guard bypassed because ${approvalEnv}=true.`);
  process.exit(0);
}

const baseRef = getBaseRef();
if (!baseRef) {
  console.log('Worker pipeline immutable guard skipped because no git base ref is available.');
  process.exit(0);
}

const diffOutput = runGit(['diff', '--name-status', `${baseRef}...HEAD`], { allowFailure: true }).trim();
if (!diffOutput) {
  console.log('Worker pipeline immutable guard passed: no files changed.');
  process.exit(0);
}

const diffLines = diffOutput.split(/\r?\n/);
const introducedInThisDiff = new Set(
  diffLines
    .filter((line) => line.startsWith('A\t'))
    .map((line) => line.split(/\t+/).at(-1))
    .filter(Boolean),
);

const blocked = [];
for (const line of diffLines) {
  const [status, ...paths] = line.split(/\t+/);
  const changedPath = paths.at(-1);
  if (!changedPath || !immutablePaths.has(changedPath)) {
    continue;
  }

  // The first PR is allowed to add the guardrails. After merge, any edit/delete/rename is blocked.
  if (status === 'A' && introducedInThisDiff.has(changedPath)) {
    continue;
  }

  blocked.push(`${status}\t${changedPath}`);
}

if (blocked.length > 0) {
  console.error('Worker pipeline immutable guard failed. These CI/deploy guardrails are marked non-modifiable:');
  for (const item of blocked) {
    console.error(`- ${item}`);
  }
  console.error(`Set ${approvalEnv}=true only after explicit owner approval.`);
  process.exit(1);
}

console.log('Worker pipeline immutable guard passed.');
