#!/usr/bin/env node

/**
 * Audit missing NutsNews article title/summary translations.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   LANGUAGE_CODES=fr,ja,de-CH,de,el
 *   AUDIT_LIMIT=30
 *   AUDIT_SOURCE=public_feed_snapshot   # public_feed_snapshot or articles
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LANGUAGE_CODES = parseLanguages(process.env.LANGUAGE_CODES ?? process.env.LANGUAGE_CODE ?? 'fr,ja,de-CH,de,el');
const AUDIT_LIMIT = clampNumber(process.env.AUDIT_LIMIT, 30, 1, 500);
const AUDIT_SOURCE = normalizeAuditSource(process.env.AUDIT_SOURCE ?? 'public_feed_snapshot');
const SUMMARY_LOOKUP_LIMIT = clampNumber(process.env.SUMMARY_LOOKUP_LIMIT, 20000, 1, 50000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
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

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value ?? '');

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function normalizeAuditSource(value) {
  return value === 'articles' ? 'articles' : 'public_feed_snapshot';
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

async function loadVisibleArticles() {
  if (AUDIT_SOURCE === 'articles') {
    return supabaseFetch(
      `/rest/v1/articles?select=id,source,title,original_url,ai_summary,category,published_on_site_at&status=eq.published&image_url=not.is.null&order=published_on_site_at.desc&limit=${AUDIT_LIMIT}`,
    );
  }

  return supabaseFetch(
    `/rest/v1/public_feed_snapshot?select=id,source,title,original_url,ai_summary,category,published_on_site_at,snapshot_rank&order=snapshot_rank.asc&limit=${AUDIT_LIMIT}`,
  );
}

async function loadExistingSummaries() {
  return supabaseFetch(
    `/rest/v1/article_summaries?select=original_url,language_code,updated_at,generated_by,model&language_code=in.(${LANGUAGE_CODES.join(',')})&limit=${SUMMARY_LOOKUP_LIMIT}`,
  );
}

function summarizeMissing(articles, summaries) {
  const summaryRows = summaries ?? [];
  const existingKeys = new Set(
    summaryRows.map((summary) => getSummaryKey(summary.original_url, summary.language_code)),
  );
  const missing = [];

  for (const article of articles ?? []) {
    for (const languageCode of LANGUAGE_CODES) {
      if (!existingKeys.has(getSummaryKey(article.original_url, languageCode))) {
        missing.push({
          languageCode,
          id: article.id,
          source: article.source,
          title: article.title,
          originalUrl: article.original_url,
          publishedOnSiteAt: article.published_on_site_at,
        });
      }
    }
  }

  return missing;
}

const articles = await loadVisibleArticles();
const summaries = await loadExistingSummaries();
const missing = summarizeMissing(articles, summaries);
const articleCount = articles?.length ?? 0;

console.log('NutsNews translation audit');
console.log('--------------------------');
console.log(`Source: ${AUDIT_SOURCE}`);
console.log(`Visible articles checked: ${articleCount}`);
console.log(`Languages checked: ${LANGUAGE_CODES.join(', ')}`);
console.log(`Missing translation rows: ${missing.length}`);

for (const languageCode of LANGUAGE_CODES) {
  const languageMissing = missing.filter((item) => item.languageCode === languageCode);
  console.log(`Missing ${languageCode}: ${languageMissing.length}`);
}

if (missing.length > 0) {
  console.log('\nMissing rows:');
  missing.forEach((item, index) => {
    console.log(`${index + 1}. [${item.languageCode}] ${item.title}`);
    console.log(`   Source: ${item.source}`);
    console.log(`   URL: ${item.originalUrl}`);
  });

  console.log('\nBackfill command suggestion:');
  console.log(`LANGUAGE_CODES=${LANGUAGE_CODES.join(',')} BACKFILL_SOURCE=${AUDIT_SOURCE} BACKFILL_LIMIT=${missing.length} node scripts/backfill_article_summaries.mjs`);
} else {
  console.log('\nAll checked article cards have translations for the selected language(s).');
}
