create table if not exists public.worker_runs (
                                                  id bigserial primary key,

                                                  created_at timestamptz not null default now(),
    run_started_at timestamptz not null,
    run_completed_at timestamptz not null,

    run_source text not null default 'unknown'
    check (run_source in ('manual', 'scheduled', 'unknown')),

    request_id text,

    shard_index integer not null,
    feeds_per_shard integer not null,
    max_ai_reviews integer not null,

    success boolean not null default false,
    error_name text,
    error_message text,

    feed_count integer not null default 0,
    fetched_count integer not null default 0,
    candidate_count integer not null default 0,
    already_reviewed_count integer not null default 0,
    unreviewed_count integer not null default 0,
    eligible_for_ai_count integer not null default 0,
    ai_reviewed_count integer not null default 0,

    accepted_count integer not null default 0,
    rejected_count integer not null default 0,
    no_thumbnail_rejected_count integer not null default 0,
    locally_rejected_count integer not null default 0,

    image_hydration_lookup_count integer not null default 0,
    image_hydration_found_count integer not null default 0,

    review_save_ok boolean not null default false,
    article_save_ok boolean not null default false,
    ai_usage_save_ok boolean not null default false,

    cost_protection_limit_reached boolean not null default false,
    spike_warning_triggered boolean not null default false,

    duration_ms integer not null default 0
    );

create index if not exists worker_runs_started_at_idx
    on public.worker_runs (run_started_at desc);

create index if not exists worker_runs_shard_started_idx
    on public.worker_runs (shard_index, run_started_at desc);

create index if not exists worker_runs_success_started_idx
    on public.worker_runs (success, run_started_at desc);

create index if not exists worker_runs_source_started_idx
    on public.worker_runs (run_source, run_started_at desc);

alter table public.worker_runs enable row level security;
