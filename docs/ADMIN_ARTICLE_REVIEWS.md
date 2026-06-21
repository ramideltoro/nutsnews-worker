# Admin Article Review Dashboard

This document explains the NutsNews article review dashboard created for GitHub issue #18.

Issue #18 asks for an admin dashboard that lets an operator review accepted and rejected stories, filter by decision/source/category/positivity score, see rejection reasons, and manually investigate bad decisions.

---

## Route

```text
/admin/articles
```

The route is protected by the existing admin Google login and owner allowlist.

---

## Purpose

The article review dashboard helps operators answer:

* Which stories were recently reviewed?
* Was a story accepted or rejected?
* Why was it accepted or rejected?
* Which source did it come from?
* What category and positivity score did the AI assign?
* Was an accepted story published to the public site?
* Which decisions need manual investigation?
* Which AI provider processed the article: OpenAI, local AI, local prefilter, or no-thumbnail rule?
* Which model processed the article, such as `gpt-4o-mini` or `qwen2.5:3b`?

---

## Data Source

The dashboard reads from:

```text
public.article_ai_reviews
```

For accepted stories, it also looks for a matching published article in:

```text
public.articles
```

Matching is done by `original_url`.

---

## Sorting

Reviews are sorted by review time.

Default sort:

```text
Newest reviewed first
```

Operators can switch to:

```text
Oldest reviewed first
```

This makes it easy to review fresh decisions first or investigate older backlog decisions.

---

## Filters

The dashboard supports filters for:

| Filter | Purpose |
| --- | --- |
| Decision | Show all, accepted, or rejected stories |
| Source | Focus on one RSS publisher/source |
| Category | Filter by AI category labels |
| Min score | Show stories at or above a positivity score |
| Max score | Show stories at or below a positivity score |
| Time sort | Newest first or oldest first |

---

## Review Cards

Each review card shows:

* Decision badge
* Positivity score
* AI provider badge
* AI model badge
* Published/not published badge
* Title
* Source
* Category
* Review time
* Review duration
* AI summary
* Decision reason
* Original article link
* Published NutsNews story link when available

For rejected stories, the decision reason is the most important field because it explains why the article was not published.

---

## Manual Investigation Workflow

Use this workflow when reviewing questionable decisions:

1. Open `/admin/articles`.
2. Filter to rejected stories.
3. Sort by newest first.
4. Review low-score stories and rejection reasons.
5. Open the original article when the reason looks suspicious.
6. Check whether the source should be improved, disabled, or kept.
7. Use `/admin/feeds` and `/admin/feed-health` if the issue appears source-specific.

---

## Supabase SQL

The dashboard prints a SQL query that matches the active filters.

Base query:

```sql
select
  reviewed_at,
  decision,
  source,
  category,
  positivity_score,
  ai_provider,
  ai_model,
  review_duration_ms,
  title,
  reason,
  original_url
from public.article_ai_reviews
order by reviewed_at desc
limit 50;
```

Find recent rejected stories:

```sql
select
  reviewed_at,
  source,
  category,
  positivity_score,
  ai_provider,
  ai_model,
  review_duration_ms,
  title,
  reason,
  original_url
from public.article_ai_reviews
where decision = 'reject'
order by reviewed_at desc
limit 50;
```

Find accepted stories that were reviewed most recently:

```sql
select
  reviewed_at,
  source,
  category,
  positivity_score,
  ai_provider,
  ai_model,
  review_duration_ms,
  title,
  summary,
  original_url
from public.article_ai_reviews
where decision = 'accept'
order by reviewed_at desc
limit 50;
```

---

## Performance Indexes

The migration below supports dashboard filtering and time sorting:

```text
supabase/migrations/20260615004500_add_article_review_dashboard_indexes.sql
```

Indexes added:

```sql
article_ai_reviews_source_reviewed_idx
article_ai_reviews_category_reviewed_idx
article_ai_reviews_score_reviewed_idx
article_ai_reviews_decision_score_reviewed_idx
```

---

## Related Dashboards

| Dashboard | Use |
| --- | --- |
| `/admin/ai-usage` | See OpenAI usage and accepted/rejected counts by Worker run |
| `/admin/feed-health` | See source health and feed reliability |
| `/admin/feeds` | Enable/disable feeds and inspect source quality |
| `/admin/shards` | Check Worker shard execution health |
