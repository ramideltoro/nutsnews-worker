#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeFiles = [
  'worker/src/index.ts',
  'worker/src/logger.ts',
  'controller/src/index.ts',
  'controller/src/logger.ts',
];

const failures = [];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

for (const file of runtimeFiles) {
  const text = read(file);
  if (/\.\s*list\s*\(/.test(text)) {
    failures.push(`${file} uses KV-style .list() in runtime source. Runtime hot paths must not list KV keys.`);
  }
}

const loggerText = read('worker/src/logger.ts');
if (/NUTSNEWS_KV|KVNamespace|\.\s*(getWithMetadata|put|delete|list)\s*\(/.test(loggerText)) {
  failures.push('worker/src/logger.ts must not use KV. Buffered logging may only write to console and Better Stack flushes.');
}

const workerText = read('worker/src/index.ts');
for (const required of [
  'type KvOperationCounts',
  'getKvOperationCounts',
  'readCacheHits',
  'writeSkips',
  'rateLimitedFailures',
  'kvOperationCounts',
]) {
  if (!workerText.includes(required)) {
    failures.push(`worker/src/index.ts is missing KV usage instrumentation marker: ${required}`);
  }
}

if (failures.length > 0) {
  console.error('Worker KV usage regression check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Worker KV usage regression check passed.');
