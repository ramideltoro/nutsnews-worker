#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const workerDir = path.join(repoRoot, 'worker');
const generatorPath = path.join(workerDir, 'scripts', 'generate-wrangler-config.mjs');
const verifierPath = path.join(workerDir, 'scripts', 'verify-local-ai-wrangler-config.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nutsnews-local-ai-lock-'));
const generatedDir = path.join(tempRoot, 'generated-wrangler');

const cleanLocalAiEnv = {
	AI_PROVIDER: 'local',
	AI_PROVIDER_FALLBACK_TO_OPENAI: 'false',
	ENABLE_LOCAL_AI_SECRET_BINDING: 'true',
	LOCAL_AI_API_KEY_SECRET_NAME: 'LOCAL_AI_API_KEY',
	LOCAL_AI_MODEL: 'qwen2.5:3b',
	NUTSNEWS_ALLOW_OPENAI_ONLY_DEPLOYMENT: 'false',
	NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT: 'false',
};

function assert(condition, message, details = undefined) {
	if (!condition) {
		const error = new Error(message);
		if (details !== undefined) {
			error.details = details;
		}
		throw error;
	}
}

function readShardConfigs() {
	return fs
		.readdirSync(generatedDir)
		.filter((name) => /^wrangler\.shard\d+\.jsonc$/.test(name))
		.sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0))
		.map((name) => ({ name, config: JSON.parse(fs.readFileSync(path.join(generatedDir, name), 'utf8')) }));
}

function runGenerator(envOverrides) {
	return execFileSync('node', [generatorPath], {
		cwd: workerDir,
		env: {
			...process.env,
			...cleanLocalAiEnv,
			NUTSNEWS_SECRETS_STORE_ID: '00000000000000000000000000000000',
			NUTSNEWS_KV_NAMESPACE_ID: '11111111111111111111111111111111',
			NUTSNEWS_GENERATED_WRANGLER_DIR: generatedDir,
			...envOverrides,
		},
		encoding: 'utf8',
	});
}

try {
	console.log('▶ Checking generator refuses local-AI deploys without LOCAL_AI_URL');
	const missingLocalUrl = spawnSync('node', [generatorPath], {
		cwd: workerDir,
		env: {
			...process.env,
			...cleanLocalAiEnv,
			LOCAL_AI_URL: '',
			NUTSNEWS_SECRETS_STORE_ID: '00000000000000000000000000000000',
			NUTSNEWS_KV_NAMESPACE_ID: '11111111111111111111111111111111',
			NUTSNEWS_GENERATED_WRANGLER_DIR: path.join(tempRoot, 'missing-local-url'),
		},
		encoding: 'utf8',
	});
	assert(missingLocalUrl.status !== 0, 'Generator unexpectedly allowed a local-AI deployment without LOCAL_AI_URL.');
	assert(
		`${missingLocalUrl.stderr}\n${missingLocalUrl.stdout}`.includes('LOCAL_AI_URL'),
		'Generator failure did not explain that LOCAL_AI_URL is required.',
		{ stdout: missingLocalUrl.stdout, stderr: missingLocalUrl.stderr },
	);
	console.log('✓ Missing LOCAL_AI_URL is blocked');

	console.log('▶ Checking generator writes local-AI-first-with-openai-fallback shard configs by default');
	runGenerator({
		LOCAL_AI_URL: 'https://local-ai.example.com',
	});

	const configs = readShardConfigs();
	assert(configs.length === 25, `Expected 25 generated shard configs, got ${configs.length}.`);

	for (const { name, config } of configs) {
		const vars = config.vars ?? {};
		const secretBindings = new Set((config.secrets_store_secrets ?? []).map((entry) => entry.binding));
		assert(vars.AI_PROVIDER === 'local', `${name} does not force AI_PROVIDER=local.`, vars);
		assert(vars.LOCAL_AI_URL === 'https://local-ai.example.com', `${name} is missing the local AI URL.`, vars);
		assert(vars.LOCAL_AI_MODEL === 'qwen2.5:3b', `${name} changed the default local AI model.`, vars);
		assert(vars.AI_PROVIDER_FALLBACK_TO_OPENAI === 'false', `${name} allows silent OpenAI fallback.`, vars);
		assert(vars.AI_REVIEW_CONCURRENCY === '1', `${name} should keep local AI review concurrency at 1.`, vars);
		assert(secretBindings.has('LOCAL_AI_API_KEY'), `${name} is missing the LOCAL_AI_API_KEY secret binding.`, config.secrets_store_secrets);
	}
	console.log('✓ Generated shard configs are locked to local AI first with OpenAI fallback');

	console.log('▶ Checking local-AI verifier accepts the generated configs');
	execFileSync('node', [verifierPath], {
		cwd: workerDir,
		env: {
			...process.env,
			NUTSNEWS_GENERATED_WRANGLER_DIR: generatedDir,
		},
		stdio: 'inherit',
	});
	console.log('✓ Local-AI config verifier passed');

	console.log('\n✅ Worker local-AI deployment lock regression passed.');
} catch (error) {
	console.error('\n❌ Worker local-AI deployment lock regression failed.');
	console.error(error?.stack || error?.message || error);
	if (error?.details !== undefined) {
		console.error(JSON.stringify(error.details, null, 2));
	}
	process.exitCode = 1;
} finally {
	fs.rmSync(tempRoot, { recursive: true, force: true });
}
