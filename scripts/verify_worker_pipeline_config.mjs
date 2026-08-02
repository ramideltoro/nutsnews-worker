#!/usr/bin/env node
import fs from 'node:fs';

function assertIncludes(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label} is missing required text: ${needle}`);
  }
}

function assertExcludes(label, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${label} contains forbidden text: ${needle}`);
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
  'database_provider_mode:',
  'production_writes_paused:',
  'provider_switch_confirmation:',
  'main',
  'master',
  'Worker pipeline tests',
  'Deploy Workers to Cloudflare',
  'needs: ci',
  "github.event_name == 'push'",
  "github.ref == 'refs/heads/main'",
  "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'NUTSNEWS_SECRETS_STORE_ID',
  'NUTSNEWS_KV_NAMESPACE_ID',
  'LOCAL_AI_URL',
  'NUTSNEWS_WORKER_DEPLOY_CONCURRENCY: "1"',
  "inputs.database_provider_mode == 'backend_postgres_primary'",
  "inputs.provider_switch_confirmation == 'enable-backend-postgres-primary'",
  "inputs.database_provider_mode == 'supabase_primary'",
  "inputs.provider_switch_confirmation == 'deploy-supabase-primary'",
  'NUTSNEWS_DATABASE_PROVIDER_MODE',
  'NUTSNEWS_BACKEND_API_URL',
  'NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION',
  'NUTSNEWS_PRODUCTION_WRITES_PAUSED',
  'Validate production provider switch request',
  'backend_postgres_primary requires enable-backend-postgres-primary confirmation.',
  'SHARD_COUNT: "25"',
  'npm run check:local-ai-config',
  'npx tsc --noEmit',
  'Controller syntax check',
  'node scripts/check_worker_pipeline_immutable.mjs',
  'node scripts/verify_worker_pipeline_config.mjs',
  'node scripts/assert_worker_local_ai_lock.mjs',
  'node scripts/worker_offline_e2e_regression.mjs',
  'node scripts/deploy_worker_shards.mjs',
  'preserve',
  'nutsnews-controller-production-deploy',
  'queue: max',
  'wrangler.ingestion-preserved.generated.jsonc',
]) {
  assertIncludes(workflowPath, workflow, fragment);
}

for (const forbiddenFragment of [
  "github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')",
  'run: npx wrangler deploy\n',
]) {
  assertExcludes(workflowPath, workflow, forbiddenFragment);
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
