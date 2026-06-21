-- Track which AI provider and model reviewed each article.
-- This lets the admin dashboard distinguish OpenAI decisions from the local Oracle/Ollama model.

alter table public.article_ai_reviews
  add column if not exists ai_provider text not null default 'openai'
    check (ai_provider in ('openai', 'local', 'prefilter', 'no_thumbnail')),
  add column if not exists ai_model text not null default 'gpt-4o-mini',
  add column if not exists review_duration_ms integer not null default 0;

alter table public.articles
  add column if not exists ai_provider text not null default 'openai'
    check (ai_provider in ('openai', 'local', 'prefilter', 'no_thumbnail')),
  add column if not exists ai_model text not null default 'gpt-4o-mini';

alter table public.ai_usage_runs
  add column if not exists ai_provider text not null default 'openai'
    check (ai_provider in ('openai', 'local')),
  add column if not exists local_ai_model text not null default 'qwen2.5:3b',
  add column if not exists local_ai_call_count integer not null default 0,
  add column if not exists local_ai_prompt_tokens integer not null default 0,
  add column if not exists local_ai_completion_tokens integer not null default 0,
  add column if not exists local_ai_total_tokens integer not null default 0,
  add column if not exists local_ai_accepted_count integer not null default 0,
  add column if not exists local_ai_rejected_count integer not null default 0,
  add column if not exists local_ai_duration_ms integer not null default 0;

create index if not exists article_ai_reviews_provider_model_reviewed_idx
  on public.article_ai_reviews (ai_provider, ai_model, reviewed_at desc);

create index if not exists articles_provider_model_published_idx
  on public.articles (ai_provider, ai_model, published_on_site_at desc);

create index if not exists ai_usage_runs_provider_started_idx
  on public.ai_usage_runs (ai_provider, run_started_at desc);

create index if not exists ai_usage_runs_local_model_started_idx
  on public.ai_usage_runs (local_ai_model, run_started_at desc);
