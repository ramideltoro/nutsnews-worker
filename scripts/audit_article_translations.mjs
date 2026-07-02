#!/usr/bin/env node

/**
 * Audit NutsNews translated article titles/summaries for coverage and quality.
 *
 * Required env:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   LANGUAGE_CODES=fr,ja,de-CH,de,el
 *   AUDIT_LIMIT=100
 *   AUDIT_SOURCE=public_feed_snapshot   # public_feed_snapshot or articles
 *   TRANSLATION_QUALITY_REPORT_PATH=reports/translations/translation-quality.md
 *   TRANSLATION_QUALITY_FAIL_ON_CRITICAL=false
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const LANGUAGE_CODES = parseLanguages(process.env.LANGUAGE_CODES ?? process.env.LANGUAGE_CODE ?? 'fr,ja,de-CH,de,el');
const AUDIT_LIMIT = clampNumber(process.env.AUDIT_LIMIT, 100, 1, 500);
const AUDIT_SOURCE = normalizeAuditSource(process.env.AUDIT_SOURCE ?? 'public_feed_snapshot');
const SUMMARY_LOOKUP_LIMIT = clampNumber(process.env.SUMMARY_LOOKUP_LIMIT, 20000, 1, 50000);
const REPORT_PATH = process.env.TRANSLATION_QUALITY_REPORT_PATH || '';
const FAIL_ON_CRITICAL = /^(1|true|yes)$/i.test(process.env.TRANSLATION_QUALITY_FAIL_ON_CRITICAL || '');

const SUPPORTED_LANGUAGE_CODES = new Set(['fr', 'ja', 'de-CH', 'de', 'el']);
const DEFAULT_LANGUAGE_CODE = 'en';
const TITLE_MIN_CHARS = 6;
const TITLE_MAX_CHARS = 220;
const SUMMARY_MIN_CHARS = 80;
const SUMMARY_CRITICAL_MIN_CHARS = 40;
const SUMMARY_MAX_CHARS = 420;
const JAPANESE_SCRIPT_RE = /[\u3040-\u30ff\u3400-\u9fff]/;
const GREEK_SCRIPT_RE = /[\u0370-\u03ff]/;

const ENGLISH_MARKERS = new Set([
  'a',
  'about',
  'after',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'community',
  'for',
  'from',
  'good',
  'has',
  'have',
  'help',
  'in',
  'is',
  'it',
  'new',
  'news',
  'of',
  'on',
  'people',
  'story',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
]);

const TARGET_MARKERS = {
  fr: new Set(['au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en', 'est', 'et', 'la', 'le', 'les', 'leur', 'leurs', 'mais', 'par', 'pour', 'que', 'qui', 'sur', 'une']),
  ja: new Set(),
  'de-CH': new Set(['auf', 'aus', 'das', 'dem', 'den', 'der', 'des', 'die', 'ein', 'eine', 'einen', 'einer', 'für', 'im', 'ist', 'mit', 'und', 'von', 'zu', 'über']),
  de: new Set(['auf', 'aus', 'das', 'dem', 'den', 'der', 'des', 'die', 'ein', 'eine', 'einen', 'einer', 'für', 'im', 'ist', 'mit', 'und', 'von', 'zu', 'über']),
  el: new Set(),
};

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

  if (lowerValue === 'gr' || lowerValue === 'greek') {
    return 'el';
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
        .filter((languageCode) => SUPPORTED_LANGUAGE_CODES.has(languageCode)),
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

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase('en-US')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function wordTokens(value) {
  return normalizeComparable(value).split(/\s+/).filter(Boolean);
}

function ratioForMarkers(tokens, markers) {
  if (tokens.length === 0) {
    return 0;
  }

  return tokens.filter((token) => markers.has(token)).length / tokens.length;
}

function looksLikeEnglish(value, languageCode) {
  if (languageCode === DEFAULT_LANGUAGE_CODE || languageCode === 'ja' || languageCode === 'el') {
    return false;
  }

  const tokens = wordTokens(value);

  if (tokens.length < 6) {
    return false;
  }

  const englishRatio = ratioForMarkers(tokens, ENGLISH_MARKERS);
  const targetRatio = ratioForMarkers(tokens, TARGET_MARKERS[languageCode] ?? new Set());

  return englishRatio >= 0.18 && targetRatio <= 0.05;
}

function isSameText(left, right) {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
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

async function loadExistingSummaries(originalUrls) {
  if (originalUrls.length === 0) {
    return [];
  }

  return supabaseFetch(
    `/rest/v1/article_summaries?select=original_url,language_code,title,summary,updated_at,generated_by,model&language_code=in.(${LANGUAGE_CODES.join(',')})&limit=${SUMMARY_LOOKUP_LIMIT}`,
  );
}

function validateTranslation({ article, summary, languageCode }) {
  const warnings = [];
  const title = normalizeWhitespace(summary?.title);
  const summaryText = normalizeWhitespace(summary?.summary);
  const rowLanguageCode = normalizeWhitespace(summary?.language_code);

  function push({ code, severity, message, field }) {
    warnings.push({ code, severity, message, field });
  }

  if (!summary) {
    push({
      code: 'missing_translation',
      severity: 'missing',
      field: 'row',
      message: `Missing ${languageCode} translation row. Public feed falls back to English for this card.`,
    });
    return warnings;
  }

  if (!rowLanguageCode) {
    push({ code: 'missing_language_code', severity: 'critical', field: 'language_code', message: 'Translation row is missing language_code.' });
  } else if (rowLanguageCode !== languageCode) {
    push({ code: 'language_code_mismatch', severity: 'critical', field: 'language_code', message: `Translation row language_code is ${rowLanguageCode}, expected ${languageCode}.` });
  }

  if (!title) {
    push({ code: 'missing_title', severity: 'critical', field: 'title', message: 'Translated title is missing.' });
  } else if (title.length < TITLE_MIN_CHARS) {
    push({ code: 'short_title', severity: 'warning', field: 'title', message: `Translated title is short (${title.length} chars).` });
  } else if (title.length > TITLE_MAX_CHARS) {
    push({ code: 'long_title', severity: 'warning', field: 'title', message: `Translated title is long (${title.length} chars).` });
  }

  if (!summaryText) {
    push({ code: 'missing_summary', severity: 'critical', field: 'summary', message: 'Translated summary is missing.' });
  } else if (summaryText.length < SUMMARY_CRITICAL_MIN_CHARS) {
    push({ code: 'summary_too_short', severity: 'critical', field: 'summary', message: `Translated summary is too short (${summaryText.length} chars).` });
  } else if (summaryText.length < SUMMARY_MIN_CHARS) {
    push({ code: 'short_summary', severity: 'warning', field: 'summary', message: `Translated summary is shorter than the preferred range (${summaryText.length} chars).` });
  } else if (summaryText.length > SUMMARY_MAX_CHARS) {
    push({ code: 'long_summary', severity: 'warning', field: 'summary', message: `Translated summary is longer than the preferred range (${summaryText.length} chars).` });
  }

  if (title && isSameText(title, article.title)) {
    push({ code: 'title_matches_english_source', severity: 'critical', field: 'title', message: 'Translated title matches the English source title.' });
  }

  if (summaryText && isSameText(summaryText, article.ai_summary)) {
    push({ code: 'summary_matches_english_source', severity: 'critical', field: 'summary', message: 'Translated summary matches the English source summary.' });
  }

  if (summaryText && languageCode === 'ja' && !JAPANESE_SCRIPT_RE.test(`${title} ${summaryText}`)) {
    push({ code: 'missing_japanese_script', severity: 'critical', field: 'summary', message: 'Japanese translation does not contain Japanese script.' });
  }

  if (summaryText && languageCode === 'el' && !GREEK_SCRIPT_RE.test(`${title} ${summaryText}`)) {
    push({ code: 'missing_greek_script', severity: 'critical', field: 'summary', message: 'Greek translation does not contain Greek script.' });
  }

  if (summaryText && looksLikeEnglish(`${title} ${summaryText}`, languageCode)) {
    push({ code: 'looks_like_english', severity: 'warning', field: 'summary', message: `Translation looks like English text stored under ${languageCode}.` });
  }

  return warnings;
}

function buildFinding({ article, languageCode, summary, warning }) {
  return {
    languageCode,
    severity: warning.severity,
    code: warning.code,
    message: warning.message,
    field: warning.field ?? '',
    title: article.title || 'Untitled article',
    source: article.source || 'Unknown source',
    originalUrl: article.original_url,
    provider: summary?.generated_by || 'n/a',
    model: summary?.model || 'n/a',
    updatedAt: summary?.updated_at || 'n/a',
  };
}

function summarizeByLanguage({ articles, summariesByKey }) {
  return LANGUAGE_CODES.map((languageCode) => {
    const findings = [];
    let availableCount = 0;

    for (const article of articles) {
      const summary = summariesByKey.get(getSummaryKey(article.original_url, languageCode));

      if (summary) {
        availableCount += 1;
      }

      const warnings = validateTranslation({ article, summary, languageCode });
      findings.push(...warnings.map((warning) => buildFinding({ article, languageCode, summary, warning })));
    }

    return {
      languageCode,
      expectedCount: articles.length,
      availableCount,
      missingCount: articles.length - availableCount,
      warningCount: findings.filter((finding) => finding.severity === 'warning').length,
      criticalCount: findings.filter((finding) => finding.severity === 'critical').length,
      findings,
    };
  });
}

function severityRank(severity) {
  if (severity === 'critical') return 0;
  if (severity === 'missing') return 1;
  return 2;
}

function buildMarkdownReport({ articles, languageSummaries, findings }) {
  const expectedCount = articles.length * LANGUAGE_CODES.length;
  const availableCount = languageSummaries.reduce((total, language) => total + language.availableCount, 0);
  const missingCount = languageSummaries.reduce((total, language) => total + language.missingCount, 0);
  const warningCount = languageSummaries.reduce((total, language) => total + language.warningCount, 0);
  const criticalCount = languageSummaries.reduce((total, language) => total + language.criticalCount, 0);
  const coveragePercent = expectedCount > 0 ? Math.round((availableCount / expectedCount) * 100) : 100;
  const lines = [];

  lines.push('# NutsNews translation quality report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Source: ${AUDIT_SOURCE}`);
  lines.push(`Visible articles checked: ${articles.length}`);
  lines.push(`Languages checked: ${LANGUAGE_CODES.join(', ')}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Expected translation rows: ${expectedCount}`);
  lines.push(`- Available translation rows: ${availableCount}`);
  lines.push(`- Coverage: ${coveragePercent}%`);
  lines.push(`- Missing translation rows: ${missingCount}`);
  lines.push(`- Quality warnings: ${warningCount}`);
  lines.push(`- Critical quality issues: ${criticalCount}`);
  lines.push('');
  lines.push('## Language matrix');
  lines.push('');
  lines.push('| Language | Available | Missing | Warnings | Critical |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');

  for (const language of languageSummaries) {
    lines.push(`| ${language.languageCode} | ${language.availableCount}/${language.expectedCount} | ${language.missingCount} | ${language.warningCount} | ${language.criticalCount} |`);
  }

  lines.push('');
  lines.push('## Fallback policy');
  lines.push('');
  lines.push('Missing or critically invalid translations must not break the public feed. The website falls back to the canonical English title and summary for that card while the report and admin dashboard surface the gap.');
  lines.push('');
  lines.push('## Findings');
  lines.push('');

  if (findings.length === 0) {
    lines.push('No missing translations or quality warnings were found in the checked sample.');
  } else {
    for (const finding of findings.slice(0, 100)) {
      lines.push(`- **${finding.severity.toUpperCase()}** ${finding.languageCode} ${finding.code}: ${finding.title}`);
      lines.push(`  - ${finding.message}`);
      lines.push(`  - Source: ${finding.source}`);
      lines.push(`  - URL: ${finding.originalUrl}`);
      lines.push(`  - Provider/model: ${finding.provider} / ${finding.model}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function printConsoleReport({ articles, languageSummaries, findings }) {
  const expectedCount = articles.length * LANGUAGE_CODES.length;
  const availableCount = languageSummaries.reduce((total, language) => total + language.availableCount, 0);
  const missingCount = languageSummaries.reduce((total, language) => total + language.missingCount, 0);
  const warningCount = languageSummaries.reduce((total, language) => total + language.warningCount, 0);
  const criticalCount = languageSummaries.reduce((total, language) => total + language.criticalCount, 0);
  const coveragePercent = expectedCount > 0 ? Math.round((availableCount / expectedCount) * 100) : 100;

  console.log('NutsNews translation quality audit');
  console.log('----------------------------------');
  console.log(`Source: ${AUDIT_SOURCE}`);
  console.log(`Visible articles checked: ${articles.length}`);
  console.log(`Languages checked: ${LANGUAGE_CODES.join(', ')}`);
  console.log(`Expected translation rows: ${expectedCount}`);
  console.log(`Available translation rows: ${availableCount}`);
  console.log(`Coverage: ${coveragePercent}%`);
  console.log(`Missing translation rows: ${missingCount}`);
  console.log(`Quality warnings: ${warningCount}`);
  console.log(`Critical quality issues: ${criticalCount}`);
  console.log('');

  for (const language of languageSummaries) {
    console.log(`[${language.languageCode}] available ${language.availableCount}/${language.expectedCount}; missing ${language.missingCount}; warnings ${language.warningCount}; critical ${language.criticalCount}`);
  }

  if (findings.length > 0) {
    console.log('\nFindings:');
    for (const finding of findings.slice(0, 30)) {
      console.log(`- [${finding.severity}] [${finding.languageCode}] ${finding.code}: ${finding.title}`);
      console.log(`  ${finding.message}`);
      console.log(`  ${finding.originalUrl}`);
    }
  } else {
    console.log('\nNo missing translations or quality warnings found in the checked sample.');
  }

  console.log('\nFallback policy: missing or critically invalid translations fall back to English and should not break the public feed.');
}

const articles = (await loadVisibleArticles()) ?? [];
const summaries = (await loadExistingSummaries(articles.map((article) => article.original_url).filter(Boolean))) ?? [];
const summariesByKey = new Map(summaries.map((summary) => [getSummaryKey(summary.original_url, summary.language_code), summary]));
const languageSummaries = summarizeByLanguage({ articles, summariesByKey });
const findings = languageSummaries
  .flatMap((language) => language.findings)
  .sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || left.title.localeCompare(right.title));

printConsoleReport({ articles, languageSummaries, findings });

if (REPORT_PATH) {
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, buildMarkdownReport({ articles, languageSummaries, findings }));
  console.log(`\nMarkdown report written to ${REPORT_PATH}`);
}

if (FAIL_ON_CRITICAL && findings.some((finding) => finding.severity === 'critical')) {
  console.error('\nCritical translation quality issues found.');
  process.exit(1);
}
