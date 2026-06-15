-- Issue #8: create a stable public feed snapshot for faster homepage loads.
--
-- The public homepage and /api/articles can read this materialized view instead
-- of repeatedly scanning and sorting the full articles table. The Worker refreshes
-- the snapshot after each ingestion run, and the web app falls back to the
-- normal articles query if the snapshot is unavailable.

create materialized view if not exists public.public_feed_snapshot as
select
  row_number() over (
    order by coalesce(a.published_on_site_at, a.created_at, a.published_at) desc, a.id desc
  ) as snapshot_rank,
  a.id,
  a.source,
  a.title,
  a.original_url,
  a.image_url,
  a.published_at,
  coalesce(a.published_on_site_at, a.created_at, a.published_at) as published_on_site_at,
  a.ai_summary,
  a.category,
  a.positivity_score
from public.articles a
where a.status = 'published'
  and a.image_url is not null
  and btrim(a.image_url) <> ''
with data;

create unique index if not exists public_feed_snapshot_id_idx
  on public.public_feed_snapshot (id);

create index if not exists public_feed_snapshot_rank_idx
  on public.public_feed_snapshot (snapshot_rank);

create index if not exists public_feed_snapshot_time_id_idx
  on public.public_feed_snapshot (published_on_site_at desc, id desc);

create index if not exists public_feed_snapshot_category_idx
  on public.public_feed_snapshot (category);

comment on materialized view public.public_feed_snapshot is
  'Precomputed public article feed used by the homepage and /api/articles to reduce repeated database work.';

grant select on public.public_feed_snapshot to anon, authenticated, service_role;

create or replace function public.refresh_public_feed_snapshot()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  refreshed_at timestamptz := now();
begin
  refresh materialized view public.public_feed_snapshot;
  return refreshed_at;
end;
$$;

grant execute on function public.refresh_public_feed_snapshot() to service_role;
