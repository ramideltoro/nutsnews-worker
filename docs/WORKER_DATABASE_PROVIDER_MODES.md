# Worker Database Provider Modes

Issue: ramideltoro/nutsnews-worker#27

The Worker database provider is selected with `NUTSNEWS_DATABASE_PROVIDER_MODE`:

- `supabase_primary`: default and rollback mode. Uses Supabase PostgREST with existing Supabase secrets.
- `backend_postgres_shadow`: reads Supabase as primary, compares backend API shadow reads, and keeps writes on Supabase only.
- `backend_postgres_primary`: uses the backend-compatible Worker API as primary and requires `NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION=enable-backend-postgres-primary`.

Backend-primary requires:

- `NUTSNEWS_BACKEND_API_URL`
- `NUTSNEWS_BACKEND_API_TOKEN`
- `NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION=enable-backend-postgres-primary`

Rollback to Supabase is explicit: set `NUTSNEWS_DATABASE_PROVIDER_MODE=supabase_primary` and deploy a config with Supabase secret bindings enabled.

Before production cutover, attach parity evidence and runbook links to the cutover issue/PR:

- TODO(worker-db-cutover-contract): verify the final route contract against `ramideltoro/nutsnews-backend/docs/backend-api-compatibility-contract.json`.
- TODO(worker-db-cutover-provider-switch): follow `ramideltoro/nutsnews-backend/runbooks/DB_MIGRATION_PROVIDER_SWITCH.md`.
- TODO(worker-db-cutover-parity): attach evidence from `ramideltoro/nutsnews-backend/runbooks/DB_MIGRATION_PARITY_VALIDATION.md`.
- TODO(worker-db-cutover-production): follow `ramideltoro/nutsnews-backend/runbooks/DB_MIGRATION_PRODUCTION_CUTOVER.md`.
- TODO(worker-db-cutover-rollback): keep `ramideltoro/nutsnews-backend/runbooks/DB_MIGRATION_ROLLBACK_FAILBACK.md` ready before backend primary deploy.

Local smoke command:

```bash
cd worker
npm run test:db-provider-modes
```

Non-production backend shadow smoke target:

- Issue: ramideltoro/nutsnews-worker#29
- Workflow: `.github/workflows/worker-shadow-smoke.yml`
- Route: `GET /backend-shadow-smoke`
- Mode: `NUTSNEWS_DATABASE_PROVIDER_MODE=backend_postgres_shadow`
- Supabase secret bindings: intentionally absent
- Backend compatibility evidence: one bounded `loadBackpressureArticleCount` read through `/api/worker/db/load-article-count-for-backpressure`

Local regression commands:

```bash
cd worker
npm run test:shadow-smoke-config
npm run test:shadow-smoke-route
```

Manual live workflow requirements before dispatching with `deploy=true`:

- GitHub `non-production` environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NUTSNEWS_SECRETS_STORE_ID`, `NUTSNEWS_SHADOW_SMOKE_TOKEN`.
- Cloudflare Secrets Store entries named by `NUTSNEWS_BACKEND_API_URL_SECRET_NAME`, `NUTSNEWS_BACKEND_API_TOKEN_SECRET_NAME`, and `NUTSNEWS_SHADOW_SMOKE_TOKEN_SECRET_NAME` must exist. Defaults are `NUTSNEWS_BACKEND_API_URL`, `NUTSNEWS_BACKEND_API_TOKEN`, and `NUTSNEWS_SHADOW_SMOKE_TOKEN`.
- Optional GitHub environment vars: `NUTSNEWS_SHADOW_SMOKE_WORKER_NAME`, `NUTSNEWS_BACKEND_API_URL_SECRET_NAME`, `NUTSNEWS_BACKEND_API_TOKEN_SECRET_NAME`, `NUTSNEWS_SHADOW_SMOKE_TOKEN_SECRET_NAME`.
