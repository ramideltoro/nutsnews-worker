#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const WORKER_DIR = resolve(REPO_ROOT, 'worker');

const DEFAULT_WORKER_PORT = 8787;
const DEFAULT_MOCK_SUPABASE_PORT = 8892;
const DEFAULT_MOCK_AI_PORT = 8890;
const DEFAULT_MOCK_RSS_PORT = 8891;
const DEFAULT_MOCK_WEB_PORT = 8893;
const LOCAL_AI_KEY = 'offline-e2e-local-ai-key';
const TEST_SOURCE = 'NutsNews Offline E2E Regression';

function envNumber(name, fallback) {
  const parsed = Number(process.env[name] ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const TEST_WATCHDOG_TIMEOUT_MS = envNumber('NUTSNEWS_OFFLINE_E2E_WATCHDOG_TIMEOUT_MS', 180000);
const EXIT_AFTER_CLEANUP_DELAY_MS = envNumber('NUTSNEWS_OFFLINE_E2E_EXIT_AFTER_CLEANUP_DELAY_MS', 100);
const SERVER_CLOSE_TIMEOUT_MS = envNumber('NUTSNEWS_OFFLINE_E2E_SERVER_CLOSE_TIMEOUT_MS', 1500);

function assert(condition, message, details = undefined) {
  if (!condition) {
    const error = new Error(message);
    if (details !== undefined) {
      error.details = details;
    }
    throw error;
  }
}

function logStep(message) {
  console.log(`\n▶ ${message}`);
}

function logOk(message) {
  console.log(`✓ ${message}`);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function textResponse(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function buildContext() {
  const runId = `offline-e2e-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const workerPort = envNumber('NUTSNEWS_OFFLINE_E2E_WORKER_PORT', DEFAULT_WORKER_PORT);
  const supabasePort = envNumber('NUTSNEWS_OFFLINE_E2E_SUPABASE_PORT', DEFAULT_MOCK_SUPABASE_PORT);
  const aiPort = envNumber('NUTSNEWS_OFFLINE_E2E_AI_PORT', DEFAULT_MOCK_AI_PORT);
  const rssPort = envNumber('NUTSNEWS_OFFLINE_E2E_RSS_PORT', DEFAULT_MOCK_RSS_PORT);
  const webPort = envNumber('NUTSNEWS_OFFLINE_E2E_WEB_PORT', DEFAULT_MOCK_WEB_PORT);

  const rssBaseUrl = `http://127.0.0.1:${rssPort}`;
  const imageUrl = `${rssBaseUrl}/images/${runId}.jpg`;

  return {
    runId,
    workerPort,
    supabasePort,
    aiPort,
    rssPort,
    webPort,
    workerUrl: `http://127.0.0.1:${workerPort}`,
    supabaseUrl: `http://127.0.0.1:${supabasePort}`,
    aiUrl: `http://127.0.0.1:${aiPort}`,
    rssBaseUrl,
    webBaseUrl: `http://127.0.0.1:${webPort}`,
    feedUrl: `${rssBaseUrl}/rss.xml?run=${encodeURIComponent(runId)}`,
    imageUrl,
    accepted: [
      {
        scenario: 'rss-image-accept',
        title: `NutsNews offline E2E ${runId} community garden rescue brings neighbors joy`,
        url: `${rssBaseUrl}/article-accepted-rss-image/${runId}`,
      },
      {
        scenario: 'hydrated-image-accept',
        title: `NutsNews offline E2E ${runId} volunteers restore a school art room with kindness`,
        url: `${rssBaseUrl}/article-accepted-hydrated-image/${runId}`,
      },
    ],
    rejected: [
      {
        scenario: 'no-thumbnail-reject',
        title: `NutsNews offline E2E ${runId} no thumbnail article should be rejected`,
        url: `${rssBaseUrl}/article-no-thumbnail/${runId}`,
      },
      {
        scenario: 'local-prefilter-reject',
        title: `NutsNews offline E2E ${runId} politics war market crash story should be locally rejected`,
        url: `${rssBaseUrl}/article-local-prefilter-reject/${runId}`,
      },
      {
        scenario: 'ai-reject',
        title: `NutsNews offline E2E ${runId} AI reject scenario for a neutral checklist`,
        url: `${rssBaseUrl}/article-ai-reject/${runId}`,
      },
    ],
  };
}

function buildRssXml(ctx) {
  const pubDate = new Date().toUTCString();
  const items = [
    {
      title: ctx.accepted[0].title,
      url: ctx.accepted[0].url,
      description:
        'A community garden rescue story about neighbors, kindness, volunteers, students, animals, and an uplifting celebration that brings people together.',
      imageUrl: ctx.imageUrl,
    },
    {
      title: ctx.accepted[1].title,
      url: ctx.accepted[1].url,
      description:
        'Volunteers restored a school art room with creativity, kindness, hopeful community support, children, teachers, and a joyful celebration.',
      imageUrl: null,
    },
    {
      title: ctx.rejected[0].title,
      url: ctx.rejected[0].url,
      description:
        'This positive looking test item intentionally has no RSS image and no article page image so the Worker must reject it before AI.',
      imageUrl: null,
    },
    {
      title: ctx.rejected[1].title,
      url: ctx.rejected[1].url,
      description:
        'Politics, war, election, market crash, government, military, attack, crime, violence, stocks, and inflation are included to trigger the local prefilter.',
      imageUrl: ctx.imageUrl,
    },
    {
      title: ctx.rejected[2].title,
      url: ctx.rejected[2].url,
      description:
        'This neutral AI reject scenario has an image and enough text to reach the AI review step, where the mock local AI returns a reject decision.',
      imageUrl: ctx.imageUrl,
    },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>NutsNews Offline E2E Regression Feed</title>
    <link>${escapeXml(ctx.rssBaseUrl)}</link>
    <description>Fully mocked regression feed for the NutsNews Worker.</description>
    ${items
      .map((item) => {
        const image = item.imageUrl ? `<media:content url="${escapeXml(item.imageUrl)}" medium="image" type="image/jpeg" />` : '';
        return `<item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(item.description)}</description>
      ${image}
    </item>`;
      })
      .join('\n')}
  </channel>
</rss>`;
}

function startServer(server, port, name) {
  return new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', rejectPromise);
      logOk(`${name} listening on http://127.0.0.1:${port}`);
      resolvePromise(server);
    });
  });
}

function closeServer(server) {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise((resolvePromise) => {
    let resolved = false;

    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeout);
      resolvePromise();
    };

    const timeout = setTimeout(finish, SERVER_CLOSE_TIMEOUT_MS);
    timeout.unref?.();

    try {
      server.close(finish);
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    } catch {
      finish();
    }
  });
}

