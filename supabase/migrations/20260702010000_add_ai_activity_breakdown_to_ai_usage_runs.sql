alter table public.ai_usage_runs
  add column if not exists openai_review_count integer not null default 0,
  add column if not exists openai_review_prompt_tokens integer not null default 0,
  add column if not exists openai_review_completion_tokens integer not null default 0,
  add column if not exists openai_review_total_tokens integer not null default 0,
  add column if not exists estimated_openai_review_cost_usd numeric(12, 6) not null default 0,
  add column if not exists openai_translation_count integer not null default 0,
  add column if not exists openai_translation_prompt_tokens integer not null default 0,
  add column if not exists openai_translation_completion_tokens integer not null default 0,
  add column if not exists openai_translation_total_tokens integer not null default 0,
  add column if not exists estimated_openai_translation_cost_usd numeric(12, 6) not null default 0,
  add column if not exists local_ai_review_count integer not null default 0,
  add column if not exists local_ai_review_prompt_tokens integer not null default 0,
  add column if not exists local_ai_review_completion_tokens integer not null default 0,
  add column if not exists local_ai_review_total_tokens integer not null default 0,
  add column if not exists local_ai_review_duration_ms integer not null default 0,
  add column if not exists local_ai_translation_count integer not null default 0,
  add column if not exists local_ai_translation_prompt_tokens integer not null default 0,
  add column if not exists local_ai_translation_completion_tokens integer not null default 0,
  add column if not exists local_ai_translation_total_tokens integer not null default 0,
  add column if not exists local_ai_translation_duration_ms integer not null default 0,
  add column if not exists estimated_local_ai_savings_usd numeric(12, 6) not null default 0;

update public.ai_usage_runs
set
  openai_review_count = case when openai_review_count = 0 then openai_call_count else openai_review_count end,
  openai_review_prompt_tokens = case when openai_review_prompt_tokens = 0 then openai_prompt_tokens else openai_review_prompt_tokens end,
  openai_review_completion_tokens = case when openai_review_completion_tokens = 0 then openai_completion_tokens else openai_review_completion_tokens end,
  openai_review_total_tokens = case when openai_review_total_tokens = 0 then openai_total_tokens else openai_review_total_tokens end,
  estimated_openai_review_cost_usd = case when estimated_openai_review_cost_usd = 0 then estimated_openai_cost_usd else estimated_openai_review_cost_usd end,
  local_ai_review_count = case when local_ai_review_count = 0 then local_ai_call_count else local_ai_review_count end,
  local_ai_review_prompt_tokens = case when local_ai_review_prompt_tokens = 0 then local_ai_prompt_tokens else local_ai_review_prompt_tokens end,
  local_ai_review_completion_tokens = case when local_ai_review_completion_tokens = 0 then local_ai_completion_tokens else local_ai_review_completion_tokens end,
  local_ai_review_total_tokens = case when local_ai_review_total_tokens = 0 then local_ai_total_tokens else local_ai_review_total_tokens end,
  local_ai_review_duration_ms = case when local_ai_review_duration_ms = 0 then local_ai_duration_ms else local_ai_review_duration_ms end;

create index if not exists ai_usage_runs_ai_activity_started_idx
  on public.ai_usage_runs (run_started_at desc, openai_call_count, local_ai_call_count);
