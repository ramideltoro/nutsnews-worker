create table if not exists public.quota_usage_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event_type text not null,
  event_source text not null default 'unknown',
  provider text,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists quota_usage_events_created_at_idx
  on public.quota_usage_events (created_at desc);

create index if not exists quota_usage_events_type_created_at_idx
  on public.quota_usage_events (event_type, created_at desc);

alter table public.quota_usage_events enable row level security;