function startMockRssServer(ctx) {
  const tinyJpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AV//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AV//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
    'base64',
  );

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', ctx.rssBaseUrl);

    if (url.pathname === '/rss.xml') {
      textResponse(response, 200, buildRssXml(ctx), 'application/rss+xml; charset=utf-8');
      return;
    }

    if (url.pathname.startsWith('/images/')) {
      response.writeHead(200, {
        'content-type': 'image/jpeg',
        'cache-control': 'no-store',
      });
      response.end(tinyJpeg);
      return;
    }

    if (url.pathname.includes('/article-accepted-hydrated-image/')) {
      textResponse(
        response,
        200,
        `<!doctype html><html><head><title>${escapeHtml(ctx.accepted[1].title)}</title><meta property="og:image" content="${escapeHtml(ctx.imageUrl)}" /></head><body><article>${escapeHtml(ctx.accepted[1].title)}</article></body></html>`,
        'text/html; charset=utf-8',
      );
      return;
    }

    if (url.pathname.includes('/article-no-thumbnail/')) {
      textResponse(
        response,
        200,
        `<!doctype html><html><head><title>${escapeHtml(ctx.rejected[0].title)}</title></head><body>No image here by design.</body></html>`,
        'text/html; charset=utf-8',
      );
      return;
    }

    textResponse(
      response,
      200,
      `<!doctype html><html><head><title>NutsNews Offline E2E</title><meta property="og:image" content="${escapeHtml(ctx.imageUrl)}" /></head><body>NutsNews offline E2E article page.</body></html>`,
      'text/html; charset=utf-8',
    );
  });

  return startServer(server, ctx.rssPort, 'Mock RSS/article server');
}

