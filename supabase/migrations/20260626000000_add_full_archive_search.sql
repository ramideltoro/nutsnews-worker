-- Full archive search for NutsNews.
-- Run this in Supabase before deploying the web app route that calls public.search_articles.

alter table public.articles
add column if not exists search_vector tsvector
generated always as (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(ai_summary, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(source, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C')
) stored;

create index if not exists articles_search_vector_idx
on public.articles
using gin (search_vector);

create index if not exists articles_search_published_idx
on public.articles (status, published_on_site_at desc, id desc)
where status = 'published' and image_url is not null and image_url <> '';

create or replace function public.search_articles(
  search_query text,
  page_size integer default 20,
  page_offset integer default 0
)
returns table (
  id uuid,
  source text,
  title text,
  original_url text,
  image_url text,
  published_at timestamptz,
  published_on_site_at timestamptz,
  ai_summary text,
  category text,
  positivity_score integer,
  rank real
)
language sql
stable
as $$
  with search_input as (
    select websearch_to_tsquery('english', trim(search_query)) as query
  )
  select
    a.id,
    a.source,
    a.title,
    a.original_url,
    a.image_url,
    a.published_at,
    a.published_on_site_at,
    a.ai_summary,
    a.category,
    a.positivity_score,
    ts_rank_cd(a.search_vector, search_input.query) as rank
  from public.articles a
  cross join search_input
  where
    length(trim(search_query)) >= 2
    and a.status = 'published'
    and a.image_url is not null
    and a.image_url <> ''
    and a.search_vector @@ search_input.query
  order by
    rank desc,
    a.published_on_site_at desc nulls last,
    a.created_at desc,
    a.id desc
  limit least(greatest(page_size, 1), 51)
  offset greatest(page_offset, 0);
$$;

grant execute on function public.search_articles(text, integer, integer) to anon, authenticated, service_role;
