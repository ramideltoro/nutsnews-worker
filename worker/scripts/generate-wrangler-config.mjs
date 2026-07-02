import fs from 'node:fs';
import path from 'node:path';

function loadDeployEnvFile(filePath) {
	if (!fs.existsSync(filePath)) {
		return;
	}

	const text = fs.readFileSync(filePath, 'utf8');
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) {
			continue;
		}

		const [, key, rawValue] = match;
		if (process.env[key] !== undefined) {
			continue;
		}

		let value = rawValue.trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		process.env[key] = value;
	}
}

loadDeployEnvFile(path.resolve(process.cwd(), '..', '.env.deploy.local'));
loadDeployEnvFile(path.resolve(process.cwd(), '.env.deploy.local'));

const shardCount = Number(process.env.SHARD_COUNT ?? '25');
const feedsPerShard = Number(process.env.FEEDS_PER_SHARD ?? '20');
const secretsStoreId = process.env.NUTSNEWS_SECRETS_STORE_ID;
const includeLocalAiSecretBinding = process.env.ENABLE_LOCAL_AI_SECRET_BINDING === 'true';
const localAiApiKeySecretName = process.env.LOCAL_AI_API_KEY_SECRET_NAME ?? 'LOCAL_AI_API_KEY';
const wantsLocalAiFirst = process.env.AI_PROVIDER === 'local' || Boolean(process.env.LOCAL_AI_URL) || includeLocalAiSecretBinding;
const kvNamespaceId = process.env.NUTSNEWS_KV_NAMESPACE_ID;
const kvPreviewNamespaceId = process.env.NUTSNEWS_KV_PREVIEW_NAMESPACE_ID ?? kvNamespaceId;
const includeUpstashRedisSecretBindings = process.env.ENABLE_UPSTASH_REDIS_SECRET_BINDING === 'true';
const upstashRedisRestUrlSecretName = process.env.UPSTASH_REDIS_REST_URL_SECRET_NAME ?? 'UPSTASH_REDIS_REST_URL';
const upstashRedisRestTokenSecretName = process.env.UPSTASH_REDIS_REST_TOKEN_SECRET_NAME ?? 'UPSTASH_REDIS_REST_TOKEN';

const defaultTranslationVars = {
	ENABLED_SUMMARY_LANGUAGES: process.env.ENABLED_SUMMARY_LANGUAGES ?? 'fr,ja,de-CH,de,el',
	SUMMARY_TRANSLATION_LIMIT: process.env.SUMMARY_TRANSLATION_LIMIT ?? '5',
	HOLD_ARTICLES_FOR_TRANSLATIONS: process.env.HOLD_ARTICLES_FOR_TRANSLATIONS ?? 'true',
};

const optionalShardVars = Object.fromEntries(
	[
		'AI_PROVIDER',
		'LOCAL_AI_URL',
		'LOCAL_AI_MODEL',
		'AI_PROVIDER_FALLBACK_TO_OPENAI',
		'AI_REVIEW_CONCURRENCY',
		'KV_RECENT_PROCESSED_URL_LIMIT',
		'PUBLIC_FEED_EDGE_SNAPSHOT_LIMIT',
		'PUBLIC_FEED_EDGE_SNAPSHOT_TTL_SECONDS',
		'UPSTASH_REDIS_ENABLED',
		'UPSTASH_REDIS_WORKER_LOCK_TTL_SECONDS',
		'UPSTASH_REDIS_AI_REVIEW_LOCK_TTL_SECONDS',
		'UPSTASH_REDIS_MANUAL_RATE_LIMIT_MAX',
		'UPSTASH_REDIS_MANUAL_RATE_LIMIT_WINDOW_SECONDS',
		'UPSTASH_REDIS_COUNTER_TTL_SECONDS',
	]
		.filter((key) => process.env[key])
		.map((key) => [key, process.env[key]]),
);

if (!secretsStoreId) {
	throw new Error('Missing NUTSNEWS_SECRETS_STORE_ID.\nRun: export NUTSNEWS_SECRETS_STORE_ID="your-store-id"');
}

if (!kvNamespaceId) {
	throw new Error(
		'Missing NUTSNEWS_KV_NAMESPACE_ID.\n' +
			'Run: export NUTSNEWS_KV_NAMESPACE_ID="your-kv-namespace-id" before generating or deploying Workers.',
	);
}

