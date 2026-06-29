#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
 *   LANGUAGE_CODES=fr,ja,de-CH,de,el
 *   BACKFILL_LIMIT=25              # max translation rows saved in this run
 *   CANDIDATE_LIMIT=250            # recent articles to scan for missing rows
 *   SCAN_ALL_CANDIDATES=1           # scan article pages until a backfill batch is found
 *   CANDIDATE_PAGE_SIZE=1000        # page size when scanning all candidates
 *   FAILED_TRANSLATION_CACHE=/tmp/nutsnews-translation-failures.json
 *   RETRY_FAILED=1                  # retry rows already present in FAILED_TRANSLATION_CACHE
 *   BACKFILL_SOURCE=articles       # articles or public_feed_snapshot
 *   PUBLISH_READY=1                # publish translation_pending rows after all language rows exist
 *   DRY_RUN=1
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = safeHeaderValue(process.env.OPENAI_API_KEY);
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const LOCAL_AI_URL = process.env.LOCAL_AI_URL?.replace(/\/+$/, '');
const LOCAL_AI_API_KEY = safeHeaderValue(process.env.LOCAL_AI_API_KEY);
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL ?? 'qwen2.5:3b';
const LANGUAGE_CODES = parseLanguages(process.env.LANGUAGE_CODES ?? process.env.LANGUAGE_CODE ?? 'fr,ja,de-CH,de,el');
const BACKFILL_LIMIT = clampNumber(process.env.BACKFILL_LIMIT, 25, 1, 200);
const CANDIDATE_LIMIT = clampNumber(process.env.CANDIDATE_LIMIT, 250, 1, 5000);
const CANDIDATE_PAGE_SIZE = clampNumber(process.env.CANDIDATE_PAGE_SIZE, Math.min(CANDIDATE_LIMIT, 1000), 1, 1000);
const SCAN_ALL_CANDIDATES = isTruthy(process.env.SCAN_ALL_CANDIDATES);
const BACKFILL_SOURCE = normalizeBackfillSource(process.env.BACKFILL_SOURCE ?? 'articles');
const DRY_RUN = isTruthy(process.env.DRY_RUN);
const PUBLISH_READY = isTruthy(process.env.PUBLISH_READY ?? '1');
const FORCE = isTruthy(process.env.FORCE);
const RETRY_FAILED = isTruthy(process.env.RETRY_FAILED);
const FAILED_TRANSLATION_CACHE = String(process.env.FAILED_TRANSLATION_CACHE ?? '').trim();
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
  console.error('No supported languages selected. Use LANGUAGE_CODES=fr,ja,de-CH,de,el or a comma-separated subset.');
  process.exit(1);
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};


function safeHeaderValue(value) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed || /[\r\n\0]/.test(trimmed)) {
    return '';
  }

  return trimmed;
}

function encodePostgrestInFilter(values) {
  return `in.(${values
    .map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')})`;
}

function normalizeLanguageCode(value) {
  const normalizedValue = String(value ?? '').trim();
  const lowerValue = normalizedValue.toLowerCase();

  if (lowerValue === 'de-ch' || lowerValue === 'de_ch' || lowerValue === 'ch' || lowerValue === 'swiss') {
    return 'de-CH';
  }

  if (lowerValue === 'fr' || lowerValue === 'ja' || lowerValue === 'de' || lowerValue === 'el') {
    return lowerValue;
  }

  return '';
}