function startMockAiServer(ctx) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', ctx.aiUrl);

    if (request.headers['x-nutsnews-ai-key'] !== LOCAL_AI_KEY) {
      jsonResponse(response, 401, { error: 'Invalid mock local AI key.' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/review') {
      const body = (await readBody(request)) ?? {};
      const title = String(body.title ?? '');

      if (title.includes('AI reject scenario')) {
        jsonResponse(response, 200, {
          model: 'nutsnews-offline-e2e-mock-ai',
          ai_model: 'nutsnews-offline-e2e-mock-ai',
          decision: 'reject',
          category: 'Uplifting',
          positivity_score: 2,
          summary: '',
          reason: 'Mock AI rejected this deterministic regression scenario.',
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
          duration_ms: 1,
        });
        return;
      }

      jsonResponse(response, 200, {
        model: 'nutsnews-offline-e2e-mock-ai',
        ai_model: 'nutsnews-offline-e2e-mock-ai',
        decision: 'accept',
        category: 'Community | Uplifting',
        positivity_score: 9,
        summary:
          'Neighbors and volunteers come together in a cheerful community moment, creating a calm reminder that small acts of kindness can brighten an ordinary day.',
        reason: 'Mock AI accepted this deterministic uplifting regression scenario.',
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        duration_ms: 1,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/translate') {
      const body = (await readBody(request)) ?? {};
      const languageCode = String(body.language_code ?? '');
      const title = String(body.title ?? 'Untitled');
      const summary = String(body.summary ?? '');
      const prefix = languageCode === 'fr' ? '[FR]' : languageCode === 'ja' ? '[JA]' : `[${languageCode}]`;

      jsonResponse(response, 200, {
        model: 'nutsnews-offline-e2e-mock-ai',
        ai_model: 'nutsnews-offline-e2e-mock-ai',
        language_code: languageCode,
        title: `${prefix} ${title}`,
        summary: `${prefix} ${summary}`,
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        duration_ms: 1,
      });
      return;
    }

    jsonResponse(response, 404, { error: `Mock AI route not found: ${request.method} ${url.pathname}` });
  });

  return startServer(server, ctx.aiPort, 'Mock local AI server');
}

function parseInFilter(value) {
  if (!value || !value.startsWith('in.(') || !value.endsWith(')')) {
    return null;
  }

  const inner = value.slice(4, -1);
  const values = [];
  let current = '';
  let inQuotes = false;
  let escaping = false;

  for (const char of inner) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim() || inner.endsWith(',')) {
    values.push(current.trim());
  }

  return values.filter(Boolean);
}

function filterByOriginalUrl(rows, searchParams) {
  const filter = searchParams.get('original_url');
  if (!filter) {
    return rows;
  }

  const inValues = parseInFilter(filter);
  if (inValues) {
    const allowed = new Set(inValues);
    return rows.filter((row) => allowed.has(row.original_url));
  }

  if (filter.startsWith('eq.')) {
    const value = filter.slice(3);
    return rows.filter((row) => row.original_url === value);
  }

  return rows;
}

function filterByLanguage(rows, searchParams) {
  const filter = searchParams.get('language_code');
  if (!filter) {
    return rows;
  }

  const inValues = parseInFilter(filter);
  if (inValues) {
    const allowed = new Set(inValues);
    return rows.filter((row) => allowed.has(row.language_code));
  }

  if (filter.startsWith('eq.')) {
    const value = filter.slice(3);
    return rows.filter((row) => row.language_code === value);
  }

  return rows;
}

function makeEmptyDb(ctx) {
  return {
    rss_feeds: [
      {
        id: 1,
        source: TEST_SOURCE,
        url: ctx.feedUrl,
        is_positive_source: true,
        is_active: true,
      },
    ],
    article_ai_reviews: [],
    articles: [],
    article_summaries: [],
    feed_health: [],
    ai_usage_runs: [],
    worker_runs: [],
    public_feed_snapshot: [],
    rpcRefreshCount: 0,
  };
}

function upsertByKey(rows, incomingRows, keyFn, merge = true) {
  for (const row of incomingRows) {
    const key = keyFn(row);
    const index = rows.findIndex((existing) => keyFn(existing) === key);
    if (index >= 0) {
      rows[index] = merge ? { ...rows[index], ...row } : rows[index];
    } else {
      rows.push(row);
    }
  }
}

function refreshPublicFeedSnapshot(db) {
  db.rpcRefreshCount += 1;
  db.public_feed_snapshot = db.articles
    .filter((article) => article.status === 'published' && article.image_url && article.ai_summary)
    .slice()
    .sort((a, b) => String(b.published_on_site_at ?? '').localeCompare(String(a.published_on_site_at ?? '')))
    .map((article) => ({ ...article }));
}

