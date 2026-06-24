#!/usr/bin/env node

/**
 * Backfill French NutsNews article summaries.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *
 * Optional env:
 *   BACKFILL_LIMIT=25
 *   OPENAI_MODEL=gpt-4o-mini
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const BACKFILL_LIMIT = Math.max(1, Math.min(Number(process.env.BACKFILL_LIMIT ?? '25') || 25, 100));
const LANGUAGE_CODE = 'fr';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required env. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY.');
  process.exit(1);
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

function normalizeText(value) {
  return String(value ?? '')
    .replace(/[`*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function trimSummary(value, maxChars = 250) {
  const text = normalizeText(value);

  if (text.length <= maxChars) {
    return text;
  }

  const slice = text.slice(0, maxChars + 1);
  const sentenceBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));

  if (sentenceBreak >= 120) {
    return slice.slice(0, sentenceBreak + 1).trim();
  }

  const wordBreak = slice.lastIndexOf(' ');
  const trimmed = slice.slice(0, wordBreak > 0 ? wordBreak : maxChars).replace(/[\s,;:.-]+$/, '').trim();

  if (!trimmed) {
    return text.slice(0, maxChars).trim();
  }

  const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return punctuated.length <= maxChars ? punctuated : trimmed.slice(0, maxChars).trim();
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed ${response.status}: ${text}`);
  }

  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text);
}

async function loadCandidateArticles() {
  const articles = await supabaseFetch(
    '/rest/v1/articles?select=id,source,title,original_url,ai_summary,category&status=eq.published&image_url=not.is.null&order=published_on_site_at.desc&limit=5000',
  );

  if (articles.length === 0) {
    return [];
  }

  const existingSummaries = await supabaseFetch(
    `/rest/v1/article_summaries?select=original_url&language_code=eq.${LANGUAGE_CODE}&limit=10000`,
  );

  const existingUrls = new Set(existingSummaries.map((summary) => summary.original_url));

  return articles
    .filter((article) => article.original_url && !existingUrls.has(article.original_url))
    .slice(0, BACKFILL_LIMIT);
}

async function translateArticle(article) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You translate NutsNews article cards into French. Preserve meaning and warm positive tone. Do not add facts. Do not translate URLs or source names. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Translate this NutsNews article card into French.\n\nSource: ${article.source}\nEnglish title: ${article.title}\nEnglish summary: ${article.ai_summary}\nCategory: ${article.category}\n\nReturn JSON exactly like this:\n{\n  "language_code": "fr",\n  "title": "Natural French title, no added facts",\n  "summary": "Natural French summary between 200 and 250 characters, no added facts"\n}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI returned an empty translation response.');
  }

  const parsed = JSON.parse(content);

  return {
    original_url: article.original_url,
    language_code: LANGUAGE_CODE,
    source_language_code: 'en',
    title: normalizeText(parsed.title || article.title).slice(0, 220).trim() || article.title,
    summary: trimSummary(parsed.summary || article.ai_summary),
    generated_by: 'openai',
    model: OPENAI_MODEL,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSummaries(summaries) {
  if (summaries.length === 0) {
    return;
  }

  await supabaseFetch('/rest/v1/article_summaries?on_conflict=original_url,language_code', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(summaries),
  });
}

const candidates = await loadCandidateArticles();
console.log(`Found ${candidates.length} article(s) missing French summaries.`);

const summaries = [];

for (const article of candidates) {
  console.log(`Translating: ${article.title}`);
  summaries.push(await translateArticle(article));
}

await upsertSummaries(summaries);
console.log(`Saved ${summaries.length} French summary translation(s).`);
