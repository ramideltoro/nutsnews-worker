create table if not exists public.article_ai_reviews (
  id bigserial primary key,

  created_at timestamptz not null default now(),
  reviewed_at timestamptz not null default now(),

  original_url text not null unique,
  source text not null,
  title text not null,

  decision text not null
    check (decision in ('accept', 'reject')),

  category text not null default 'Uplifting',
  positivity_score integer not null default 0,
  summary text not null default '',
  reason text not null default ''
);

create index if not exists article_ai_reviews_reviewed_at_idx
  on public.article_ai_reviews (reviewed_at desc);

create index if not exists article_ai_reviews_decision_reviewed_idx
  on public.article_ai_reviews (decision, reviewed_at desc);

alter table public.article_ai_reviews enable row level security;