function startMockSupabaseServer(ctx, db) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', ctx.supabaseUrl);
    const path = url.pathname.replace(/^\/rest\/v1\/?/, '');

    if (!url.pathname.startsWith('/rest/v1/')) {
      jsonResponse(response, 404, { error: `Mock Supabase only supports /rest/v1. Got ${url.pathname}` });
      return;
    }

    if (path === 'rss_feeds' && request.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? String(db.rss_feeds.length));
      const offset = Number(url.searchParams.get('offset') ?? '0');
      const rows = db.rss_feeds
        .filter((feed) => feed.is_active)
        .sort((a, b) => a.id - b.id)
        .slice(offset, offset + limit)
        .map(({ source, url: feedUrl, is_positive_source }) => ({ source, url: feedUrl, is_positive_source }));
      jsonResponse(response, 200, rows);
      return;
    }

    if (path === 'article_ai_reviews' && request.method === 'GET') {
      const rows = filterByOriginalUrl(db.article_ai_reviews, url.searchParams).map((row) => ({ ...row }));
      jsonResponse(response, 200, rows);
      return;
    }

    if (path === 'article_ai_reviews' && request.method === 'POST') {
      const body = await readBody(request);
      const rows = Array.isArray(body) ? body : [body].filter(Boolean);
      upsertByKey(db.article_ai_reviews, rows, (row) => row.original_url, true);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'articles' && request.method === 'GET') {
      let rows = filterByOriginalUrl(db.articles, url.searchParams);
      const statusFilter = url.searchParams.get('status');
      if (statusFilter) {
        const statuses = parseInFilter(statusFilter);
        if (statuses) {
          const allowed = new Set(statuses);
          rows = rows.filter((article) => allowed.has(article.status));
        } else if (statusFilter.startsWith('eq.')) {
          rows = rows.filter((article) => article.status === statusFilter.slice(3));
        }
      }
      rows = rows.slice().sort((a, b) => String(b.published_on_site_at ?? '').localeCompare(String(a.published_on_site_at ?? '')));
      const limit = Number(url.searchParams.get('limit') ?? String(rows.length));
      jsonResponse(response, 200, rows.slice(0, limit).map((row) => ({ ...row })));
      return;
    }

    if (path === 'articles' && request.method === 'POST') {
      const body = await readBody(request);
      const rows = Array.isArray(body) ? body : [body].filter(Boolean);
      upsertByKey(db.articles, rows, (row) => row.original_url, false);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'articles' && request.method === 'PATCH') {
      const body = (await readBody(request)) ?? {};
      const filtered = filterByOriginalUrl(db.articles, url.searchParams);
      const targets = new Set(filtered.map((row) => row.original_url));
      for (const article of db.articles) {
        if (targets.has(article.original_url)) {
          Object.assign(article, body);
        }
      }
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'article_summaries' && request.method === 'GET') {
      const rows = filterByLanguage(filterByOriginalUrl(db.article_summaries, url.searchParams), url.searchParams);
      jsonResponse(response, 200, rows.map((row) => ({ ...row })));
      return;
    }

    if (path === 'article_summaries' && request.method === 'POST') {
      const body = await readBody(request);
      const rows = Array.isArray(body) ? body : [body].filter(Boolean);
      upsertByKey(db.article_summaries, rows, (row) => `${row.original_url}::${row.language_code}`, true);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'feed_health' && request.method === 'GET') {
      jsonResponse(response, 200, db.feed_health.map((row) => ({ ...row })));
      return;
    }

    if (path === 'feed_health' && request.method === 'POST') {
      const body = await readBody(request);
      const rows = Array.isArray(body) ? body : [body].filter(Boolean);
      upsertByKey(db.feed_health, rows, (row) => row.feed_url, true);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'rpc/refresh_public_feed_snapshot' && request.method === 'POST') {
      refreshPublicFeedSnapshot(db);
      jsonResponse(response, 200, []);
      return;
    }

    if (path === 'ai_usage_runs' && request.method === 'POST') {
      const body = await readBody(request);
      db.ai_usage_runs.push(body);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'worker_runs' && request.method === 'POST') {
      const body = await readBody(request);
      db.worker_runs.push(body);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    jsonResponse(response, 404, {
      error: `Unhandled mock Supabase route: ${request.method} ${path}`,
      query: Object.fromEntries(url.searchParams.entries()),
    });
  });

  return startServer(server, ctx.supabasePort, 'Mock Supabase/PostgREST server');
}

