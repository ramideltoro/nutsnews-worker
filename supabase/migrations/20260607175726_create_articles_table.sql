create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  title text not null,
  original_url text not null unique,
  image_url text,
  published_at timestamptz,
  original_excerpt text,
  ai_summary text,
  category text,
  positivity_score int,
  status text default 'published',
  created_at timestamptz default now()
);

create index if not exists articles_feed_idx
on articles (positivity_score desc, published_at desc);