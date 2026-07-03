#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const workerDir = path.join(repoRoot, 'worker');
const generatedDir = path.resolve(workerDir, process.env.NUTSNEWS_GENERATED_WRANGLER_DIR ?? 'generated-wrangler');
const concurrency = Math.max(1, Math.min(25, Number(process.env.NUTSNEWS_WORKER_DEPLOY_CONCURRENCY ?? '5') || 5));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sortShardConfigs(files) {
  return [...files].sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));
}

function runWranglerDeploy(configPath) {
  return new Promise((resolve) => {
    const relativeConfig = path.relative(workerDir, configPath);
    console.log(`\n▶ Deploying ${relativeConfig}`);

    const child = spawn('npx', ['wrangler', 'deploy', '-c', relativeConfig], {
      cwd: workerDir,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('exit', (code, signal) => resolve({ configPath, code: code ?? 1, signal }));
    child.on('error', (error) => {
      console.error(`Failed to start Wrangler for ${relativeConfig}:`, error);
      resolve({ configPath, code: 1, signal: null });
    });
  });
}

async function runPool(configPaths) {
  const failures = [];
  let nextIndex = 0;

  async function worker(workerIndex) {
    while (nextIndex < configPaths.length) {
      const configPath = configPaths[nextIndex];
      nextIndex += 1;
      const result = await runWranglerDeploy(configPath);
      if (result.code !== 0) {
        failures.push(result);
        console.error(`✗ Deploy failed for ${path.relative(workerDir, result.configPath)} with exit code ${result.code}.`);
      } else {
        console.log(`✓ Deploy finished for ${path.relative(workerDir, result.configPath)}.`);
      }
    }
    console.log(`Deploy worker ${workerIndex + 1} finished.`);
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, configPaths.length) }, (_, index) => worker(index)));
  return failures;
}

try {
  assert(fs.existsSync(generatedDir), `Generated Wrangler directory not found: ${generatedDir}. Run npm run check:local-ai-config first.`);

  const files = sortShardConfigs(
    fs.readdirSync(generatedDir).filter((name) => /^wrangler\.shard\d+\.jsonc$/.test(name)),
  );

  assert(files.length > 0, `No generated shard configs found in ${generatedDir}.`);

  const configPaths = files.map((name) => path.join(generatedDir, name));
  console.log(`Deploying ${configPaths.length} Worker shards with concurrency=${concurrency}.`);
  const failures = await runPool(configPaths);

  if (failures.length > 0) {
    console.error('\nWorker shard deployment failed:');
    for (const failure of failures) {
      console.error(`- ${path.relative(workerDir, failure.configPath)} exited with code ${failure.code}`);
    }
    process.exit(1);
  }

  console.log('\n✅ All Worker shards deployed.');
} catch (error) {
  console.error('\n❌ Worker shard deployment failed before completion.');
  console.error(error?.stack || error?.message || error);
  process.exit(1);
}