function apiArticlesPayload(db, languageCode) {
  const articles = db.public_feed_snapshot.slice(0, 10).map((article) => {
    if (languageCode === 'fr' || languageCode === 'ja') {
      const summary = db.article_summaries.find((row) => row.original_url === article.original_url && row.language_code === languageCode);
      if (summary) {
        return {
          id: article.original_url,
          source: article.source,
          title: summary.title,
          original_url: article.original_url,
          image_url: article.image_url,
          published_at: article.published_at,
          published_on_site_at: article.published_on_site_at,
          ai_summary: summary.summary,
          category: article.category,
          positivity_score: article.positivity_score,
          language_code: languageCode,
          requested_language_code: languageCode,
          translation_available: true,
        };
      }
    }

    return {
      id: article.original_url,
      source: article.source,
      title: article.title,
      original_url: article.original_url,
      image_url: article.image_url,
      published_at: article.published_at,
      published_on_site_at: article.published_on_site_at,
      ai_summary: article.ai_summary,
      category: article.category,
      positivity_score: article.positivity_score,
      language_code: 'en',
      requested_language_code: languageCode,
      translation_available: languageCode === 'en',
    };
  });

  return {
    articles,
    nextPage: null,
    nextCursor: null,
    dataSource: 'mock_public_feed_snapshot',
    languageCode,
  };
}

function startMockWebServer(ctx, db) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', ctx.webBaseUrl);

    if (url.pathname === '/api/articles') {
      const languageCode = url.searchParams.get('lang') || 'en';
      jsonResponse(response, 200, apiArticlesPayload(db, languageCode));
      return;
    }

    if (url.pathname === '/') {
      const payload = apiArticlesPayload(db, 'en');
      const cards = payload.articles
        .map((article) => `<article><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.ai_summary)}</p></article>`)
        .join('\n');
      textResponse(response, 200, `<!doctype html><html><head><title>NutsNews</title></head><body><main><h1>NutsNews</h1>${cards}</main></body></html>`, 'text/html; charset=utf-8');
      return;
    }

    jsonResponse(response, 404, { error: `Mock web route not found: ${url.pathname}` });
  });

  return startServer(server, ctx.webPort, 'Mock web/homepage server');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status} ${text.slice(0, 1000)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GET ${url} did not return JSON: ${text.slice(0, 1000)}`);
  }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status} ${text.slice(0, 1000)}`);
  }
  return text;
}


function writeGeneratedWranglerConfig(ctx) {
  const config = {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: 'nutsnews-worker-offline-e2e',
    main: 'src/index.ts',
    compatibility_date: '2026-06-27',
    observability: { enabled: false },
    vars: {
      SUPABASE_URL: ctx.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'offline-e2e-service-role-key',
      AI_PROVIDER: 'local',
      LOCAL_AI_URL: ctx.aiUrl,
      LOCAL_AI_API_KEY: LOCAL_AI_KEY,
      LOCAL_AI_MODEL: 'nutsnews-offline-e2e-mock-ai',
      AI_PROVIDER_FALLBACK_TO_OPENAI: 'false',
      AI_REVIEW_CONCURRENCY: '1',
      FEED_SHARD_INDEX: '0',
      FEEDS_PER_SHARD: '1',
      ARTICLE_PAGE_IMAGE_LOOKUP_LIMIT: '3',
      ENABLED_SUMMARY_LANGUAGES: 'fr,ja,de-CH,de,el',
      SUMMARY_TRANSLATION_LIMIT: '8',
      UPSTASH_REDIS_ENABLED: 'false',
    },
  };

  const filePath = resolve(WORKER_DIR, 'wrangler.offline-e2e.generated.jsonc');
  writeFileSync(filePath, JSON.stringify(config, null, 2));
  return filePath;
}

