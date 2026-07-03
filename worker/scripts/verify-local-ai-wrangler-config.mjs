import fs from 'node:fs';
import path from 'node:path';

const generatedDir = path.resolve(process.cwd(), process.env.NUTSNEWS_GENERATED_WRANGLER_DIR ?? 'generated-wrangler');
const allowOpenAiFallback = process.env.NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT === 'true';

const files = fs
	.readdirSync(generatedDir)
	.filter((name) => /^wrangler\.shard\d+\.jsonc$/.test(name))
	.sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));

if (files.length === 0) {
	throw new Error('No generated Wrangler shard configs found. Run npm run generate:wrangler first.');
}

const failures = [];

for (const file of files) {
	const config = JSON.parse(fs.readFileSync(path.join(generatedDir, file), 'utf8'));
	const vars = config.vars ?? {};
	const secretBindings = new Set((config.secrets_store_secrets ?? []).map((entry) => entry.binding));

	if (vars.AI_PROVIDER !== 'local') {
		failures.push(`${file}: AI_PROVIDER is ${JSON.stringify(vars.AI_PROVIDER)}, expected "local"`);
	}
	if (!vars.LOCAL_AI_URL) {
		failures.push(`${file}: LOCAL_AI_URL is missing`);
	}
	if (!secretBindings.has('LOCAL_AI_API_KEY')) {
		failures.push(`${file}: LOCAL_AI_API_KEY secret binding is missing`);
	}
	if (vars.AI_PROVIDER_FALLBACK_TO_OPENAI !== 'false' && !allowOpenAiFallback) {
		failures.push(
			`${file}: AI_PROVIDER_FALLBACK_TO_OPENAI is ${JSON.stringify(vars.AI_PROVIDER_FALLBACK_TO_OPENAI)}, expected "false" so Worker shards cannot silently fall back to OpenAI`,
		);
	}
	if (vars.AI_REVIEW_CONCURRENCY !== '1') {
		failures.push(`${file}: AI_REVIEW_CONCURRENCY is ${JSON.stringify(vars.AI_REVIEW_CONCURRENCY)}, expected "1" for home-server local AI safety`);
	}
}

if (failures.length > 0) {
	console.error('Local-AI Wrangler config verification failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(`Verified ${files.length} shard configs: local AI first is configured, OpenAI fallback is enabled, and LOCAL_AI_API_KEY is bound.`);
