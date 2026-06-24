-- Issue #26: future-proof multi-language article summaries.
--
-- Keep the canonical article/source link unchanged in public.articles and store
-- generated reader-facing translations in a separate table keyed by the stable
-- original URL. French is the first enabled language; more language codes can be
-- added later without changing the articles schema.

create table if not exists public.article_summaries (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  original_url text not null references public.articles(original_url) on delete cascade,
  language_code text not null,
  source_language_code text not null default 'en',

  title text not null,
  summary text not null,

  generated_by text not null default 'openai',
  model text not null default 'gpt-4o-mini',

  constraint article_summaries_language_code_check
    check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint article_summaries_source_language_code_check
    check (source_language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  constraint article_summaries_title_not_blank
    check (btrim(title) <> ''),
  constraint article_summaries_summary_not_blank
    check (btrim(summary) <> ''),
  constraint article_summaries_original_url_language_unique
    unique (original_url, language_code)
);

create index if not exists article_summaries_language_updated_idx
  on public.article_summaries (language_code, updated_at desc);

create index if not exists article_summaries_original_url_idx
  on public.article_summaries (original_url);

alter table public.article_summaries enable row level security;

drop policy if exists "Public can read summaries for published articles" on public.article_summaries;

create policy "Public can read summaries for published articles"
on public.article_summaries
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.articles a
    where a.original_url = article_summaries.original_url
      and a.status = 'published'
      and a.image_url is not null
      and btrim(a.image_url) <> ''
  )
);

grant select on public.article_summaries to anon, authenticated;
grant select, insert, update, delete on public.article_summaries to service_role;
grant usage, select on sequence public.article_summaries_id_seq to service_role;

comment on table public.article_summaries is
  'Generated localized titles and summaries for NutsNews article cards. Source links remain unchanged in public.articles.';
