#!/usr/bin/env node

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const LANGUAGE_CODES = (process.env.LANGUAGE_CODES || 'fr,ja')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const AUDIT_LIMIT = Math.max(1, Math.min(Number(process.env.AUDIT_LIMIT || 60), 500));
const WINDOW_MINUTES = Math.max(1, Math.min(Number(process.env.WINDOW_MINUTES || 45), 360));
const SHOW_ALL = /^(1|true|yes)$/i.test(process.env.SHOW_ALL || '');
const IN_CHUNK_SIZE = Math.max(5, Math.min(Number(process.env.IN_CHUNK_SIZE || 40), 80));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

function assertOk(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function encodePostgrestIn(values) {
  assertOk(values.length > 0, 'encodePostgrestIn requires at least one value.');
  return `in.(${values
    .map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')})`;
}

async function supabaseFetch(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase request failed ${response.status}: ${text}`);
  }

  if (!text) {
    return null;
  }

  return JSON.parse(text);
}


function chunkArray(values, size = IN_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchRowsByOriginalUrl({ table, select, originalUrls, filters = '' }) {
  const rows = [];

  for (const chunk of chunkArray(originalUrls)) {
    const path = `/rest/v1/${table}?select=${select}${filters}&original_url=${encodeURIComponent(encodePostgrestIn(chunk))}`;
    const chunkRows = await supabaseFetch(path);
    rows.push(...(chunkRows || []));
  }

  return rows;
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isoOrBlank(value) {
  const date = toDate(value);
  return date ? date.toISOString() : '';
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function groupByOriginalUrl(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const url = row.original_url;
    if (!url) continue;
    if (!map.has(url)) map.set(url, []);
    map.get(url).push(row);
  }
  return map;
}

function findNearbyRuns(article, workerRuns) {
  const articleDate = toDate(article.created_at || article.published_on_site_at || article.published_at);
  if (!articleDate) return [];

  const minTime = addMinutes(articleDate, -WINDOW_MINUTES).getTime();
  const maxTime = addMinutes(articleDate, WINDOW_MINUTES).getTime();

  return workerRuns.filter((run) => {
    const startedAt = toDate(run.run_started_at);
    const completedAt = toDate(run.run_completed_at);
    const runStart = startedAt?.getTime() ?? 0;
    const runEnd = completedAt?.getTime() ?? runStart;
    return runEnd >= minTime && runStart <= maxTime;
  });
}

function summarizeLikelyCauses(article, missingLanguageCodes, nearbyRuns, reviewRows) {
  const causes = [];
  const review = reviewRows[0];

  if (review?.decision && review.decision !== 'accept') {
    causes.push(`review row says decision=${review.decision}; this article should not normally be published`);
  }

  const runsWithMoreAcceptedThanDefaultTranslationLimit = nearbyRuns.filter((run) => Number(run.accepted_count || 0) > 12);
  if (runsWithMoreAcceptedThanDefaultTranslationLimit.length > 0) {
    causes.push('nearby Worker run accepted more than the default SUMMARY_TRANSLATION_LIMIT=12; the code before this diagnostic update silently skipped accepted articles after the limit');
  }

  const failedNearbyRuns = nearbyRuns.filter((run) => !run.success || !run.article_save_ok);
  if (failedNearbyRuns.length > 0) {
    causes.push('nearby Worker run has success=false or article_save_ok=false; inspect Worker logs around this timestamp');
  }

  if (missingLanguageCodes.length > 0 && causes.length === 0) {
    causes.push('missing article_summaries rows; search Better Stack by articleUrl to distinguish local AI failure, OpenAI fallback failure, Supabase save failure, or old limit skipping');
  }

  return causes;
}

const articles = await supabaseFetch(
  `/rest/v1/articles?select=id,source,title,original_url,published_at,published_on_site_at,created_at,ai_provider,ai_model,category,status&status=eq.published&order=published_on_site_at.desc.nullslast,created_at.desc&limit=${AUDIT_LIMIT}`,
);

const originalUrls = [...new Set((articles || []).map((article) => article.original_url).filter(Boolean))];

if (originalUrls.length === 0) {
  console.log('No published articles found.');
  process.exit(0);
}

const summaries = await fetchRowsByOriginalUrl({
  table: 'article_summaries',
  select: 'original_url,language_code,created_at,updated_at,generated_by,model',
  originalUrls,
  filters: `&language_code=${encodeURIComponent(encodePostgrestIn(LANGUAGE_CODES))}`,
});
const reviews = await fetchRowsByOriginalUrl({
  table: 'article_ai_reviews',
  select: 'original_url,reviewed_at,decision,ai_provider,ai_model,reason',
  originalUrls,
});

const articleDates = (articles || [])
  .map((article) => toDate(article.created_at || article.published_on_site_at || article.published_at))
  .filter(Boolean);
const minArticleDate = new Date(Math.min(...articleDates.map((date) => date.getTime())));
const maxArticleDate = new Date(Math.max(...articleDates.map((date) => date.getTime())));
const workerRuns = await supabaseFetch(
  `/rest/v1/worker_runs?select=run_started_at,run_completed_at,shard_index,max_ai_reviews,success,accepted_count,rejected_count,article_save_ok,review_save_ok,ai_usage_save_ok,cost_protection_limit_reached,spike_warning_triggered&run_started_at=gte.${encodeURIComponent(addMinutes(minArticleDate, -WINDOW_MINUTES).toISOString())}&run_started_at=lte.${encodeURIComponent(addMinutes(maxArticleDate, WINDOW_MINUTES).toISOString())}&order=run_started_at.desc&limit=200`,
);

const summariesByUrl = groupByOriginalUrl(summaries || []);
const reviewsByUrl = groupByOriginalUrl(reviews || []);

const rows = [];
for (const article of articles || []) {
  const summaryRows = summariesByUrl.get(article.original_url) || [];
  const availableLanguageCodes = new Set(summaryRows.map((summary) => String(summary.language_code).toLowerCase()));
  const missingLanguageCodes = LANGUAGE_CODES.filter((languageCode) => !availableLanguageCodes.has(languageCode));

  if (!SHOW_ALL && missingLanguageCodes.length === 0) {
    continue;
  }

  const nearbyRuns = findNearbyRuns(article, workerRuns || []);
  const reviewRows = reviewsByUrl.get(article.original_url) || [];
  const likelyCauses = summarizeLikelyCauses(article, missingLanguageCodes, nearbyRuns, reviewRows);

  rows.push({
    title: article.title,
    source: article.source,
    articleUrl: article.original_url,
    articleCreatedAt: isoOrBlank(article.created_at),
    publishedOnSiteAt: isoOrBlank(article.published_on_site_at),
    missingLanguages: missingLanguageCodes.join(',') || '-',
    availableLanguages: [...availableLanguageCodes].sort().join(',') || '-',
    review: reviewRows[0]
      ? `${reviewRows[0].decision} ${reviewRows[0].ai_provider || ''} ${reviewRows[0].ai_model || ''}`.trim()
      : 'no review row found',
    nearbyRuns: nearbyRuns
      .slice(0, 5)
      .map((run) => `shard=${run.shard_index} accepted=${run.accepted_count} maxAi=${run.max_ai_reviews} success=${run.success} start=${run.run_started_at}`)
      .join(' | ') || 'none found',
    likelyCauses: likelyCauses.join(' | '),
    betterStackSearches: [
      `service:nutsnews-worker articleUrl:\"${article.original_url}\"`,
      `service:nutsnews-worker event:worker.translation.skipped_by_limit`,
      `service:nutsnews-worker event:worker.refresh.completed`,
    ],
  });
}

if (rows.length === 0) {
  console.log(`No missing translations found in the latest ${AUDIT_LIMIT} published articles for languages: ${LANGUAGE_CODES.join(', ')}.`);
  process.exit(0);
}

console.log(`Found ${rows.length} article(s) with missing translations in the latest ${AUDIT_LIMIT} published articles.`);
console.log('');

for (const row of rows) {
  console.log('---');
  console.log(`Title: ${row.title}`);
  console.log(`Source: ${row.source}`);
  console.log(`URL: ${row.articleUrl}`);
  console.log(`Article created: ${row.articleCreatedAt || 'unknown'}`);
  console.log(`Published on site: ${row.publishedOnSiteAt || 'unknown'}`);
  console.log(`Missing languages: ${row.missingLanguages}`);
  console.log(`Available languages: ${row.availableLanguages}`);
  console.log(`Review: ${row.review}`);
  console.log(`Nearby worker runs: ${row.nearbyRuns}`);
  console.log(`Likely cause: ${row.likelyCauses}`);
  console.log('Better Stack searches:');
  for (const search of row.betterStackSearches) {
    console.log(`  ${search}`);
  }
}