function startWranglerDev(ctx) {
  const configPath = writeGeneratedWranglerConfig(ctx);
  const args = ['wrangler', 'dev', '-c', configPath, '--port', String(ctx.workerPort), '--ip', '127.0.0.1'];
  const child = spawn('npx', args, {
    cwd: WORKER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      NO_UPDATE_NOTIFIER: 'true',
      NUTSNEWS_OFFLINE_E2E_SUPABASE_URL: ctx.supabaseUrl,
      NUTSNEWS_OFFLINE_E2E_AI_URL: ctx.aiUrl,
    },
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  return { child, getOutput: () => output };
}

async function waitForWorker(ctx, workerProcess) {
  const deadline = Date.now() + 60000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (workerProcess.child.exitCode !== null) {
      throw new Error(`wrangler dev exited early with code ${workerProcess.child.exitCode}.\n${workerProcess.getOutput()}`);
    }

    try {
      const data = await fetchJson(`${ctx.workerUrl}/kv-status`);
      if (data && typeof data === 'object') {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(750);
  }

  throw new Error(`Timed out waiting for Worker at ${ctx.workerUrl}. Last error: ${lastError?.message ?? 'none'}\n${workerProcess.getOutput()}`);
}

async function stopWranglerDev(workerProcess) {
  if (!workerProcess?.child || workerProcess.child.exitCode !== null) {
    return;
  }

  workerProcess.child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolvePromise) => workerProcess.child.once('exit', resolvePromise)),
    sleep(5000).then(() => {
      if (workerProcess.child.exitCode === null) {
        workerProcess.child.kill('SIGKILL');
      }
    }),
  ]);
}

function getArticle(db, article) {
  return db.articles.find((row) => row.original_url === article.url);
}

function getReview(db, article) {
  return db.article_ai_reviews.find((row) => row.original_url === article.url);
}

function getSummaryLanguages(db, article) {
  return new Set(db.article_summaries.filter((row) => row.original_url === article.url).map((row) => row.language_code));
}

const EXPECTED_TRANSLATION_LANGUAGES = ['fr', 'ja', 'de-CH', 'de', 'el'];

function getMockTranslationPrefix(languageCode) {
  if (languageCode === 'fr') return '[FR]';
  if (languageCode === 'ja') return '[JA]';
  if (languageCode === 'de-CH') return '[de-CH]';
  if (languageCode === 'de') return '[de]';
  if (languageCode === 'el') return '[el]';
  return `[${languageCode}]`;
}

function verifyDatabaseState(db, ctx) {
  logStep('Verifying mock database state');

  for (const article of ctx.accepted) {
    const row = getArticle(db, article);
    assert(row, `Accepted article was not stored: ${article.scenario}`);
    assert(row.status === 'published', `Accepted article was not published: ${article.scenario}`, row);
    assert(Boolean(row.image_url), `Accepted article is missing image_url: ${article.scenario}`, row);
    assert(Boolean(row.ai_summary), `Accepted article is missing ai_summary: ${article.scenario}`, row);

    const languages = getSummaryLanguages(db, article);
    for (const languageCode of EXPECTED_TRANSLATION_LANGUAGES) {
      assert(languages.has(languageCode), `Accepted article is missing ${languageCode} summary: ${article.scenario}`, db.article_summaries);
    }
  }

  for (const article of ctx.rejected) {
    const row = getArticle(db, article);
    assert(!row, `Rejected article should not be stored in articles: ${article.scenario}`, row);
    const review = getReview(db, article);
    assert(review, `Rejected article is missing review row: ${article.scenario}`);
    assert(review.decision === 'reject', `Rejected article review decision was not reject: ${article.scenario}`, review);
  }

  assert(db.public_feed_snapshot.length >= ctx.accepted.length, 'public_feed_snapshot was not refreshed with accepted articles.', db.public_feed_snapshot);
  assert(db.worker_runs.length >= 1, 'worker_runs telemetry was not saved.', db.worker_runs);
  assert(db.ai_usage_runs.length >= 1, 'ai_usage_runs telemetry was not saved.', db.ai_usage_runs);
  logOk('Mock DB rows, statuses, reviews, translations, snapshot, and telemetry verified');
}

