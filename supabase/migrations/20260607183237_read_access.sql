alter table articles enable row level security;

drop policy if exists "Public can read published articles" on articles;

create policy "Public can read published articles"
on articles
for select
to anon
using (status = 'published');