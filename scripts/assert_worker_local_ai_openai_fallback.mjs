import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const workerDir = path.join(root, "worker");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nutsnews-local-ai-fallback-"));
const generatedDir = path.join(tempRoot, "generated-wrangler");
const expectedShardConfigCount = Number(process.env.EXPECTED_SHARD_CONFIG_COUNT ?? "3");
const {
  SHARD_COUNT: _shardCount,
  SUMMARY_TRANSLATION_LIMIT: _summaryTranslationLimit,
  HOLD_ARTICLES_FOR_TRANSLATIONS: _holdArticlesForTranslations,
  RSS_FEED_FETCH_TIMEOUT_MS: _rssFeedFetchTimeoutMs,
  ARTICLE_PAGE_FETCH_TIMEOUT_MS: _articlePageFetchTimeoutMs,
  LOCAL_AI_TIMEOUT_MS: _localAiTimeoutMs,
  OPENAI_TIMEOUT_MS: _openAiTimeoutMs,
  ...baseEnv
} = process.env;

function assertIncludes(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label} is missing required text: ${needle}`);
  }
}

function assertNotIncludes(label, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${label} still contains forbidden text: ${needle}`);
  }
}

const workflowPath = path.join(root, ".github/workflows/worker-pipeline.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

assertIncludes(".github/workflows/worker-pipeline.yml", workflow, 'AI_PROVIDER_FALLBACK_TO_OPENAI: "true"');
assertIncludes(".github/workflows/worker-pipeline.yml", workflow, 'NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT: "true"');
assertNotIncludes(".github/workflows/worker-pipeline.yml", workflow, 'AI_PROVIDER_FALLBACK_TO_OPENAI: "false"');

try {
  const result = spawnSync("npm", ["run", "generate:wrangler"], {
    cwd: workerDir,
    env: {
      ...baseEnv,
      CLOUDFLARE_ACCOUNT_ID: "ci-account-id",
      NUTSNEWS_SECRETS_STORE_ID: "ci-secrets-store-id",
      NUTSNEWS_KV_NAMESPACE_ID: "ci-kv-namespace-id",
      NUTSNEWS_GENERATED_WRANGLER_DIR: generatedDir,
      LOCAL_AI_URL: "https://local-ai-ci.invalid",
      LOCAL_AI_API_KEY_SECRET_NAME: "LOCAL_AI_API_KEY",
      OPENAI_API_KEY_SECRET_NAME: "OPENAI_API_KEY",
      AI_PROVIDER: "local",
      AI_PROVIDER_FALLBACK_TO_OPENAI: "true",
      NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT: "true",
      ENABLE_LOCAL_AI_SECRET_BINDING: "true",
      LOCAL_AI_MODEL: "qwen2.5:3b",
      ENABLE_UPSTASH_REDIS_SECRET_BINDING: "false",
      ENABLED_SUMMARY_LANGUAGES: "fr,ja,de-CH,de,el",
    },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`generate:wrangler failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }

  if (!fs.existsSync(generatedDir)) {
    throw new Error(`Missing generated Wrangler directory: ${generatedDir}`);
  }

  const files = fs
    .readdirSync(generatedDir)
    .filter((name) => /^wrangler\.shard\d+\.jsonc$/.test(name))
    .map((name) => path.join(generatedDir, name));

  if (files.length !== expectedShardConfigCount) {
    throw new Error(`Expected ${expectedShardConfigCount} generated shard configs, found ${files.length}`);
  }

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const label = path.relative(root, file);

    assertIncludes(label, text, '"AI_PROVIDER"');
    assertIncludes(label, text, '"local"');
    assertIncludes(label, text, '"AI_PROVIDER_FALLBACK_TO_OPENAI"');
    assertIncludes(label, text, '"true"');
    assertNotIncludes(label, text, '"AI_PROVIDER_FALLBACK_TO_OPENAI": "false"');

    assertIncludes(label, text, '"LOCAL_AI_URL"');
    assertIncludes(label, text, '"LOCAL_AI_MODEL"');
    assertIncludes(label, text, '"LOCAL_AI_API_KEY"');
    assertIncludes(label, text, '"OPENAI_API_KEY"');
    assertIncludes(label, text, '"SUMMARY_TRANSLATION_LIMIT": "0"');
    assertIncludes(label, text, '"HOLD_ARTICLES_FOR_TRANSLATIONS": "true"');
    assertIncludes(label, text, '"RSS_FEED_FETCH_TIMEOUT_MS": "15000"');
    assertIncludes(label, text, '"ARTICLE_PAGE_FETCH_TIMEOUT_MS": "10000"');
    assertIncludes(label, text, '"LOCAL_AI_TIMEOUT_MS": "15000"');
    assertIncludes(label, text, '"OPENAI_TIMEOUT_MS": "30000"');
  }

  console.log("Local-AI first with OpenAI fallback regression passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
