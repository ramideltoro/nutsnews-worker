-- NutsNews Supabase restore validation queries.
-- Run after restoring a backup into a temporary database or production.
--
-- Usage:
--   psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/restore_validation.sql

\echo 'NutsNews restore validation started'

\echo ''
\echo '1. Required tables'
with required_tables(table_name) as (
  values
    ('articles'),
    ('rss_feeds'),
    ('article_ai_reviews'),
    ('article_summaries'),
    ('ai_usage_runs'),
    ('worker_runs'),
    ('feed_health')
)
select
  required_tables.table_name,
  case when information_schema.tables.table_name is null then 'missing' else 'ok' end as status
from required_tables
left join information_schema.tables
  on information_schema.tables.table_schema = 'public'
 and information_schema.tables.table_name = required_tables.table_name
order by required_tables.table_name;

\echo ''
\echo '2. Required views'
with required_views(view_name) as (
  values
    ('bad_feeds'),
    ('best_feeds')
)
select
  required_views.view_name,
  case when information_schema.views.table_name is null then 'missing' else 'ok' end as status
from required_views
left join information_schema.views
  on information_schema.views.table_schema = 'public'
 and information_schema.views.table_name = required_views.view_name
order by required_views.view_name;

\echo ''
\echo '3. Required materialized views'
with required_materialized_views(view_name) as (
  values
    ('public_feed_snapshot')
)
select
  required_materialized_views.view_name,
  case when pg_matviews.matviewname is null then 'missing' else 'ok' end as status
from required_materialized_views
left join pg_matviews
  on pg_matviews.schemaname = 'public'
 and pg_matviews.matviewname = required_materialized_views.view_name
order by required_materialized_views.view_name;

\echo ''
\echo '4. Row counts'
select 'articles' as object_name, count(*)::bigint as row_count from public.articles
union all
select 'rss_feeds', count(*)::bigint from public.rss_feeds
union all
select 'article_ai_reviews', count(*)::bigint from public.article_ai_reviews
union all
select 'article_summaries', count(*)::bigint from public.article_summaries
union all
select 'ai_usage_runs', count(*)::bigint from public.ai_usage_runs
union all
select 'worker_runs', count(*)::bigint from public.worker_runs
union all
select 'feed_health', count(*)::bigint from public.feed_health
union all
select 'public_feed_snapshot', count(*)::bigint from public.public_feed_snapshot
order by object_name;

\echo ''
\echo '5. Public feed readiness'
select
  count(*) filter (
    where status = 'published'
      and image_url is not null
      and image_url <> ''
  ) as published_image_articles,
  count(*) filter (where status = 'published') as published_articles,
  count(*) as total_articles
from public.articles;

\echo ''
\echo '6. RSS feed readiness'
select
  count(*) filter (where is_active = true) as active_feeds,
  count(*) filter (where is_active = false) as inactive_feeds,
  count(*) as total_feeds
from public.rss_feeds;

\echo ''
\echo '7. AI review readiness'
select
  count(*) filter (where decision = 'accept') as accepted_reviews,
  count(*) filter (where decision = 'reject') as rejected_reviews,
  count(*) as total_reviews
from public.article_ai_reviews;

\echo ''
\echo '8. Duplicate checks'
select
  'articles.original_url duplicates' as check_name,
  count(*) as duplicate_groups
from (
  select original_url
  from public.articles
  group by original_url
  having count(*) > 1
) duplicates
union all
select
  'rss_feeds.url duplicates' as check_name,
  count(*) as duplicate_groups
from (
  select url
  from public.rss_feeds
  group by url
  having count(*) > 1
) duplicates
union all
select
  'article_ai_reviews.original_url duplicates' as check_name,
  count(*) as duplicate_groups
from (
  select original_url
  from public.article_ai_reviews
  group by original_url
  having count(*) > 1
) duplicates;

\echo ''
\echo '9. Important indexes'
select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'articles_feed_idx',
    'articles_published_on_site_idx',
    'articles_published_card_pagination_idx',
    'articles_published_card_category_trgm_idx',
    'articles_public_feed_status_published_score_idx',
    'rss_feeds_is_active_idx',
    'rss_feeds_active_id_idx',
    'article_ai_reviews_reviewed_at_idx',
    'article_ai_reviews_decision_reviewed_idx',
    'article_ai_reviews_reviewed_at_desc_idx',
    'article_ai_reviews_source_reviewed_idx',
    'article_ai_reviews_category_reviewed_idx',
    'article_ai_reviews_score_reviewed_idx',
    'article_ai_reviews_decision_score_reviewed_idx',
    'ai_usage_runs_created_at_idx',
    'ai_usage_runs_run_started_at_idx',
    'ai_usage_runs_shard_started_idx',
    'worker_runs_started_at_idx',
    'worker_runs_shard_started_idx',
    'feed_health_last_checked_idx',
    'feed_health_consecutive_failure_idx',
    'feed_health_total_accepted_idx',
    'feed_health_source_idx',
    'public_feed_snapshot_id_idx',
    'public_feed_snapshot_rank_idx',
    'public_feed_snapshot_time_id_idx',
    'public_feed_snapshot_category_idx'
  )
order by tablename, indexname;

\echo ''
\echo '10. Row level security status'
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'articles',
    'rss_feeds',
    'article_ai_reviews',
    'article_summaries',
    'ai_usage_runs',
    'worker_runs',
    'feed_health'
  )
order by tablename;

\echo ''
\echo '11. View smoke tests'
select count(*) as bad_feed_rows from public.bad_feeds;
select count(*) as best_feed_rows from public.best_feeds;
select count(*) as public_feed_snapshot_rows from public.public_feed_snapshot;

\echo ''
\echo '12. Public feed snapshot smoke test'
select
  snapshot_rank,
  source,
  title,
  published_on_site_at
from public.public_feed_snapshot
order by snapshot_rank asc
limit 5;

\echo ''
\echo '13. Latest operational rows'
select
  'latest_worker_run' as object_name,
  run_started_at,
  success,
  shard_index,
  duration_ms
from public.worker_runs
order by run_started_at desc
limit 5;

select
  'latest_ai_usage_run' as object_name,
  run_started_at,
  shard_index,
  openai_call_count,
  openai_total_tokens,
  estimated_openai_cost_usd
from public.ai_usage_runs
order by run_started_at desc
limit 5;

\echo ''
\echo 'NutsNews restore validation completed'
