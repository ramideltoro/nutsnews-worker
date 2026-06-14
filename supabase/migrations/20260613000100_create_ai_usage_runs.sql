create table if not exists public.ai_usage_runs (
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

    feed_count integer not null default 0,
    fetched_count integer not null default 0,
    candidate_count integer not null default 0,
    already_reviewed_count integer not null default 0,
    unreviewed_count integer not null default 0,
    eligible_for_ai_count integer not null default 0,

    ai_reviewed_count integer not null default 0,

    openai_model text not null default 'gpt-4o-mini',
    openai_call_count integer not null default 0,
    openai_prompt_tokens integer not null default 0,
    openai_completion_tokens integer not null default 0,
    openai_total_tokens integer not null default 0,
    estimated_openai_cost_usd numeric(12, 6) not null default 0,

    openai_accepted_count integer not null default 0,
    openai_rejected_count integer not null default 0,

    published_accepted_count integer not null default 0,
    total_rejected_count integer not null default 0,
    no_thumbnail_rejected_count integer not null default 0,
    locally_rejected_count integer not null default 0,

    cost_protection_limit_reached boolean not null default false,
    spike_warning_triggered boolean not null default false,

    review_save_ok boolean not null default false,
    article_save_ok boolean not null default false,

    duration_ms integer not null default 0
    );

create index if not exists ai_usage_runs_created_at_idx
    on public.ai_usage_runs (created_at desc);

create index if not exists ai_usage_runs_run_started_at_idx
    on public.ai_usage_runs (run_started_at desc);

create index if not exists ai_usage_runs_shard_started_idx
    on public.ai_usage_runs (shard_index, run_started_at desc);

create index if not exists ai_usage_runs_source_started_idx
    on public.ai_usage_runs (run_source, run_started_at desc);

alter table public.ai_usage_runs enable row level security;