if (wantsLocalAiFirst) {
	const missing = [];
	if (process.env.AI_PROVIDER !== 'local') {
		missing.push('AI_PROVIDER=local');
	}
	if (!process.env.LOCAL_AI_URL) {
		missing.push('LOCAL_AI_URL');
	}
	if (!includeLocalAiSecretBinding) {
		missing.push('ENABLE_LOCAL_AI_SECRET_BINDING=true');
	}

	if (missing.length > 0) {
		throw new Error(
			`Refusing to generate a partial local-AI deployment. Missing: ${missing.join(', ')}.\n` +
				'Create worker/.env.deploy.local or export the missing values before deploying.',
		);
	}
}

const generatedDir = path.join('generated-wrangler');

fs.mkdirSync(generatedDir, { recursive: true });

for (let index = 0; index < shardCount; index += 1) {
	const config = {
		$schema: '../node_modules/wrangler/config-schema.json',
		name: `nutsnews-worker-${index}`,
		main: '../src/index.ts',
		compatibility_date: '2026-06-10',
		compatibility_flags: ['nodejs_compat'],
		workers_dev: true,
		preview_urls: false,
		observability: {
			enabled: true,
		},
		vars: {
			FEED_SHARD_INDEX: String(index),
			FEEDS_PER_SHARD: String(feedsPerShard),
			...defaultTranslationVars,
			...optionalShardVars,
		},
		secrets_store_secrets: [
			{
				binding: 'SUPABASE_URL',
				store_id: secretsStoreId,
				secret_name: 'SUPABASE_URL',
			},
			{
				binding: 'SUPABASE_SERVICE_ROLE_KEY',
				store_id: secretsStoreId,
				secret_name: 'SUPABASE_SERVICE_ROLE_KEY',
			},
			{
				binding: 'OPENAI_API_KEY',
				store_id: secretsStoreId,
				secret_name: 'OPENAI_API_KEY',
			},
			{
				binding: 'BETTER_STACK_SOURCE_TOKEN',
				store_id: secretsStoreId,
				secret_name: 'BETTER_STACK_SOURCE_TOKEN',
			},
			{
				binding: 'BETTER_STACK_INGESTING_HOST',
				store_id: secretsStoreId,
				secret_name: 'BETTER_STACK_INGESTING_HOST',
			},
		],
	};


	config.kv_namespaces = [
		{
			binding: 'NUTSNEWS_KV',
			id: kvNamespaceId,
			preview_id: kvPreviewNamespaceId,
		},
	];

	if (includeLocalAiSecretBinding) {
		config.secrets_store_secrets.push({
			binding: 'LOCAL_AI_API_KEY',
			store_id: secretsStoreId,
			secret_name: localAiApiKeySecretName,
		});
	}

	if (includeUpstashRedisSecretBindings) {
		config.secrets_store_secrets.push(
			{
				binding: 'UPSTASH_REDIS_REST_URL',
				store_id: secretsStoreId,
				secret_name: upstashRedisRestUrlSecretName,
			},
			{
				binding: 'UPSTASH_REDIS_REST_TOKEN',
				store_id: secretsStoreId,
				secret_name: upstashRedisRestTokenSecretName,
			},
		);
	}

	fs.writeFileSync(path.join(generatedDir, `wrangler.shard${index}.jsonc`), JSON.stringify(config, null, 2) + '\n');
}

const localAiSummary = process.env.LOCAL_AI_URL ? ` Local AI first enabled with LOCAL_AI_URL=${process.env.LOCAL_AI_URL}; OpenAI fallback=${process.env.AI_PROVIDER_FALLBACK_TO_OPENAI ?? 'true'}.` : (process.env.AI_PROVIDER ? ` AI_PROVIDER=${process.env.AI_PROVIDER}.` : '');
const kvSummary = ' Cloudflare KV binding NUTSNEWS_KV enabled for Worker state and public feed edge snapshots.';
const redisSummary = includeUpstashRedisSecretBindings ? ' Upstash Redis secret bindings enabled.' : ' Upstash Redis secret bindings skipped because ENABLE_UPSTASH_REDIS_SECRET_BINDING is not true.';
const translationSummary = ` Summary translations: languages=${defaultTranslationVars.ENABLED_SUMMARY_LANGUAGES}, limit=${defaultTranslationVars.SUMMARY_TRANSLATION_LIMIT}, hold=${defaultTranslationVars.HOLD_ARTICLES_FOR_TRANSLATIONS}.`;

console.log(
	`Generated ${shardCount} Wrangler config files in ${generatedDir}/ with ${feedsPerShard} feeds per shard, Secrets Store bindings, Better Stack logging bindings, and no cron triggers.${localAiSummary}${translationSummary}${kvSummary}${redisSummary}`,
);
