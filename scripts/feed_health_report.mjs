#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FEED_LIMIT = Math.max(1, Math.min(Number(process.env.FEED_HEALTH_LIMIT || 500), 5000));
const RUN_LIMIT = Math.max(1, Math.min(Number(process.env.WORKER_RUN_LIMIT || 100), 1000));
const OUT_DIR = path.join(process.cwd(), 'reports', 'feed-health');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log('Skipping feed health report because SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
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

const feeds = await supabase(`/rest/v1/rss_feeds?select=id,source,url,is_active,is_positive_source&order=is_active.desc,source.asc&limit=${FEED_LIMIT}`);
let runs = [];
try {
  runs = await supabase(`/rest/v1/worker_runs?select=run_started_at,run_completed_at,shard_index,feed_count,feed_fetch_success_count,feed_fetch_failure_count,failed_feeds,fetched_count,candidate_count,accepted_count,rejected_count,no_thumbnail_rejected_count,image_hydration_found_count,success&order=run_started_at.desc&limit=${RUN_LIMIT}`);
} catch (error) {
  console.warn(`Could not load worker_runs: ${error.message}`);
}

const activeFeeds = feeds.filter((feed) => feed.is_active !== false);
const inactiveFeeds = feeds.length - activeFeeds.length;
const failedFeedCounts = new Map();
for (const run of runs) {
  for (const failed of run.failed_feeds || []) {
    const label = typeof failed === 'string' ? failed : failed.url || failed.source || JSON.stringify(failed);
    failedFeedCounts.set(label, (failedFeedCounts.get(label) || 0) + 1);
  }
}
const repeatedFailures = [...failedFeedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
const latestRun = runs[0];

const report = { createdAt: new Date().toISOString(), feedCount: feeds.length, activeFeedCount: activeFeeds.length, inactiveFeedCount: inactiveFeeds, latestRun, repeatedFailures };
const markdown = [
  '# NutsNews Feed Health Report',
  '',
  `Generated: ${report.createdAt}`,
  '',
  `- Feeds checked: ${feeds.length}`,
  `- Active feeds: ${activeFeeds.length}`,
  `- Inactive feeds: ${inactiveFeeds}`,
  latestRun ? `- Latest run: shard ${latestRun.shard_index}, success=${latestRun.success}, feed success=${latestRun.feed_fetch_success_count}, feed failures=${latestRun.feed_fetch_failure_count}, accepted=${latestRun.accepted_count}` : '- Latest run: none found',
  '',
  '## Repeated failed feeds from recent worker runs',
  '',
  repeatedFailures.length ? '| Feed | Recent failure count |\n|---|---:|\n' + repeatedFailures.map(([feed, count]) => `| ${String(feed).replace(/\|/g, '\\|')} | ${count} |`).join('\n') : 'No repeated failed feeds found in recent worker runs.',
  '',
].join('\n');

writeFileSync(path.join(OUT_DIR, 'feed-health-report.md'), markdown);
writeFileSync(path.join(OUT_DIR, 'feed-health-report.json'), JSON.stringify(report, null, 2));
console.log(markdown);
