import fs from "node:fs";
import path from "node:path";

const shardCount = Number(process.env.SHARD_COUNT ?? "25");
const feedsPerShard = Number(process.env.FEEDS_PER_SHARD ?? "20");
const secretsStoreId = process.env.NUTSNEWS_SECRETS_STORE_ID;

if (!secretsStoreId) {
  throw new Error(
    'Missing NUTSNEWS_SECRETS_STORE_ID. Run: export NUTSNEWS_SECRETS_STORE_ID="your-store-id"',
  );
}

const generatedDir = path.join("generated-wrangler");

fs.mkdirSync(generatedDir, { recursive: true });

for (let index = 0; index < shardCount; index += 1) {
  const config = {
    $schema: "../node_modules/wrangler/config-schema.json",
    name: `nutsnews-worker-${index}`,
    main: "../src/index.ts",
    compatibility_date: "2026-06-10",
    workers_dev: true,
    preview_urls: false,
    observability: {
      enabled: true,
    },
    vars: {
      FEED_SHARD_INDEX: String(index),
      FEEDS_PER_SHARD: String(feedsPerShard),
    },
    secrets_store_secrets: [
      {
        binding: "SUPABASE_URL",
        store_id: secretsStoreId,
        secret_name: "SUPABASE_URL",
      },
      {
        binding: "SUPABASE_SERVICE_ROLE_KEY",
        store_id: secretsStoreId,
        secret_name: "SUPABASE_SERVICE_ROLE_KEY",
      },
      {
        binding: "OPENAI_API_KEY",
        store_id: secretsStoreId,
        secret_name: "OPENAI_API_KEY",
      },
    ],
  };

  fs.writeFileSync(
    path.join(generatedDir, `wrangler.shard${index}.jsonc`),
    JSON.stringify(config, null, 2) + "\n",
  );
}

console.log(
  `Generated ${shardCount} Wrangler config files in ${generatedDir}/ with ${feedsPerShard} feeds per shard and no cron triggers.`,
);