async function verifyMockWeb(ctx) {
  logStep('Verifying mock web API and homepage rendering');

  for (const languageCode of ['en', ...EXPECTED_TRANSLATION_LANGUAGES]) {
    const data = await fetchJson(`${ctx.webBaseUrl}/api/articles?lang=${languageCode}&_=${Date.now()}`);
    assert(Array.isArray(data.articles), `Mock web API did not return articles for ${languageCode}`, data);

    for (const expected of ctx.accepted) {
      const article = data.articles.find((item) => item.original_url === expected.url);
      assert(article, `Mock web API ${languageCode} response did not include ${expected.scenario}`, data);

      if (languageCode !== 'en') {
        assert(article.language_code === languageCode, `Mock web API ${languageCode} did not return localized language_code`, article);
        assert(article.translation_available === true, `Mock web API ${languageCode} translation was not available`, article);
        assert(article.title.startsWith(getMockTranslationPrefix(languageCode)), `Mock web API ${languageCode} title was not localized`, article);
      }
    }
  }

  const homeHtml = await fetchText(`${ctx.webBaseUrl}/?e2e=${encodeURIComponent(ctx.runId)}&_=${Date.now()}`);
  assert(homeHtml.includes('NutsNews'), 'Mock homepage did not render the NutsNews shell.');
  assert(ctx.accepted.some((article) => homeHtml.includes(article.title)), 'Mock homepage did not render an accepted article title.', homeHtml.slice(0, 1000));
  logOk('Mock multilingual API output and homepage HTML verified');
}

async function verifyTranslationRecovery(ctx, db) {
  logStep('Verifying translation recovery for already-published articles');

  const target = ctx.accepted[0];
  db.article_summaries = db.article_summaries.filter((row) => row.original_url !== target.url);
  refreshPublicFeedSnapshot(db);

  const recoveryResult = await fetchJson(`${ctx.workerUrl}/?limit=1&imageLookups=1&_=${Date.now()}`);
  assert(recoveryResult.aiReviewedCount === 0, 'Recovery run should not re-review already processed articles.', recoveryResult);
  assert(recoveryResult.articleSummaryRecoveryCandidateCount >= 1, 'Recovery run did not find the published article with missing translations.', recoveryResult);
  assert(recoveryResult.articleSummaryRecoveryAttemptedTaskCount >= EXPECTED_TRANSLATION_LANGUAGES.length, 'Recovery run did not attempt all recovery translations.', recoveryResult);
  assert(recoveryResult.articleSummaryTranslationCount >= EXPECTED_TRANSLATION_LANGUAGES.length, 'Recovery run did not regenerate all missing translations.', recoveryResult);
  assert(recoveryResult.articleSummaryFailedTaskCount === 0, 'Recovery run had failed translation tasks.', recoveryResult);
  assert(recoveryResult.publicFeedSnapshotRefreshOk === true, 'Recovery run did not refresh public feed snapshot.', recoveryResult);

  const languages = getSummaryLanguages(db, target);
  assert(EXPECTED_TRANSLATION_LANGUAGES.every((languageCode) => languages.has(languageCode)), 'Recovery run did not restore all configured summaries.', db.article_summaries);
  logOk('Translation recovery path verified');
}

