#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const workerDir = path.join(repoRoot, 'worker');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nutsnews-shadow-smoke-config-'));
const generatedDir = path.join(tempRoot, 'generated-shadow-smoke');
const configPath = path.join(generatedDir, 'wrangler.shadow-smoke.jsonc');

function assert(condition, message, details = undefined) {
	if (!condition) {
		const error = new Error(message);
		if (details !== undefined) {
			error.details = details;
		}
		throw error;
	}
}

try {
	const result = spawnSync('npm', ['run', 'generate:shadow-smoke'], {
		cwd: workerDir,
		env: {
			...process.env,
			NUTSNEWS_SECRETS_STORE_ID: 'ci-shadow-smoke-secrets-store-id',
			NUTSNEWS_GENERATED_WRANGLER_DIR: generatedDir,
			NUTSNEWS_SHADOW_SMOKE_WORKER_NAME: 'nutsnews-worker-shadow-smoke-ci',
			NUTSNEWS_BACKEND_API_URL_SECRET_NAME: 'NONPROD_NUTSNEWS_BACKEND_API_URL',
			NUTSNEWS_BACKEND_API_TOKEN_SECRET_NAME: 'NONPROD_NUTSNEWS_BACKEND_API_TOKEN',
			NUTSNEWS_SHADOW_SMOKE_TOKEN_SECRET_NAME: 'NONPROD_NUTSNEWS_SHADOW_SMOKE_TOKEN',
			NUTSNEWS_KV_NAMESPACE_ID: '',
			NUTSNEWS_KV_PREVIEW_NAMESPACE_ID: '',
		},
		encoding: 'utf8',
	});

	assert(result.status === 0, `generate:shadow-smoke failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
	assert(fs.existsSync(configPath), `Missing generated config: ${configPath}`);

	const configText = fs.readFileSync(configPath, 'utf8');
	const config = JSON.parse(configText);
	const vars = config.vars ?? {};
	const secretBindings = new Map((config.secrets_store_secrets ?? []).map((entry) => [entry.binding, entry]));

	assert(config.name === 'nutsnews-worker-shadow-smoke-ci', 'Generated config uses the wrong Worker name.', config);
	assert(vars.NUTSNEWS_DATABASE_PROVIDER_MODE === 'backend_postgres_shadow', 'Shadow smoke config must use backend_postgres_shadow.', vars);
	assert(vars.ENABLE_BACKEND_SHADOW_SMOKE === 'true', 'Shadow smoke endpoint must be explicitly enabled.', vars);
	assert(vars.FEED_SHARD_INDEX === '0', 'Shadow smoke target should exercise shard 0 only.', vars);
	assert(vars.FEEDS_PER_SHARD === '1', 'Shadow smoke target should be bounded to one feed if a manual refresh is accidentally requested.', vars);
	assert(vars.UPSTASH_REDIS_ENABLED === 'false', 'Shadow smoke target should not require Redis.', vars);
	assert(!('SUPABASE_URL' in vars), 'Shadow smoke vars must not include SUPABASE_URL.', vars);
	assert(!('SUPABASE_SERVICE_ROLE_KEY' in vars), 'Shadow smoke vars must not include SUPABASE_SERVICE_ROLE_KEY.', vars);
	assert(!configText.includes('SUPABASE_URL'), 'Shadow smoke config must not bind SUPABASE_URL.');
	assert(!configText.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Shadow smoke config must not bind SUPABASE_SERVICE_ROLE_KEY.');
	assert(!('triggers' in config), 'Shadow smoke config must not include cron triggers.', config);
	assert(!('kv_namespaces' in config), 'Shadow smoke config should not require KV when NUTSNEWS_KV_NAMESPACE_ID is absent.', config);

	assert(secretBindings.get('NUTSNEWS_BACKEND_API_URL')?.secret_name === 'NONPROD_NUTSNEWS_BACKEND_API_URL', 'Backend API URL must bind from a non-production secret name.', config.secrets_store_secrets);
	assert(secretBindings.get('NUTSNEWS_BACKEND_API_TOKEN')?.secret_name === 'NONPROD_NUTSNEWS_BACKEND_API_TOKEN', 'Backend API token must bind from a non-production secret name.', config.secrets_store_secrets);
	assert(secretBindings.get('NUTSNEWS_SHADOW_SMOKE_TOKEN')?.secret_name === 'NONPROD_NUTSNEWS_SHADOW_SMOKE_TOKEN', 'Shadow smoke token must bind from a non-production secret name.', config.secrets_store_secrets);

	console.log('Worker shadow smoke config regression passed.');
} catch (error) {
	console.error('Worker shadow smoke config regression failed.');
	console.error(error?.stack || error?.message || error);
	if (error?.details !== undefined) {
		console.error(JSON.stringify(error.details, null, 2));
	}
	process.exitCode = 1;
} finally {
	fs.rmSync(tempRoot, { recursive: true, force: true });
}
