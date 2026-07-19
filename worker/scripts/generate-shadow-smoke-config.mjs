import fs from 'node:fs';
import path from 'node:path';

const secretsStoreId = process.env.NUTSNEWS_SECRETS_STORE_ID;
const generatedDir = process.env.NUTSNEWS_GENERATED_WRANGLER_DIR ?? path.join('generated-shadow-smoke');
const workerName = process.env.NUTSNEWS_SHADOW_SMOKE_WORKER_NAME ?? 'nutsnews-worker-shadow-smoke';
const backendApiUrlSecretName = process.env.NUTSNEWS_BACKEND_API_URL_SECRET_NAME ?? 'NUTSNEWS_BACKEND_API_URL';
const backendApiTokenSecretName = process.env.NUTSNEWS_BACKEND_API_TOKEN_SECRET_NAME ?? 'NUTSNEWS_BACKEND_API_TOKEN';
const smokeTokenSecretName = process.env.NUTSNEWS_SHADOW_SMOKE_TOKEN_SECRET_NAME ?? 'NUTSNEWS_SHADOW_SMOKE_TOKEN';
const kvNamespaceId = process.env.NUTSNEWS_KV_NAMESPACE_ID;
const kvPreviewNamespaceId = process.env.NUTSNEWS_KV_PREVIEW_NAMESPACE_ID ?? kvNamespaceId;

if (!secretsStoreId) {
	throw new Error('Missing NUTSNEWS_SECRETS_STORE_ID for the shadow smoke Worker config.');
}

fs.mkdirSync(generatedDir, { recursive: true });

const config = {
	$schema: '../node_modules/wrangler/config-schema.json',
	name: workerName,
	main: '../src/index.ts',
	compatibility_date: '2026-06-10',
	compatibility_flags: ['nodejs_compat'],
	workers_dev: true,
	preview_urls: false,
	observability: {
		enabled: true,
	},
	vars: {
		NUTSNEWS_DATABASE_PROVIDER_MODE: 'backend_postgres_shadow',
		ENABLE_BACKEND_SHADOW_SMOKE: 'true',
		FEED_SHARD_INDEX: '0',
		FEEDS_PER_SHARD: '1',
		ENABLED_SUMMARY_LANGUAGES: 'off',
		SUMMARY_TRANSLATION_LIMIT: '0',
		HOLD_ARTICLES_FOR_TRANSLATIONS: 'false',
		UPSTASH_REDIS_ENABLED: 'false',
	},
	secrets_store_secrets: [
		{
			binding: 'NUTSNEWS_BACKEND_API_URL',
			store_id: secretsStoreId,
			secret_name: backendApiUrlSecretName,
		},
		{
			binding: 'NUTSNEWS_BACKEND_API_TOKEN',
			store_id: secretsStoreId,
			secret_name: backendApiTokenSecretName,
		},
		{
			binding: 'NUTSNEWS_SHADOW_SMOKE_TOKEN',
			store_id: secretsStoreId,
			secret_name: smokeTokenSecretName,
		},
	],
};

if (kvNamespaceId) {
	config.kv_namespaces = [
		{
			binding: 'NUTSNEWS_KV',
			id: kvNamespaceId,
			preview_id: kvPreviewNamespaceId,
		},
	];
}

const configPath = path.join(generatedDir, 'wrangler.shadow-smoke.jsonc');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

console.log(
	`Generated non-production backend shadow smoke Wrangler config at ${configPath}. ` +
		`Supabase bindings are absent, backend URL/token bindings use Secrets Store, and cron triggers are absent.`,
);
