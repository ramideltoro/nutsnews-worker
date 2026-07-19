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
