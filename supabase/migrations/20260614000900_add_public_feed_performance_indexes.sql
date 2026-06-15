-- Issue #6: add database indexes for public feed performance and duplicate checks.
--
-- These indexes support:
-- - fast active RSS feed selection by Worker shard offset
-- - unique RSS feed URLs
-- - one AI review row per original article URL
-- - one published article row per original article URL
-- - fast public feed queries for published image-backed articles
-- - fast recent review-history scans

create index if not exists rss_feeds_active_id_idx
  on public.rss_feeds (is_active, id);

-- rss_feeds.url is already unique in current installs through the table constraint,
-- but this guard also protects older databases where the constraint might be missing.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'rss_feeds'
      and indexdef ilike 'create unique%'
      and indexdef ilike '%(url)%'
  ) then
    create unique index rss_feeds_url_unique_idx
      on public.rss_feeds (url);
  end if;
end $$;

-- article_ai_reviews.original_url is already unique in current installs through the table constraint,
-- but this guard also protects older databases where the constraint might be missing.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'article_ai_reviews'
      and indexdef ilike 'create unique%'
      and indexdef ilike '%(original_url)%'
  ) then
    create unique index article_ai_reviews_original_url_unique_idx
      on public.article_ai_reviews (original_url);
  end if;
end $$;

-- articles.original_url is already unique in current installs through the table constraint,
-- but this guard also protects older databases where the constraint might be missing.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'articles'
      and indexdef ilike 'create unique%'
      and indexdef ilike '%(original_url)%'
  ) then
    create unique index articles_original_url_unique_idx
      on public.articles (original_url);
  end if;
end $$;

create index if not exists articles_public_feed_status_published_score_idx
  on public.articles (status, published_on_site_at desc, positivity_score desc)
  where image_url is not null;

create index if not exists article_ai_reviews_reviewed_at_desc_idx
  on public.article_ai_reviews (reviewed_at desc);
