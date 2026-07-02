#!/usr/bin/env node
const DEFAULT_STATUS_URL = 'https://nutsnews-worker-0.nutsnews.workers.dev/public-feed-snapshot/status';
const TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 20000);

function normalizeStatusUrl(value) {
  const raw = String(value || DEFAULT_STATUS_URL).trim().replace(/\/+$/, '');

  if (raw.endsWith('/public-feed-snapshot/status')) return raw;
  if (raw.endsWith('/public-feed-snapshot')) return `${raw}/status`;
  return `${raw}/public-feed-snapshot/status`;
}

function snapshotUrlFromStatusUrl(statusUrl) {
  return statusUrl.replace(/\/status$/, '');
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NutsNews-Edge-Snapshot-Health-Check/1.0',
      },
    });
    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    return { response, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

function assertReadyStatus(statusUrl, response, text, payload) {
  if (!response.ok) {
    throw new Error(`${statusUrl} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`${statusUrl} did not return a JSON object.`);
  }

  if (payload.kvBound === false || payload.status === 'unbound') {
    throw new Error('Edge snapshot Worker is not healthy: NUTSNEWS_KV is not bound to this Worker.');
  }

  if (payload.ready !== true || payload.status !== 'hit') {
    throw new Error(`Edge snapshot Worker is not ready: status=${payload.status ?? 'unknown'}, ready=${payload.ready ?? 'unknown'}, message=${payload.message ?? 'none'}`);
  }

  if (!Number.isFinite(Number(payload.articleCount)) || Number(payload.articleCount) < 1) {
    throw new Error(`Edge snapshot Worker is not healthy: articleCount=${payload.articleCount ?? 'unknown'}.`);
  }

  if (!Number.isFinite(Number(payload.version)) || Number(payload.version) < 1) {
    throw new Error(`Edge snapshot Worker is not healthy: version=${payload.version ?? 'unknown'}.`);
  }

  if (!payload.updatedAt || Number.isNaN(Date.parse(payload.updatedAt))) {
    throw new Error(`Edge snapshot Worker is not healthy: updatedAt=${payload.updatedAt ?? 'unknown'}.`);
  }
}

function assertSnapshotPayload(snapshotUrl, response, text, payload) {
  if (!response.ok) {
    throw new Error(`${snapshotUrl} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const articles = Array.isArray(payload?.articles) ? payload.articles : [];

  if (articles.length < 1) {
    throw new Error(`${snapshotUrl} returned no edge snapshot articles.`);
  }

  if (payload?.dataSource !== 'edge_feed_snapshot') {
    throw new Error(`${snapshotUrl} returned unexpected dataSource=${payload?.dataSource ?? 'unknown'}.`);
  }
}

const statusUrl = normalizeStatusUrl(process.env.NUTSNEWS_EDGE_SNAPSHOT_STATUS_URL || process.env.NUTSNEWS_SHARD_URL);
const snapshotUrl = `${snapshotUrlFromStatusUrl(statusUrl)}?page=0&pageSize=1`;

console.log(`Checking edge snapshot status: ${statusUrl}`);
const statusResult = await fetchWithTimeout(statusUrl);
assertReadyStatus(statusUrl, statusResult.response, statusResult.text, statusResult.json);
console.log(`Edge snapshot status is healthy: articleCount=${statusResult.json.articleCount}, ageSeconds=${statusResult.json.ageSeconds ?? 'unknown'}, version=${statusResult.json.version}.`);

console.log(`Checking edge snapshot feed payload: ${snapshotUrl}`);
const snapshotResult = await fetchWithTimeout(snapshotUrl);
assertSnapshotPayload(snapshotUrl, snapshotResult.response, snapshotResult.text, snapshotResult.json);
console.log(`Edge snapshot feed payload is healthy: returned ${snapshotResult.json.articles.length} article(s).`);
