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
npm run dev
npm run deploy:shard0
npm run deploy:all
```

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
