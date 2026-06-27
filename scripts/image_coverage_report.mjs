#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const LIMIT = Math.max(1, Math.min(Number(process.env.IMAGE_COVERAGE_LIMIT || 300), 5000));
const CHECK_HEADS = /^(1|true|yes)$/i.test(process.env.CHECK_IMAGE_HEADS || '0');
const OUT_DIR = path.join(process.cwd(), 'reports', 'image-coverage');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log('Skipping image coverage report because SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(0);
}
mkdirSync(OUT_DIR, { recursive: true });

async function supabase(pathname) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

async function imageHead(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    return { ok: response.ok, status: response.status, contentType: response.headers.get('content-type') };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const articles = await supabase(`/rest/v1/articles?select=id,source,title,original_url,image_url,published_on_site_at,status&status=eq.published&order=published_on_site_at.desc.nullslast,created_at.desc&limit=${LIMIT}`);
const missing = articles.filter((article) => !article.image_url);
const byHost = new Map();
for (const article of articles) {
  if (!article.image_url) continue;
  try {
    const host = new URL(article.image_url).hostname;
    byHost.set(host, (byHost.get(host) || 0) + 1);
  } catch {
    byHost.set('invalid-url', (byHost.get('invalid-url') || 0) + 1);
  }
}

let broken = [];
if (CHECK_HEADS) {
  const sample = articles.filter((article) => article.image_url).slice(0, 50);
  for (const article of sample) {
    const result = await imageHead(article.image_url);
    if (!result.ok) broken.push({ title: article.title, imageUrl: article.image_url, ...result });
  }
}

const coverage = articles.length ? ((articles.length - missing.length) / articles.length) * 100 : 0;
const topHosts = [...byHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
const report = { createdAt: new Date().toISOString(), checked: articles.length, missingCount: missing.length, coveragePercent: Number(coverage.toFixed(2)), topHosts, broken };
const markdown = [
  '# NutsNews Image Coverage Report',
  '',
  `Generated: ${report.createdAt}`,
  '',
  `- Articles checked: ${articles.length}`,
  `- Missing image_url: ${missing.length}`,
  `- Coverage: ${report.coveragePercent}%`,
  `- HEAD checks: ${CHECK_HEADS ? 'enabled' : 'disabled'}`,
  '',
  '## Top image hosts',
  '',
  topHosts.length ? '| Host | Count |\n|---|---:|\n' + topHosts.map(([host, count]) => `| ${host} | ${count} |`).join('\n') : 'No image hosts found.',
  '',
  missing.length ? '## Missing image examples\n\n' + missing.slice(0, 25).map((article) => `- ${article.title} (${article.source})`).join('\n') : 'No missing images found in checked articles.',
  '',
  broken.length ? '## Broken image HEAD checks\n\n' + broken.map((item) => `- ${item.status || item.error}: ${item.title} — ${item.imageUrl}`).join('\n') : '',
  '',
].join('\n');

writeFileSync(path.join(OUT_DIR, 'image-coverage-report.md'), markdown);
writeFileSync(path.join(OUT_DIR, 'image-coverage-report.json'), JSON.stringify(report, null, 2));
console.log(markdown);
if (missing.length > 0) process.exitCode = 1;
