alter table articles
add column if not exists published_on_site_at timestamptz default now();

update articles
set published_on_site_at = created_at
where published_on_site_at is null;

create index if not exists articles_published_on_site_idx
on articles (published_on_site_at desc);