async function run() {
  if (process.env.NUTSNEWS_E2E_ALLOW_NETWORK === '1') {
    throw new Error('This offline regression test should not be run with NUTSNEWS_E2E_ALLOW_NETWORK=1. It is designed to use mocks only.');
  }

  const ctx = buildContext();
  const db = makeEmptyDb(ctx);
  let rssServer;
  let aiServer;
  let supabaseServer;
  let webServer;
  let workerProcess;

  const watchdog = setTimeout(() => {
    console.error(`\n❌ NutsNews fully offline Worker E2E regression timed out after ${TEST_WATCHDOG_TIMEOUT_MS}ms.`);
    if (workerProcess?.getOutput) {
      console.error('\nWrangler output:');
      console.error(workerProcess.getOutput().slice(-8000));
    }
    process.exit(1);
  }, TEST_WATCHDOG_TIMEOUT_MS);
  watchdog.unref?.();

  console.log(`NutsNews fully offline Worker regression run: ${ctx.runId}`);
  console.log(`Worker URL: ${ctx.workerUrl}`);
  console.log(`Mock Supabase URL: ${ctx.supabaseUrl}`);
  console.log(`Mock RSS URL: ${ctx.feedUrl}`);
  console.log(`Mock AI URL: ${ctx.aiUrl}`);
  console.log(`Mock web URL: ${ctx.webBaseUrl}`);

  try {
    logStep('Starting all mock services');
    rssServer = await startMockRssServer(ctx);
    aiServer = await startMockAiServer(ctx);
    supabaseServer = await startMockSupabaseServer(ctx, db);
    webServer = await startMockWebServer(ctx, db);

    logStep('Starting real Worker locally with mocked bindings');
    workerProcess = startWranglerDev(ctx);
    await waitForWorker(ctx, workerProcess);
    logOk('Worker is ready');

    logStep('Calling Worker refresh against fully mocked RSS, AI, and Supabase');
    const workerResult = await fetchJson(`${ctx.workerUrl}/?limit=3&imageLookups=3&_=${Date.now()}`);

    assert(workerResult.feedCount === 1, 'Worker should load exactly one mocked feed.', workerResult);
    assert(workerResult.feedFetchSuccessCount === 1, 'Worker did not fetch the mocked RSS feed successfully.', workerResult);
    assert(workerResult.fetchedCount >= 5, 'Worker did not parse all mocked RSS scenarios.', workerResult);
    assert(workerResult.imageHydrationLookupCount >= 2, 'Worker did not attempt article page image hydration.', workerResult);
    assert(workerResult.imageHydrationFoundCount >= 1, 'Worker did not find the mocked article page image.', workerResult);
    assert(workerResult.noThumbnailRejectedCount >= 1, 'Worker did not reject the no-thumbnail scenario.', workerResult);
    assert(workerResult.locallyRejectedCount >= 1, 'Worker did not reject the local prefilter scenario.', workerResult);
    assert(workerResult.eligibleForAiCount >= 3, 'Worker did not pass expected articles to AI eligibility.', workerResult);
    assert(workerResult.aiReviewedCount >= 3, 'Worker did not review expected AI scenarios.', workerResult);
    assert(workerResult.acceptedCount >= 2, 'Worker did not accept both positive scenarios.', workerResult);
    assert(workerResult.rejectedCount >= 3, 'Worker did not reject all negative scenarios.', workerResult);
    assert(workerResult.reviewSaveOk === true, 'Worker did not save review rows.', workerResult);
    assert(workerResult.articleSaveOk === true, 'Worker did not save accepted articles.', workerResult);
    assert(workerResult.articleSummaryTranslationCount >= 4, 'Worker did not translate both accepted articles to French and Japanese.', workerResult);
    assert(workerResult.articleSummaryFailedTaskCount === 0, 'Worker had failed translation tasks.', workerResult);
    assert(workerResult.articleSummarySaveOk === true, 'Worker did not save translated summaries.', workerResult);
    assert(workerResult.articleSummaryPublishOk === true, 'Worker did not publish translated articles.', workerResult);
    assert(workerResult.publicFeedSnapshotRefreshOk === true, 'Worker did not refresh public_feed_snapshot.', workerResult);
    assert(workerResult.workerRunSaveOk === true, 'Worker did not save worker run telemetry.', workerResult);
    assert(workerResult.aiProvider === 'local', 'Worker should use the mocked local AI provider only.', workerResult);
    assert(workerResult.openAiCallCount === 0, 'Worker unexpectedly called OpenAI path in offline test.', workerResult);
    logOk('Worker refresh result verified');

    verifyDatabaseState(db, ctx);
    await verifyMockWeb(ctx);
    await verifyTranslationRecovery(ctx, db);
    await verifyMockWeb(ctx);

    console.log('\n✅ NutsNews fully offline Worker E2E regression passed.');
  } catch (error) {
    console.error('\n❌ NutsNews fully offline Worker E2E regression failed.');
    console.error(error?.stack || error?.message || error);
    if (error?.details) {
      console.error('\nFailure details:');
      console.error(JSON.stringify(error.details, null, 2));
    }
    if (workerProcess?.getOutput) {
      console.error('\nWrangler output:');
      console.error(workerProcess.getOutput().slice(-8000));
    }
    process.exitCode = 1;
  } finally {
    logStep('Stopping Worker and mock services');
    await stopWranglerDev(workerProcess).catch(() => null);
    await Promise.all([
      closeServer(rssServer),
      closeServer(aiServer),
      closeServer(supabaseServer),
      closeServer(webServer),
    ]);

    clearTimeout(watchdog);
    const exitCode = process.exitCode ?? 0;
    logOk(`Cleanup complete; exiting Worker E2E regression with code ${exitCode}.`);
    await sleep(EXIT_AFTER_CLEANUP_DELAY_MS);
    process.exit(exitCode);
  }
}

run();
