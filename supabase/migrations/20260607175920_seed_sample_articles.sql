insert into articles (
  source,
  title,
  original_url,
  image_url,
  published_at,
  original_excerpt,
  ai_summary,
  category,
  positivity_score,
  status
)
values
(
  'NPR',
  'A community garden brings neighbors together',
  'https://example.com/community-garden',
  null,
  now(),
  'A neighborhood garden project is helping residents connect and grow fresh food.',
  'A small community garden is creating warm connections between neighbors while bringing fresh greenery into everyday life. It is a gentle reminder that simple shared spaces can make a place feel more joyful.',
  'Community',
  9,
  'published'
),
(
  'BBC',
  'Scientists discover a hopeful breakthrough in ocean restoration',
  'https://example.com/ocean-restoration',
  null,
  now(),
  'Researchers are finding new ways to help restore ocean habitats.',
  'Scientists are exploring promising ways to support healthier ocean habitats. Their work offers a hopeful look at how care, research, and patience can help nature recover.',
  'Science',
  8,
  'published'
)
on conflict (original_url) do nothing;