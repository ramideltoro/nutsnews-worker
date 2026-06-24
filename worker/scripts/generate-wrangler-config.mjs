import fs from 'node:fs';
import path from 'node:path';

const shardCount = Number(process.env.SHARD_COUNT ?? '25');
const feedsPerShard = Number(process.env.FEEDS_PER_SHARD ?? '20');
const secretsStoreId = process.env.NUTSNEWS_SECRETS_STORE_ID;
const includeLocalAiSecretBinding = process.env.ENABLE_LOCAL_AI_SECRET_BINDING === 'true';
const localAiApiKeySecretName = process.env.LOCAL_AI_API_KEY_SECRET_NAME ?? 'LOCAL_AI_API_KEY';

const optionalShardVars = Object.fromEntries(
	['AI_PROVIDER', 'LOCAL_AI_URL', 'LOCAL_AI_MODEL', 'AI_PROVIDER_FALLBACK_TO_OPENAI', 'AI_REVIEW_CONCURRENCY', 'ENABLED_SUMMARY_LANGUAGES', 'SUMMARY_TRANSLATION_LIMIT']
		.filter((key) => process.env[key])
		.map((key) => [key, process.env[key]]),
);

if (!secretsStoreId) {
	throw new Error('Missing NUTSNEWS_SECRETS_STORE_ID.\nRun: export NUTSNEWS_SECRETS_STORE_ID="your-store-id"');
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

	if (includeLocalAiSecretBinding) {
		config.secrets_store_secrets.push({
			binding: 'LOCAL_AI_API_KEY',
			store_id: secretsStoreId,
			secret_name: localAiApiKeySecretName,
		});
	}

	fs.writeFileSync(path.join(generatedDir, `wrangler.shard${index}.jsonc`), JSON.stringify(config, null, 2) + '\n');
}

const localAiSummary = process.env.AI_PROVIDER ? ` AI_PROVIDER=${process.env.AI_PROVIDER}.` : '';

console.log(
	`Generated ${shardCount} Wrangler config files in ${generatedDir}/ with ${feedsPerShard} feeds per shard, Secrets Store bindings, Better Stack logging bindings, and no cron triggers.${localAiSummary}`,
);
