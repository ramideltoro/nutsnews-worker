#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OUT_DIR = path.join(process.cwd(), 'reports', 'db-growth');
const TABLES = ['articles', 'article_summaries', 'rss_feeds', 'worker_runs', 'article_ai_reviews', 'ai_usage_runs'];
const ARTICLE_WARNING_COUNT = Number(process.env.ARTICLE_WARNING_COUNT || 50000);
const ARTICLE_SUMMARY_WARNING_COUNT = Number(process.env.ARTICLE_SUMMARY_WARNING_COUNT || 150000);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log('Skipping DB growth check because SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });

async function countTable(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${table} count failed ${response.status}: ${text.slice(0, 500)}`);
  const contentRange = response.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+|\*)$/);
  return match && match[1] !== '*' ? Number(match[1]) : null;
}

const report = { createdAt: new Date().toISOString(), warnings: [], tables: [] };

for (const table of TABLES) {
  try {
    const count = await countTable(table);
    report.tables.push({ table, count });
    console.log(`${table}: ${count ?? 'unknown'} row(s)`);
  } catch (error) {
    report.tables.push({ table, error: error.message });
    report.warnings.push(`${table}: ${error.message}`);
  }
}

const articles = report.tables.find((item) => item.table === 'articles')?.count ?? 0;
const summaries = report.tables.find((item) => item.table === 'article_summaries')?.count ?? 0;
if (articles >= ARTICLE_WARNING_COUNT) report.warnings.push(`articles count ${articles} is at/above warning threshold ${ARTICLE_WARNING_COUNT}`);
if (summaries >= ARTICLE_SUMMARY_WARNING_COUNT) report.warnings.push(`article_summaries count ${summaries} is at/above warning threshold ${ARTICLE_SUMMARY_WARNING_COUNT}`);

const markdown = [
  '# NutsNews DB Growth Report',
  '',
  `Generated: ${report.createdAt}`,
  '',
  '| Table | Rows |',
  '|---|---:|',
  ...report.tables.map((item) => `| ${item.table} | ${item.error ? `ERROR: ${item.error.replace(/\|/g, '\\|')}` : item.count ?? 'unknown'} |`),
  '',
  report.warnings.length ? '## Warnings\n\n' + report.warnings.map((warning) => `- ${warning}`).join('\n') : 'No DB growth warnings.',
  '',
].join('\n');

writeFileSync(path.join(OUT_DIR, 'db-growth-report.md'), markdown);
writeFileSync(path.join(OUT_DIR, 'db-growth-report.json'), JSON.stringify(report, null, 2));

if (report.warnings.length > 0) {
  console.error(report.warnings.join('\n'));
  process.exit(1);
}
console.log('DB growth check passed.');
