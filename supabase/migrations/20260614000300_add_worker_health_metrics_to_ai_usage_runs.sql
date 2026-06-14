alter table public.ai_usage_runs
    add column if not exists image_hydration_lookup_count integer not null default 0,
    add column if not exists image_hydration_found_count integer not null default 0;

create index if not exists ai_usage_runs_image_hydration_idx
    on public.ai_usage_runs (run_started_at desc, image_hydration_found_count);