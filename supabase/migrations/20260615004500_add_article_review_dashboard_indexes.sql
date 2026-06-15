-- Indexes for the admin article review dashboard.
-- These support filtering by time, decision, source, category, and positivity score.

create index if not exists article_ai_reviews_source_reviewed_idx
  on public.article_ai_reviews (source, reviewed_at desc);

create index if not exists article_ai_reviews_category_reviewed_idx
  on public.article_ai_reviews (category, reviewed_at desc);

create index if not exists article_ai_reviews_score_reviewed_idx
  on public.article_ai_reviews (positivity_score desc, reviewed_at desc);

create index if not exists article_ai_reviews_decision_score_reviewed_idx
  on public.article_ai_reviews (decision, positivity_score desc, reviewed_at desc);
