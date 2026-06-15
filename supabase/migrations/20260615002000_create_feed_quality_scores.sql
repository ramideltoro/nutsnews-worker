-- Issue #3: Add RSS source quality scoring.
--
-- This view ranks RSS feeds by useful output so weak sources can be found quickly
-- and feed activation decisions can be based on measurable quality signals.
--
-- Score inputs:
-- - success_rate_pct: how often the feed fetch succeeds
-- - thumbnail_rate_pct: how often discovered articles include usable thumbnails
-- - accepted_rate_pct: how often reviewed articles are accepted
-- - failure_rate_pct: how often feed checks fail
-- - duplicate_rate_pct: approximate duplicate/already-seen rate based on discovered
--   article volume compared with unique reviewed URLs

create or replace view public.feed_quality_scores as
with reviewed_source_counts as (
  select
    source,
    count(distinct original_url) as unique_reviewed_url_count
  from public.article_ai_reviews
  group by source
),
published_source_counts as (
  select
    source,
    count(distinct original_url) as unique_published_url_count
  from public.articles
  group by source
),
base as (
  select
    rf.id as feed_id,
    rf.source,
    rf.url as feed_url,
    coalesce(rf.is_active, true) as is_active,
    coalesce(rf.is_positive_source, false) as is_positive_source,

    fh.id as feed_health_id,
    fh.last_checked_at,
    fh.last_success_at,
    fh.last_failure_at,
    fh.last_status,
    fh.last_error_message,

    coalesce(fh.last_article_count, 0) as last_article_count,
    coalesce(fh.last_image_count, 0) as last_image_count,
    coalesce(fh.last_accepted_count, 0) as last_accepted_count,
    coalesce(fh.last_rejected_count, 0) as last_rejected_count,
    coalesce(fh.consecutive_failure_count, 0) as consecutive_failure_count,

    coalesce(fh.total_fetch_count, 0) as total_fetch_count,
    coalesce(fh.total_success_count, 0) as total_success_count,
    coalesce(fh.total_failure_count, 0) as total_failure_count,
    coalesce(fh.total_article_count, 0) as total_article_count,
    coalesce(fh.total_image_count, 0) as total_image_count,
    coalesce(fh.total_accepted_count, 0) as total_accepted_count,
    coalesce(fh.total_rejected_count, 0) as total_rejected_count,

    coalesce(rsc.unique_reviewed_url_count, 0) as unique_reviewed_url_count,
    coalesce(psc.unique_published_url_count, 0) as unique_published_url_count,
    coalesce(fh.updated_at, rf.created_at) as updated_at
  from public.rss_feeds rf
  left join public.feed_health fh
    on fh.feed_url = rf.url
  left join reviewed_source_counts rsc
    on rsc.source = rf.source
  left join published_source_counts psc
    on psc.source = rf.source
),
rates as (
  select
    base.*,
    case
      when total_fetch_count > 0 then round((total_success_count::numeric / total_fetch_count::numeric) * 100, 2)
      else 0
    end as success_rate_pct,
    case
      when total_article_count > 0 then round((total_image_count::numeric / total_article_count::numeric) * 100, 2)
      else 0
    end as thumbnail_rate_pct,
    case
      when total_accepted_count + total_rejected_count > 0 then round((total_accepted_count::numeric / (total_accepted_count + total_rejected_count)::numeric) * 100, 2)
      else 0
    end as accepted_rate_pct,
    case
      when total_fetch_count > 0 then round((total_failure_count::numeric / total_fetch_count::numeric) * 100, 2)
      else 0
    end as failure_rate_pct,
    case
      when total_article_count > 0 then round((greatest(total_article_count - unique_reviewed_url_count, 0)::numeric / total_article_count::numeric) * 100, 2)
      else 0
    end as duplicate_rate_pct
  from base
),
scored as (
  select
    rates.*,
    least(
      100,
      greatest(
        0,
        round(
          (success_rate_pct * 0.25) +
          (thumbnail_rate_pct * 0.25) +
          (accepted_rate_pct * 0.30) +
          ((100 - failure_rate_pct) * 0.10) +
          ((100 - duplicate_rate_pct) * 0.10) -
          case when not is_active then 10 else 0 end -
          case when total_fetch_count = 0 then 25 else 0 end -
          case when consecutive_failure_count >= 3 then 20 else 0 end
        )
      )
    )::integer as quality_score
  from rates
)
select
  feed_id,
  source,
  feed_url,
  is_active,
  is_positive_source,
  feed_health_id,
  last_checked_at,
  last_success_at,
  last_failure_at,
  last_status,
  last_error_message,
  last_article_count,
  last_image_count,
  last_accepted_count,
  last_rejected_count,
  consecutive_failure_count,
  total_fetch_count,
  total_success_count,
  total_failure_count,
  total_article_count,
  total_image_count,
  total_accepted_count,
  total_rejected_count,
  unique_reviewed_url_count,
  unique_published_url_count,
  success_rate_pct,
  thumbnail_rate_pct,
  accepted_rate_pct,
  failure_rate_pct,
  duplicate_rate_pct,
  quality_score,
  case
    when not is_active then 'inactive'
    when total_fetch_count = 0 then 'untracked'
    when quality_score >= 85 then 'excellent'
    when quality_score >= 70 then 'good'
    when quality_score >= 50 then 'review'
    else 'poor'
  end as quality_grade,
  case
    when not is_active then 'Feed is inactive and skipped by Worker shards.'
    when total_fetch_count = 0 then 'Feed has not been checked yet, so quality cannot be trusted.'
    when consecutive_failure_count >= 3 then 'Feed has repeated consecutive failures.'
    when success_rate_pct < 70 then 'Feed has a low fetch success rate.'
    when total_article_count >= 20 and thumbnail_rate_pct < 10 then 'Feed has poor thumbnail coverage.'
    when total_accepted_count + total_rejected_count >= 5 and accepted_rate_pct < 10 then 'Feed has a low accepted article rate.'
    when duplicate_rate_pct >= 50 then 'Feed appears to return many duplicate or already-seen articles.'
    when quality_score >= 85 then 'Excellent source quality across success, thumbnails, acceptance, failures, and duplicate signals.'
    when quality_score >= 70 then 'Good source quality and worth keeping active.'
    when quality_score >= 50 then 'Usable source, but review before expanding usage.'
    else 'Low source quality. Consider disabling or replacing this feed.'
  end as quality_reason,
  updated_at
from scored;

comment on view public.feed_quality_scores is
  'Ranks RSS feeds by source quality using success, thumbnail, accepted article, failure, and duplicate/already-seen signals.';
