#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLES = String(process.env.BACKUP_TABLES || 'articles,article_summaries,rss_feeds,worker_runs,article_ai_reviews,ai_usage_runs')
  .split(',')
  .map((table) => table.trim())
  .filter(Boolean);
const LIMIT = Math.max(1, Math.min(Number(process.env.BACKUP_LIMIT_PER_TABLE || 5000), 50000));
const OUT_DIR = path.join(process.cwd(), 'backups', 'supabase');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log('Skipping Supabase backup because SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });

async function fetchTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${LIMIT}`;
  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${table} backup failed ${response.status}: ${text.slice(0, 500)}`);
  return { rows: text ? JSON.parse(text) : [], contentRange: response.headers.get('content-range') || '' };
}

const now = new Date().toISOString().replace(/[:.]/g, '-');
const manifest = { createdAt: new Date().toISOString(), limitPerTable: LIMIT, tables: [] };

for (const table of TABLES) {
  console.log(`Exporting ${table}...`);
  try {
    const { rows, contentRange } = await fetchTable(table);
    const json = JSON.stringify(rows, null, 2);
    const baseName = `${now}-${table}.json`;
    const jsonPath = path.join(OUT_DIR, baseName);
    const gzipPath = `${jsonPath}.gz`;
    writeFileSync(jsonPath, json);
    writeFileSync(gzipPath, gzipSync(json));
    manifest.tables.push({ table, rowCount: rows.length, contentRange, file: path.basename(gzipPath) });
    console.log(`Exported ${rows.length} row(s) from ${table}.`);
  } catch (error) {
    manifest.tables.push({ table, error: error.message });
    console.error(`Failed to export ${table}: ${error.message}`);
  }
}

writeFileSync(path.join(OUT_DIR, `${now}-manifest.json`), JSON.stringify(manifest, null, 2));
writeFileSync(path.join(OUT_DIR, 'README.md'), `# NutsNews Supabase REST Backup\n\nCreated at: ${manifest.createdAt}\n\nThis backup is a limited REST export for recovery support and diagnostics. It is not a replacement for a full Supabase database dump.\n\n`);

const failed = manifest.tables.filter((table) => table.error);
if (failed.length > 0) {
  console.error(`${failed.length} table export(s) failed.`);
  process.exit(1);
}
console.log('Supabase REST backup complete.');
