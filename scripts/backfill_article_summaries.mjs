#!/usr/bin/env node

/**
 * Backfill missing NutsNews article title/summary translations.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Translation provider env, at least one required:
 *   LOCAL_AI_URL
 *   LOCAL_AI_API_KEY
 *   LOCAL_AI_MODEL=qwen2.5:3b
 *   OPENAI_API_KEY
 *   OPENAI_MODEL=gpt-4o-mini
 *
 * Optional env:
 *   LANGUAGE_CODES=fr,ja
 *   BACKFILL_LIMIT=25              # max translation rows saved in this run
 *   CANDIDATE_LIMIT=250            # recent articles to scan for missing rows
 *   BACKFILL_SOURCE=public_feed_snapshot   # public_feed_snapshot or articles
 *   DRY_RUN=1
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const LOCAL_AI_URL = process.env.LOCAL_AI_URL?.replace(/\/+$/, '');
const LOCAL_AI_API_KEY = process.env.LOCAL_AI_API_KEY;
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL ?? 'qwen2.5:3b';
const LANGUAGE_CODES = parseLanguages(process.env.LANGUAGE_CODES ?? process.env.LANGUAGE_CODE ?? 'fr,ja');
const BACKFILL_LIMIT = clampNumber(process.env.BACKFILL_LIMIT, 25, 1, 200);
const CANDIDATE_LIMIT = clampNumber(process.env.CANDIDATE_LIMIT, 250, 1, 5000);
const BACKFILL_SOURCE = normalizeBackfillSource(process.env.BACKFILL_SOURCE ?? 'public_feed_snapshot');
const DRY_RUN = isTruthy(process.env.DRY_RUN);
const FORCE = isTruthy(process.env.FORCE);
const SUMMARY_LOOKUP_LIMIT = clampNumber(process.env.SUMMARY_LOOKUP_LIMIT, 20000, 1, 50000);
const TRANSLATED_SUMMARY_MAX_CHARS = 250;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!LOCAL_AI_URL && !OPENAI_API_KEY) {
  console.error('Missing translation provider. Set LOCAL_AI_URL + LOCAL_AI_API_KEY, or set OPENAI_API_KEY.');
  process.exit(1);
}

if (LOCAL_AI_URL && !LOCAL_AI_API_KEY) {
  console.error('LOCAL_AI_URL is set, but LOCAL_AI_API_KEY is missing.');
  process.exit(1);
}

if (LANGUAGE_CODES.length === 0) {
  console.error('No supported languages selected. Use LANGUAGE_CODES=fr,ja, LANGUAGE_CODES=fr, or LANGUAGE_CODES=ja.');
  process.exit(1);
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

function parseLanguages(value) {
  return Array.from(
    new Set(
      String(value ?? '')
        .split(',')
        .map((language) => language.trim().toLowerCase())
        .filter((language) => language === 'fr' || language === 'ja'),
    ),
  );
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value ?? '');

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function normalizeBackfillSource(value) {
  return value === 'articles' ? 'articles' : 'public_feed_snapshot';
}

function normalizeText(value, fallback = '') {
  return String(value ?? fallback)
    .replace(/[`*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?。、！？])/g, '$1')
    .trim();
}

function trimSummary(value, maxChars = TRANSLATED_SUMMARY_MAX_CHARS) {
  const text = normalizeText(value);

  if (text.length <= maxChars) {
    return text;
  }

  const slice = text.slice(0, maxChars + 1);
  const sentenceBreak = Math.max(
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );

  if (sentenceBreak >= 120) {
    return slice.slice(0, sentenceBreak + 1).trim();
  }

  const wordBreak = slice.lastIndexOf(' ');
  const trimmed = slice.slice(0, wordBreak > 0 ? wordBreak : maxChars).replace(/[\s,;:。！？、.-]+$/, '').trim();

  if (!trimmed) {
    return text.slice(0, maxChars).trim();
  }

  const punctuated = /[。！？.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return punctuated.length <= maxChars ? punctuated : trimmed.slice(0, maxChars).trim();
}

function getLanguageName(languageCode) {
  if (languageCode === 'fr') {
    return 'French';
  }

  if (languageCode === 'ja') {
    return 'Japanese';
  }

  return 'the requested language';
}

function getSummaryKey(originalUrl, languageCode) {
  return `${languageCode}::${originalUrl}`;
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
  return text.trim() ? JSON.parse(text) : null;
}

async function loadCandidateArticles() {
  if (BACKFILL_SOURCE === 'articles') {
    return supabaseFetch(
      `/rest/v1/articles?select=id,source,title,original_url,ai_summary,category,published_on_site_at&status=eq.published&image_url=not.is.null&ai_summary=not.is.null&order=published_on_site_at.desc&limit=${CANDIDATE_LIMIT}`,
    );
  }

  return supabaseFetch(
    `/rest/v1/public_feed_snapshot?select=id,source,title,original_url,ai_summary,category,published_on_site_at,snapshot_rank&order=snapshot_rank.asc&limit=${CANDIDATE_LIMIT}`,
  );
}

async function loadExistingSummaries() {
  if (FORCE) {
    return [];
  }

  return supabaseFetch(
    `/rest/v1/article_summaries?select=original_url,language_code&language_code=in.(${LANGUAGE_CODES.join(',')})&limit=${SUMMARY_LOOKUP_LIMIT}`,
  );
}

function buildTranslationTasks(articles, existingSummaries) {
  const existingKeys = new Set(
    (existingSummaries ?? []).map((summary) => getSummaryKey(summary.original_url, summary.language_code)),
  );
  const tasks = [];
  const seen = new Set();

  for (const article of articles ?? []) {
    if (!article.original_url || !article.title || !article.ai_summary) {
      continue;
    }

    for (const languageCode of LANGUAGE_CODES) {
      const key = getSummaryKey(article.original_url, languageCode);

      if (!FORCE && existingKeys.has(key)) {
        continue;
      }

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      tasks.push({ article, languageCode });

      if (tasks.length >= BACKFILL_LIMIT) {
        return tasks;
      }
    }
  }

  return tasks;
}

async function translateWithLocalAi(article, languageCode) {
  if (!LOCAL_AI_URL || !LOCAL_AI_API_KEY) {
    return null;
  }

  const response = await fetch(`${LOCAL_AI_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nutsnews-ai-key': LOCAL_AI_API_KEY,
    },
    body: JSON.stringify({
      model: LOCAL_AI_MODEL,
      language_code: languageCode,
      language_name: getLanguageName(languageCode),
      source: article.source,
      title: article.title,
      summary: article.ai_summary,
      category: article.category,
      url: article.original_url,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Local AI translation failed ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (!normalizeText(data.title) || !normalizeText(data.summary)) {
    throw new Error('Local AI translation missed title or summary.');
  }

  return {
    original_url: article.original_url,
    language_code: languageCode,
    source_language_code: 'en',
    title: normalizeText(data.title || article.title).slice(0, 220).trim() || article.title,
    summary: trimSummary(data.summary || article.ai_summary),
    generated_by: 'local',
    model: data.ai_model || data.model || LOCAL_AI_MODEL,
    updated_at: new Date().toISOString(),
  };
}

async function translateWithOpenAi(article, languageCode) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const languageName = getLanguageName(languageCode);
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
            'You translate NutsNews article cards. Preserve meaning and warm positive tone. Do not add facts. Do not translate URLs or source names. Return only valid JSON.',
        },
        {
          role: 'user',
          content: `Translate this NutsNews article card into ${languageName}.\n\nSource: ${article.source}\nEnglish title: ${article.title}\nEnglish summary: ${article.ai_summary}\nCategory: ${article.category}\n\nReturn JSON exactly like this:\n{\n  "language_code": "${languageCode}",\n  "title": "Natural ${languageName} title, no added facts",\n  "summary": "Natural ${languageName} summary between 200 and 250 characters, no added facts"\n}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI translation failed ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI returned an empty translation response.');
  }

  const parsed = JSON.parse(content);

  return {
    original_url: article.original_url,
    language_code: languageCode,
    source_language_code: 'en',
    title: normalizeText(parsed.title || article.title).slice(0, 220).trim() || article.title,
    summary: trimSummary(parsed.summary || article.ai_summary),
    generated_by: 'openai',
    model: OPENAI_MODEL,
    updated_at: new Date().toISOString(),
  };
}

async function translateArticle(article, languageCode) {
  if (LOCAL_AI_URL && LOCAL_AI_API_KEY) {
    try {
      return await translateWithLocalAi(article, languageCode);
    } catch (error) {
      console.warn(`Local AI failed for [${languageCode}] ${article.title}: ${error.message}`);

      if (!OPENAI_API_KEY) {
        throw error;
      }
    }
  }

  const openAiTranslation = await translateWithOpenAi(article, languageCode);

  if (!openAiTranslation) {
    throw new Error('No translation provider succeeded.');
  }

  return openAiTranslation;
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

const articles = await loadCandidateArticles();
const existingSummaries = await loadExistingSummaries();
const tasks = buildTranslationTasks(articles, existingSummaries);

console.log('NutsNews translation backfill');
console.log('-----------------------------');
console.log(`Source: ${BACKFILL_SOURCE}`);
console.log(`Candidate articles scanned: ${articles?.length ?? 0}`);
console.log(`Languages: ${LANGUAGE_CODES.join(', ')}`);
console.log(`Missing translation rows selected: ${tasks.length}`);
console.log(`Provider preference: ${LOCAL_AI_URL ? 'local AI first' : 'OpenAI only'}`);

if (tasks.length === 0) {
  console.log('Nothing to backfill.');
  process.exit(0);
}

for (const [index, task] of tasks.entries()) {
  console.log(`${index + 1}. [${task.languageCode}] ${task.article.title}`);
}

if (DRY_RUN) {
  console.log('\nDRY_RUN=1 set. No translations were generated or saved.');
  process.exit(0);
}

const summaries = [];

for (const task of tasks) {
  console.log(`Translating [${task.languageCode}]: ${task.article.title}`);
  summaries.push(await translateArticle(task.article, task.languageCode));
}

await upsertSummaries(summaries);
console.log(`Saved ${summaries.length} translation row(s).`);
