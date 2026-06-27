#!/usr/bin/env node
const BASE_URL = String(process.env.NUTSNEWS_BASE_URL || 'https://www.nutsnews.com').replace(/\/+$/, '');
const WORKER_URL = process.env.NUTSNEWS_WORKER_URL || '';
const SHARD_URL = process.env.NUTSNEWS_SHARD_URL || '';
const TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 20000);

async function fetchJson(url, { required = true } = {}) {
  if (!url) {
    if (required) throw new Error('Required URL is missing.');
    console.log('Skipping optional empty URL.');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'NutsNews-GitHub-Actions-Smoke-Test/1.0' } });
    const text = await response.text();
    if (!response.ok) throw new Error(`${url} returned ${response.status}: ${text.slice(0, 500)}`);
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(timeout);
  }
}

console.log(`Checking public API: ${BASE_URL}/api/articles?limit=1`);
const api = await fetchJson(`${BASE_URL}/api/articles?limit=1`);
const articles = Array.isArray(api) ? api : api.articles || api.data || [];
if (!Array.isArray(articles) || articles.length < 1) {
  throw new Error('Public articles API returned no article rows.');
}
console.log(`Public API returned ${articles.length} article(s).`);

if (WORKER_URL) {
  console.log(`Checking Worker/controller URL: ${WORKER_URL}`);
  const worker = await fetchJson(WORKER_URL, { required: false });
  console.log(`Worker response keys: ${Object.keys(worker || {}).join(', ') || 'none'}`);
} else {
  console.log('Skipping Worker/controller URL because NUTSNEWS_WORKER_URL is not set.');
}

if (SHARD_URL) {
  const separator = SHARD_URL.includes('?') ? '&' : '?';
  const url = `${SHARD_URL}${separator}limit=1`;
  console.log(`Checking shard URL: ${url}`);
  const shard = await fetchJson(url, { required: false });
  if (shard && shard.feedFetchFailureCount > shard.feedFetchSuccessCount) {
    throw new Error(`Shard has more failed feeds (${shard.feedFetchFailureCount}) than successful feeds (${shard.feedFetchSuccessCount}).`);
  }
  console.log(`Shard response acceptedCount=${shard?.acceptedCount ?? 'n/a'}, fetchedCount=${shard?.fetchedCount ?? 'n/a'}.`);
} else {
  console.log('Skipping shard URL because NUTSNEWS_SHARD_URL is not set.');
}

console.log('Smoke test passed.');