function parseLanguages(value) {
  return Array.from(
    new Set(
      String(value ?? '')
        .split(',')
        .map(normalizeLanguageCode)
        .filter(Boolean),
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

const LANGUAGE_NAMES = {
  fr: 'French',
  ja: 'Japanese',
  'de-CH': 'Swiss German',
  de: 'German',
  el: 'Greek',
};

function getLanguageName(languageCode) {
  return LANGUAGE_NAMES[languageCode] ?? 'the requested language';
}

function getSummaryKey(originalUrl, languageCode) {
  return `${languageCode}::${originalUrl}`;
}

function loadFailedTranslationCache() {
  if (!FAILED_TRANSLATION_CACHE || RETRY_FAILED) {
    return new Map();
  }

  try {
    if (!existsSync(FAILED_TRANSLATION_CACHE)) {
      return new Map();
    }

    const parsed = JSON.parse(readFileSync(FAILED_TRANSLATION_CACHE, 'utf8'));
    const rows = Array.isArray(parsed?.failedRows) ? parsed.failedRows : [];
    return new Map(
      rows
        .filter((row) => row?.originalUrl && row?.languageCode)
        .map((row) => [getSummaryKey(row.originalUrl, row.languageCode), row]),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not read FAILED_TRANSLATION_CACHE ${FAILED_TRANSLATION_CACHE}: ${message}`);
    return new Map();
  }
}

function saveFailedTranslationCache(failedRowsByKey) {
  if (!FAILED_TRANSLATION_CACHE || failedRowsByKey.size === 0) {
    return;
  }

  try {
    mkdirSync(dirname(FAILED_TRANSLATION_CACHE), { recursive: true });
    writeFileSync(
      FAILED_TRANSLATION_CACHE,
      `${JSON.stringify({ failedRows: Array.from(failedRowsByKey.values()) }, null, 2)}\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not write FAILED_TRANSLATION_CACHE ${FAILED_TRANSLATION_CACHE}: ${message}`);
  }
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

async function loadCandidateArticlesPage(offset = 0, limit = CANDIDATE_LIMIT) {
  const encodedOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const encodedLimit = Math.max(1, Math.floor(Number(limit) || 1));

  if (BACKFILL_SOURCE === 'articles') {
    return supabaseFetch(
      `/rest/v1/articles?select=id,source,title,original_url,ai_summary,category,published_on_site_at,status&status=in.(published,translation_pending)&image_url=not.is.null&ai_summary=not.is.null&order=published_on_site_at.desc&limit=${encodedLimit}&offset=${encodedOffset}`,
    );
  }

  return supabaseFetch(
    `/rest/v1/public_feed_snapshot?select=id,source,title,original_url,ai_summary,category,published_on_site_at,snapshot_rank&order=snapshot_rank.asc&limit=${encodedLimit}&offset=${encodedOffset}`,
  );
}

async function loadExistingSummaries(articles = []) {
  if (FORCE) {
    return [];
  }

  const urls = Array.from(new Set((articles ?? []).map((article) => article.original_url).filter(Boolean)));

  if (urls.length === 0) {
    return [];
  }

  const rows = [];
  const languageFilter = encodeURIComponent(encodePostgrestInFilter(LANGUAGE_CODES));
  const batchSize = 50;

  for (let index = 0; index < urls.length; index += batchSize) {
    const urlBatch = urls.slice(index, index + batchSize);
    const urlFilter = encodeURIComponent(encodePostgrestInFilter(urlBatch));
    const limit = Math.min(SUMMARY_LOOKUP_LIMIT, Math.max(100, urlBatch.length * LANGUAGE_CODES.length + 10));
    const page = await supabaseFetch(
      `/rest/v1/article_summaries?select=original_url,language_code&original_url=${urlFilter}&language_code=${languageFilter}&limit=${limit}`,
    );

    rows.push(...(page ?? []));
  }

  const uniqueRows = new Map();

  for (const row of rows) {
    if (row?.original_url && row?.language_code) {
      uniqueRows.set(getSummaryKey(row.original_url, row.language_code), row);
    }
  }

  return Array.from(uniqueRows.values());
}

function buildTranslationTasks(articles, existingSummaries, failedRowsByKey = new Map(), limit = BACKFILL_LIMIT) {
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

      if (!RETRY_FAILED && failedRowsByKey.has(key)) {
        continue;
      }

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      tasks.push({ article, languageCode });

      if (tasks.length >= limit) {
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

async function loadSummaryRowsForArticles(articles) {
  const urls = Array.from(new Set((articles ?? []).map((article) => article.original_url).filter(Boolean)));

  if (urls.length === 0) {
    return [];
  }

  return supabaseFetch(
    `/rest/v1/article_summaries?select=original_url,language_code&original_url=${encodeURIComponent(encodePostgrestInFilter(urls))}&language_code=${encodeURIComponent(encodePostgrestInFilter(LANGUAGE_CODES))}&limit=${Math.max(SUMMARY_LOOKUP_LIMIT, urls.length * LANGUAGE_CODES.length)}`,
  );
}

async function publishFullyTranslatedArticles(articles) {
  if (!PUBLISH_READY || !articles?.length) {
    return 0;
  }

  const summaries = await loadSummaryRowsForArticles(articles);
  const languagesByUrl = new Map();

  for (const summary of summaries ?? []) {
    const current = languagesByUrl.get(summary.original_url) ?? new Set();
    current.add(summary.language_code);
    languagesByUrl.set(summary.original_url, current);
  }

  const readyUrls = Array.from(
    new Set(
      articles
        .filter((article) => {
          const languages = languagesByUrl.get(article.original_url) ?? new Set();
          return LANGUAGE_CODES.every((languageCode) => languages.has(languageCode));
        })
        .map((article) => article.original_url)
        .filter(Boolean),
    ),
  );

  if (readyUrls.length === 0) {
    return 0;
  }

  await supabaseFetch(`/rest/v1/articles?original_url=${encodeURIComponent(encodePostgrestInFilter(readyUrls))}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status: 'published' }),
  });

  return readyUrls.length;
}

const failedRowsByKey = loadFailedTranslationCache();
const articles = [];
const tasks = [];
let candidateArticlesScanned = 0;
let candidateOffset = 0;
const pageSize = SCAN_ALL_CANDIDATES ? CANDIDATE_PAGE_SIZE : CANDIDATE_LIMIT;

while (tasks.length < BACKFILL_LIMIT) {
  const page = await loadCandidateArticlesPage(candidateOffset, pageSize);

  if (!page?.length) {
    break;
  }

  candidateArticlesScanned += page.length;
  articles.push(...page);

  const existingSummaries = await loadExistingSummaries(page);
  const pageTasks = buildTranslationTasks(page, existingSummaries, failedRowsByKey, BACKFILL_LIMIT - tasks.length);
  tasks.push(...pageTasks);

  if (!SCAN_ALL_CANDIDATES || page.length < pageSize || candidateArticlesScanned >= CANDIDATE_LIMIT) {
    break;
  }

  candidateOffset += page.length;
}

console.log('NutsNews translation backfill');
console.log('-----------------------------');
console.log(`Source: ${BACKFILL_SOURCE}`);
console.log(`Candidate articles scanned: ${candidateArticlesScanned}`);
console.log(`Languages: ${LANGUAGE_CODES.join(', ')}`);
console.log(`Missing translation rows selected: ${tasks.length}`);
console.log(`Provider preference: ${LOCAL_AI_URL ? 'local AI first' : 'OpenAI only'}`);
console.log(`Publish ready articles: ${PUBLISH_READY ? 'yes' : 'no'}`);
console.log(`Scan all candidates: ${SCAN_ALL_CANDIDATES ? 'yes' : 'no'}`);
console.log(`Failure cache: ${FAILED_TRANSLATION_CACHE || 'off'}`);

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
const failedRows = [];

for (const task of tasks) {
  console.log(`Translating [${task.languageCode}]: ${task.article.title}`);

  try {
    const summary = await translateArticle(task.article, task.languageCode);
    await upsertSummaries([summary]);
    summaries.push(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedRow = {
      languageCode: task.languageCode,
      originalUrl: task.article.original_url,
      title: task.article.title,
      error: message,
      failedAt: new Date().toISOString(),
    };
    failedRows.push(failedRow);
    failedRowsByKey.set(getSummaryKey(task.article.original_url, task.languageCode), failedRow);
    console.warn(`Skipping failed row [${task.languageCode}] ${task.article.title}: ${message}`);
  }
}

saveFailedTranslationCache(failedRowsByKey);

let publishedCount = 0;

try {
  publishedCount = await publishFullyTranslatedArticles(articles);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Publish-ready check failed, but saved translations were kept: ${message}`);
}

console.log(`Saved ${summaries.length} translation row(s).`);
console.log(`Failed/skipped ${failedRows.length} translation row(s).`);
console.log(`Published/confirmed ${publishedCount} fully translated article(s).`);

if (failedRows.length > 0) {
  console.log('Failed rows:');

  for (const [index, row] of failedRows.entries()) {
    console.log(`${index + 1}. [${row.languageCode}] ${row.title} — ${row.error}`);
  }
}
