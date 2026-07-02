# NutsNews Worker

Cloudflare Worker ingestion, AI review, translation, and publishing pipeline for NutsNews.

## What This Repo Contains

- worker: Cloudflare Worker RSS ingestion engine
- controller: Cloudflare Worker shard controller
- local-ai-service: home-server local AI endpoint
- supabase: database config, migrations, and restore validation
- scripts: operational and regression-test scripts
- docs: Worker and operations documentation

## Main Worker Commands

```bash
cd worker
npm install
npm run test:e2e:offline
npm run generate:wrangler
npm run check:local-ai-config
npm run dev
npm run deploy:shard0
npm run deploy:all
npm run deploy:local-ai
```

## Local AI First Deploy Safety

For production local-AI-first deployments, create `worker/.env.deploy.local` from `worker/.env.deploy.example`, then use:

```bash
cd worker
npm run check:local-ai-config
npm run deploy:local-ai
```

This prevents accidentally deploying OpenAI-only shard configs when `LOCAL_AI_URL` or the `LOCAL_AI_API_KEY` secret binding is missing from the shell environment.

## Verification

Run the fully mocked offline Worker test:

```bash
cd worker
npm run test:e2e:offline
```

## Related Repositories

- nutsnews: public website and admin app
- nutsnews-worker: Worker ingestion, controller, local AI, and backend automation
- nutsnews-ios: native iOS app

## License

MIT. See LICENSE.
