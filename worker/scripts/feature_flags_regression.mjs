#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromWorker = createRequire(path.join(workerRoot, 'package.json'));
const ts = requireFromWorker('typescript');

function read(relativePath) {
	return fs.readFileSync(path.join(workerRoot, relativePath), 'utf8');
}

function loadTypeScriptModule(relativePath) {
	const filename = path.join(workerRoot, relativePath);
	const { outputText } = ts.transpileModule(read(relativePath), {
		fileName: filename,
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const module = { exports: {} };
	const wrapper = vm.runInThisContext(
		`(function (exports, require, module, __filename, __dirname) { ${outputText}\n})`,
		{ filename },
	);
	wrapper(module.exports, requireFromWorker, module, filename, path.dirname(filename));
	return module.exports;
}

function response(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

const { isRuntimeFeatureFlagEnabled } = loadTypeScriptModule('src/runtimeFeatureFlags.ts');
const storageConfig = {
	supabaseUrl: 'https://nutsnews.supabase.co',
	supabaseServiceRoleKey: 'test-service-role-key',
};

assert.equal(
	await isRuntimeFeatureFlagEnabled(
		'worker_public_feed_edge_snapshot_publish',
		storageConfig,
		async () => response([{ enabled: true }]),
	),
	true,
);
assert.equal(
	await isRuntimeFeatureFlagEnabled(
		'worker_public_feed_edge_snapshot_publish',
		storageConfig,
		async () => response([{ enabled: false }]),
	),
	false,
);

let unknownKeyReadAttempted = false;
assert.equal(
	await isRuntimeFeatureFlagEnabled('unknown_flag', storageConfig, async () => {
		unknownKeyReadAttempted = true;
		return response([{ enabled: true }]);
	}),
	false,
);
assert.equal(unknownKeyReadAttempted, false);

assert.equal(
	await isRuntimeFeatureFlagEnabled(
		'worker_public_feed_edge_snapshot_publish',
		storageConfig,
		async () => {
			throw new Error('network unavailable');
		},
	),
	true,
);
assert.equal(
	await isRuntimeFeatureFlagEnabled(
		'worker_public_feed_edge_snapshot_publish',
		storageConfig,
		async () => response([{ enabled: 'yes' }]),
	),
	true,
);

const workerSource = read('src/index.ts');
assert(workerSource.includes("'worker_public_feed_edge_snapshot_publish'"));
assert(workerSource.includes('edgeSnapshotPublishingEnabled'));
assert(workerSource.includes('await publishPublicFeedEdgeSnapshotToKv(env, config, refreshedAt)'));

console.log('Worker runtime feature-flag regression checks passed.');
