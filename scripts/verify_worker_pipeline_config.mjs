#!/usr/bin/env node
import fs from 'node:fs';

function assertIncludes(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label} is missing required text: ${needle}`);
  }
}

function assertFile(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
}

const workflowPath = '.github/workflows/worker-pipeline.yml';
const manifestPath = '.github/worker-pipeline-immutable.manifest';

assertFile(workflowPath);
assertFile(manifestPath);
assertFile('scripts/check_worker_pipeline_immutable.mjs');
assertFile('scripts/verify_worker_pipeline_config.mjs');
assertFile('scripts/deploy_worker_shards.mjs');
assertFile('docs/WORKER_GITHUB_ACTIONS_PIPELINE.md');

const workflow = fs.readFileSync(workflowPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');

for (const fragment of [
  'pull_request:',
  'push:',
  'workflow_dispatch:',
  'main',
  'master',
  'Worker pipeline tests',
  'Deploy Workers to Cloudflare',
  'needs: ci',
  "github.event_name == 'push'",
  "github.ref == 'refs/heads/main'",
  "github.ref == 'refs/heads/master'",
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'NUTSNEWS_SECRETS_STORE_ID',
  'NUTSNEWS_KV_NAMESPACE_ID',
  'LOCAL_AI_URL',
  'NUTSNEWS_WORKER_DEPLOY_CONCURRENCY: "1"',
  'NUTSNEWS_PRODUCTION_WRITES_PAUSED',
  'npm run check:local-ai-config',
  'npx tsc --noEmit',
  'Controller syntax check',
  'node scripts/check_worker_pipeline_immutable.mjs',
  'node scripts/verify_worker_pipeline_config.mjs',
  'node scripts/assert_worker_local_ai_lock.mjs',
  'node scripts/worker_offline_e2e_regression.mjs',
  'node scripts/deploy_worker_shards.mjs',
  'npx wrangler deploy',
]) {
  assertIncludes(workflowPath, workflow, fragment);
}

for (const protectedPath of [
  '.github/worker-pipeline-immutable.manifest',
  '.github/workflows/worker-pipeline.yml',
  'scripts/check_worker_pipeline_immutable.mjs',
  'scripts/verify_worker_pipeline_config.mjs',
  'scripts/deploy_worker_shards.mjs',
]) {
  assertIncludes(manifestPath, manifest, protectedPath);
}

console.log('Worker pipeline config regression passed. PR tests and post-merge Cloudflare deploy are guarded.');
