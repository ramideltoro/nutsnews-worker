-- Issue #9: keep the public article API responsive as article volume grows.
-- These indexes support the card feed query shape used by /api/articles and the home page.

create extension if not exists pg_trgm;

create index if not exists articles_published_card_pagination_idx
  on public.articles (published_on_site_at desc, id desc)
  where status = 'published'
    and image_url is not null
    and image_url <> '';

create index if not exists articles_published_card_category_trgm_idx
  on public.articles using gin (category gin_trgm_ops)
  where status = 'published'
    and image_url is not null
    and image_url <> ''
    and category is not null;
