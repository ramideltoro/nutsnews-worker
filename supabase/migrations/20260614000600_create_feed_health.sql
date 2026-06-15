create table if not exists public.rss_feeds (
  id bigserial primary key,
  source text not null,
  url text not null unique,
  is_positive_source boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists rss_feeds_is_active_idx
  on public.rss_feeds (is_active);

create table if not exists public.feed_health (
  id bigserial primary key,
  source text not null,
  feed_url text not null unique,

  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status int,
  last_error_message text,

  last_article_count int not null default 0,
  last_image_count int not null default 0,
  last_accepted_count int not null default 0,
  last_rejected_count int not null default 0,

  consecutive_failure_count int not null default 0,

  total_fetch_count int not null default 0,
  total_success_count int not null default 0,
  total_failure_count int not null default 0,
  total_article_count int not null default 0,
  total_image_count int not null default 0,
  total_accepted_count int not null default 0,
  total_rejected_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feed_health_last_checked_idx
  on public.feed_health (last_checked_at desc);

create index if not exists feed_health_consecutive_failure_idx
  on public.feed_health (consecutive_failure_count desc);

create index if not exists feed_health_total_accepted_idx
  on public.feed_health (total_accepted_count desc);

create index if not exists feed_health_source_idx
  on public.feed_health (source);

alter table public.feed_health enable row level security;

alter table if exists public.rss_feeds
  add column if not exists is_active boolean not null default true;

create or replace view public.bad_feeds as
select
  fh.source,
  fh.feed_url,
  rf.is_active,
  fh.last_checked_at,
  fh.last_success_at,
  fh.last_failure_at,
  fh.last_status,
  fh.last_error_message,
  fh.consecutive_failure_count,
  fh.total_fetch_count,
  fh.total_success_count,
  fh.total_failure_count,
  round((fh.total_success_count::numeric / nullif(fh.total_fetch_count, 0)) * 100, 2) as success_rate_pct,
  fh.total_article_count,
  fh.total_image_count,
  round((fh.total_image_count::numeric / nullif(fh.total_article_count, 0)) * 100, 2) as image_rate_pct,
  fh.total_accepted_count,
  fh.total_rejected_count,
  round((fh.total_accepted_count::numeric / nullif(fh.total_accepted_count + fh.total_rejected_count, 0)) * 100, 2) as acceptance_rate_pct
from public.feed_health fh
left join public.rss_feeds rf on rf.url = fh.feed_url
where
  fh.consecutive_failure_count >= 3
  or (
    fh.total_fetch_count >= 5
    and fh.total_success_count::numeric / nullif(fh.total_fetch_count, 0) < 0.60
  )
  or (
    fh.total_fetch_count >= 5
    and fh.total_article_count = 0
  )
  or (
    fh.total_article_count >= 20
    and fh.total_image_count::numeric / nullif(fh.total_article_count, 0) < 0.10
  )
order by
  fh.consecutive_failure_count desc,
  success_rate_pct asc nulls last,
  fh.total_accepted_count asc;

create or replace view public.best_feeds as
select
  fh.source,
  fh.feed_url,
  rf.is_active,
  fh.last_checked_at,
  fh.last_success_at,
  fh.last_failure_at,
  fh.last_status,
  fh.consecutive_failure_count,
  fh.total_fetch_count,
  fh.total_success_count,
  fh.total_failure_count,
  round((fh.total_success_count::numeric / nullif(fh.total_fetch_count, 0)) * 100, 2) as success_rate_pct,
  fh.total_article_count,
  fh.total_image_count,
  round((fh.total_image_count::numeric / nullif(fh.total_article_count, 0)) * 100, 2) as image_rate_pct,
  fh.total_accepted_count,
  fh.total_rejected_count,
  round((fh.total_accepted_count::numeric / nullif(fh.total_accepted_count + fh.total_rejected_count, 0)) * 100, 2) as acceptance_rate_pct
from public.feed_health fh
left join public.rss_feeds rf on rf.url = fh.feed_url
where fh.total_fetch_count > 0
order by
  fh.total_accepted_count desc,
  image_rate_pct desc nulls last,
  success_rate_pct desc nulls last,
  fh.consecutive_failure_count asc,
  fh.source asc;
