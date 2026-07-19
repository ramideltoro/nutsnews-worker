#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const WORKER_DIR = resolve(REPO_ROOT, 'worker');

const LOCAL_AI_KEY = 'db-provider-smoke-local-ai-key';
const BACKEND_API_TOKEN = 'db-provider-smoke-backend-api-token';
const BACKEND_POSTGRES_PRIMARY_CONFIRMATION = 'enable-backend-postgres-primary';
const TEST_SOURCE = 'NutsNews DB Provider Smoke';
const SERVER_CLOSE_TIMEOUT_MS = 1500;

const scenarios = [
  {
    name: 'backend_postgres_primary without Supabase bindings',
    providerMode: 'backend_postgres_primary',
    ports: {
      worker: 8797,
      supabase: 8902,
      backendApi: 8904,
      ai: 8900,
      rss: 8901,
    },
  },
  {
    name: 'supabase_primary explicit rollback path',
    providerMode: 'supabase_primary',
    ports: {
      worker: 8807,
      supabase: 8912,
      backendApi: 8914,
      ai: 8910,
      rss: 8911,
    },
  },
];

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

function buildContext(scenario) {
  const runId = `db-provider-smoke-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const rssBaseUrl = `http://127.0.0.1:${scenario.ports.rss}`;
  const articleUrl = `${rssBaseUrl}/article/${runId}`;
  const imageUrl = `${rssBaseUrl}/images/${runId}.jpg`;

  return {
    ...scenario,
    runId,
    workerUrl: `http://127.0.0.1:${scenario.ports.worker}`,
    supabaseUrl: `http://127.0.0.1:${scenario.ports.supabase}`,
    backendApiUrl: `http://127.0.0.1:${scenario.ports.backendApi}`,
    aiUrl: `http://127.0.0.1:${scenario.ports.ai}`,
    rssBaseUrl,
    feedUrl: `${rssBaseUrl}/rss.xml?run=${encodeURIComponent(runId)}`,
    article: {
      title: `NutsNews DB provider smoke ${runId} neighbors restore a joyful community garden`,
      url: articleUrl,
      imageUrl,
    },
    configPath: resolve(WORKER_DIR, `wrangler.db-provider-smoke.${scenario.providerMode}.generated.jsonc`),
  };
}

function makeDb(ctx) {
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
    supabaseRequestCount: 0,
    supabaseWriteCount: 0,
    backendApiRequestCount: 0,
    backendApiWriteCount: 0,
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
  db.public_feed_snapshot = db.articles
    .filter((article) => article.status === 'published' && article.image_url && article.ai_summary)
    .slice()
    .sort((a, b) => String(b.published_on_site_at ?? '').localeCompare(String(a.published_on_site_at ?? '')))
    .map((article) => ({ ...article }));
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

function buildRssXml(ctx) {
  const pubDate = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>NutsNews DB provider smoke feed</title>
    <link>${escapeXml(ctx.rssBaseUrl)}</link>
    <description>Mock provider-mode smoke feed.</description>
    <item>
      <title>${escapeXml(ctx.article.title)}</title>
      <link>${escapeXml(ctx.article.url)}</link>
      <guid isPermaLink="true">${escapeXml(ctx.article.url)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>Neighbors and volunteers restore a garden with kindness, hope, and a cheerful community celebration.</description>
      <media:content url="${escapeXml(ctx.article.imageUrl)}" medium="image" type="image/jpeg" />
    </item>
  </channel>
</rss>`;
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

    textResponse(response, 200, '<!doctype html><html><body>Provider smoke article.</body></html>', 'text/html; charset=utf-8');
  });

  return startServer(server, ctx.ports.rss, 'Mock RSS/article server');
}

function startMockAiServer(ctx) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', ctx.aiUrl);

    if (request.headers['x-nutsnews-ai-key'] !== LOCAL_AI_KEY) {
      jsonResponse(response, 401, { error: 'Invalid mock local AI key.' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/review') {
      jsonResponse(response, 200, {
        model: 'nutsnews-db-provider-smoke-mock-ai',
        ai_model: 'nutsnews-db-provider-smoke-mock-ai',
        decision: 'accept',
        category: 'Community | Uplifting',
        positivity_score: 9,
        summary: 'Neighbors restore a community garden and celebrate a hopeful act of kindness together.',
        reason: 'Mock AI accepted this deterministic provider-mode smoke scenario.',
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        duration_ms: 1,
      });
      return;
    }

    jsonResponse(response, 404, { error: `Mock AI route not found: ${request.method} ${url.pathname}` });
  });

  return startServer(server, ctx.ports.ai, 'Mock local AI server');
}

function parseInFilter(value) {
  if (!value || !value.startsWith('in.(') || !value.endsWith(')')) {
    return null;
  }

  return value
    .slice(4, -1)
    .split(',')
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
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

function startMockSupabaseServer(ctx, db) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', ctx.supabaseUrl);
    const path = url.pathname.replace(/^\/rest\/v1\/?/, '');
    db.supabaseRequestCount += 1;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? 'GET')) {
      db.supabaseWriteCount += 1;
    }

    if (!url.pathname.startsWith('/rest/v1/')) {
      jsonResponse(response, 404, { error: `Mock Supabase only supports /rest/v1. Got ${url.pathname}` });
      return;
    }

    if (path === 'rss_feeds' && request.method === 'GET') {
      jsonResponse(response, 200, db.rss_feeds.map(({ source, url: feedUrl, is_positive_source }) => ({ source, url: feedUrl, is_positive_source })));
      return;
    }

    if (path === 'article_ai_reviews' && request.method === 'GET') {
      jsonResponse(response, 200, filterByOriginalUrl(db.article_ai_reviews, url.searchParams).map((row) => ({ ...row })));
      return;
    }

    if (path === 'article_ai_reviews' && request.method === 'POST') {
      const body = await readBody(request);
      upsertByKey(db.article_ai_reviews, Array.isArray(body) ? body : [body].filter(Boolean), (row) => row.original_url, true);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'articles' && request.method === 'HEAD') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-range': `0-0/${db.articles.length}`,
      });
      response.end();
      return;
    }

    if (path === 'articles' && request.method === 'GET') {
      jsonResponse(response, 200, filterByOriginalUrl(db.articles, url.searchParams).map((row) => ({ ...row })));
      return;
    }

    if (path === 'articles' && request.method === 'POST') {
      const body = await readBody(request);
      upsertByKey(db.articles, Array.isArray(body) ? body : [body].filter(Boolean), (row) => row.original_url, false);
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'articles' && request.method === 'PATCH') {
      const body = (await readBody(request)) ?? {};
      const targets = new Set(filterByOriginalUrl(db.articles, url.searchParams).map((row) => row.original_url));
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
      jsonResponse(response, 200, []);
      return;
    }

    if (path === 'article_summaries' && request.method === 'POST') {
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
      upsertByKey(db.feed_health, Array.isArray(body) ? body : [body].filter(Boolean), (row) => row.feed_url, true);
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
      db.ai_usage_runs.push(await readBody(request));
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'worker_runs' && request.method === 'POST') {
      db.worker_runs.push(await readBody(request));
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }

    if (path === 'runtime_feature_flags' && request.method === 'GET') {
      jsonResponse(response, 200, [{ enabled: false }]);
      return;
    }

    jsonResponse(response, 404, { error: `Unhandled mock Supabase route: ${request.method} ${path}` });
  });

  return startServer(server, ctx.ports.supabase, 'Mock Supabase/PostgREST server');
}

function rowsMatchingCandidateUrls(rows, candidateUrls) {
  if (!Array.isArray(candidateUrls) || candidateUrls.length === 0) {
    return rows;
  }

  const allowed = new Set(candidateUrls);
  return rows.filter((row) => allowed.has(row.original_url));
}

function startMockBackendApiServer(ctx, db) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', ctx.backendApiUrl);
    const operation = url.pathname.replace(/^\/api\/worker\/db\/?/, '');

    if (!url.pathname.startsWith('/api/worker/db/')) {
      jsonResponse(response, 404, { error: `Mock backend API only supports /api/worker/db. Got ${url.pathname}` });
      return;
    }

    if (request.method !== 'POST') {
      jsonResponse(response, 405, { error: `Mock backend API route requires POST: ${operation}` });
      return;
    }

    if (request.headers.authorization !== `Bearer ${BACKEND_API_TOKEN}`) {
      jsonResponse(response, 401, { error: 'Invalid mock backend API token.' });
      return;
    }

    db.backendApiRequestCount += 1;
    const body = (await readBody(request)) ?? {};
    const isWriteOperation = [
      'save-article-summaries-batch',
      'save-feed-health-batch',
      'save-article-reviews-batch',
      'save-accepted-articles-batch',
      'publish-articles-batch',
      'refresh-public-feed-snapshot',
      'save-ai-usage-run',
      'save-worker-run',
    ].includes(operation);

    if (isWriteOperation) {
      db.backendApiWriteCount += 1;
    }

    if (operation === 'load-feeds-for-shard') {
      jsonResponse(response, 200, db.rss_feeds.map(({ source, url: feedUrl, is_positive_source }) => ({ source, url: feedUrl, is_positive_source })));
      return;
    }

    if (operation === 'load-reviewed-url-rows') {
      jsonResponse(response, 200, rowsMatchingCandidateUrls(db.article_ai_reviews, body.candidateUrls).map((row) => ({ ...row })));
      return;
    }

    if (operation === 'load-published-article-url-rows') {
      jsonResponse(response, 200, rowsMatchingCandidateUrls(db.articles, body.candidateUrls).map(({ original_url }) => ({ original_url })));
      return;
    }

    if (operation === 'load-article-count-for-backpressure') {
      jsonResponse(response, 200, { articleCount: db.articles.length, error: null });
      return;
    }

    if (operation === 'load-existing-summary-language-rows') {
      jsonResponse(response, 200, []);
      return;
    }

    if (operation === 'load-summary-translation-recovery-articles') {
      jsonResponse(response, 200, []);
      return;
    }

    if (operation === 'save-article-summaries-batch') {
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'load-feed-health-snapshots') {
      jsonResponse(response, 200, db.feed_health.map((row) => ({ ...row })));
      return;
    }

    if (operation === 'save-feed-health-batch') {
      upsertByKey(db.feed_health, Array.isArray(body.feedHealthRows) ? body.feedHealthRows : [], (row) => row.feed_url, true);
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'save-article-reviews-batch') {
      upsertByKey(db.article_ai_reviews, Array.isArray(body.reviews) ? body.reviews : [], (row) => row.original_url, true);
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'save-accepted-articles-batch') {
      upsertByKey(db.articles, Array.isArray(body.articles) ? body.articles : [], (row) => row.original_url, false);
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'publish-articles-batch') {
      const originalUrls = new Set(Array.isArray(body.originalUrls) ? body.originalUrls : []);
      for (const article of db.articles) {
        if (originalUrls.has(article.original_url)) {
          article.status = body.status ?? 'published';
        }
      }
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'refresh-public-feed-snapshot') {
      refreshPublicFeedSnapshot(db);
      jsonResponse(response, 200, { refreshedAt: new Date().toISOString() });
      return;
    }

    if (operation === 'save-ai-usage-run') {
      db.ai_usage_runs.push(body.run);
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'save-worker-run') {
      db.worker_runs.push(body.run);
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (operation === 'get-runtime-feature-flag') {
      jsonResponse(response, 200, { key: body.key, enabled: false });
      return;
    }

    jsonResponse(response, 404, { error: `Unhandled mock backend API route: ${request.method} ${operation}` });
  });

  return startServer(server, ctx.ports.backendApi, 'Mock backend-compatible database API server');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
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

function writeGeneratedWranglerConfig(ctx) {
  const databaseVars = {
    NUTSNEWS_DATABASE_PROVIDER_MODE: ctx.providerMode,
  };

  if (ctx.providerMode !== 'backend_postgres_primary') {
    databaseVars.SUPABASE_URL = ctx.supabaseUrl;
    databaseVars.SUPABASE_SERVICE_ROLE_KEY = 'db-provider-smoke-service-role-key';
  }

  if (ctx.providerMode !== 'supabase_primary') {
    databaseVars.NUTSNEWS_BACKEND_API_URL = ctx.backendApiUrl;
    databaseVars.NUTSNEWS_BACKEND_API_TOKEN = BACKEND_API_TOKEN;
  }

  if (ctx.providerMode === 'backend_postgres_primary') {
    databaseVars.NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION = BACKEND_POSTGRES_PRIMARY_CONFIRMATION;
  }

  const config = {
    $schema: 'node_modules/wrangler/config-schema.json',
    name: `nutsnews-worker-db-provider-smoke-${ctx.providerMode}`,
    main: 'src/index.ts',
    compatibility_date: '2026-06-27',
    observability: { enabled: false },
    vars: {
      ...databaseVars,
      AI_PROVIDER: 'local',
      LOCAL_AI_URL: ctx.aiUrl,
      LOCAL_AI_API_KEY: LOCAL_AI_KEY,
      LOCAL_AI_MODEL: 'nutsnews-db-provider-smoke-mock-ai',
      OPENAI_API_KEY: 'db-provider-smoke-openai-key',
      AI_PROVIDER_FALLBACK_TO_OPENAI: 'true',
      AI_REVIEW_CONCURRENCY: '1',
      FEED_SHARD_INDEX: '0',
      FEEDS_PER_SHARD: '1',
      ARTICLE_PAGE_IMAGE_LOOKUP_LIMIT: '1',
      ENABLED_SUMMARY_LANGUAGES: 'off',
      SUMMARY_TRANSLATION_LIMIT: '0',
      HOLD_ARTICLES_FOR_TRANSLATIONS: 'false',
      UPSTASH_REDIS_ENABLED: 'false',
    },
  };

  writeFileSync(ctx.configPath, JSON.stringify(config, null, 2));
  return ctx.configPath;
}

function startWranglerDev(ctx) {
  const configPath = writeGeneratedWranglerConfig(ctx);
  const child = spawn('npx', ['wrangler', 'dev', '-c', configPath, '--port', String(ctx.ports.worker), '--ip', '127.0.0.1'], {
    cwd: WORKER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      NO_UPDATE_NOTIFIER: 'true',
    },
  });

  let output = '';
  const verbose = process.env.NUTSNEWS_DB_PROVIDER_SMOKE_VERBOSE === '1';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    if (verbose) {
      process.stdout.write(text);
    }
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    if (verbose) {
      process.stderr.write(text);
    }
  });

  return { child, configPath, getOutput: () => output };
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

async function runScenario(scenario) {
  const ctx = buildContext(scenario);
  const db = makeDb(ctx);
  let rssServer;
  let aiServer;
  let supabaseServer;
  let backendApiServer;
  let workerProcess;

  logStep(`Running database provider smoke: ${scenario.name}`);

  try {
    rssServer = await startMockRssServer(ctx);
    aiServer = await startMockAiServer(ctx);
    if (ctx.providerMode !== 'backend_postgres_primary') {
      supabaseServer = await startMockSupabaseServer(ctx, db);
    }
    if (ctx.providerMode !== 'supabase_primary') {
      backendApiServer = await startMockBackendApiServer(ctx, db);
    }

    workerProcess = startWranglerDev(ctx);
    await waitForWorker(ctx, workerProcess);

    const workerResult = await fetchJson(`${ctx.workerUrl}/?limit=1&imageLookups=1&_=${Date.now()}`);

    assert(workerResult.databaseProviderMode === ctx.providerMode, 'Worker reported the wrong database provider mode.', workerResult);
    assert(
      workerResult.databaseProvider === (ctx.providerMode === 'backend_postgres_primary' ? 'backend_postgres' : 'supabase'),
      'Worker reported the wrong active database provider.',
      workerResult,
    );
    assert(workerResult.feedCount === 1, 'Worker should load exactly one mocked feed.', workerResult);
    assert(workerResult.acceptedCount >= 1, 'Worker did not accept the mocked article.', workerResult);
    assert(workerResult.reviewSaveOk === true, 'Worker did not save review rows.', workerResult);
    assert(workerResult.articleSaveOk === true, 'Worker did not save accepted articles.', workerResult);
    assert(workerResult.publicFeedSnapshotRefreshOk === true, 'Worker did not refresh public feed snapshot.', workerResult);
    assert(workerResult.aiUsageSaveOk === true, 'Worker did not save AI usage telemetry.', workerResult);
    assert(workerResult.workerRunSaveOk === true, 'Worker did not save worker run telemetry.', workerResult);

    assert(db.articles.length === 1, 'Accepted article was not stored exactly once.', db);
    assert(db.article_ai_reviews.length === 1, 'Review row was not stored exactly once.', db);
    assert(db.public_feed_snapshot.length === 1, 'Public feed snapshot was not refreshed exactly once.', db);
    assert(db.ai_usage_runs.length >= 1, 'AI usage run was not stored.', db);
    assert(db.worker_runs.length >= 1, 'Worker run was not stored.', db);

    if (ctx.providerMode === 'backend_postgres_primary') {
      assert(db.supabaseRequestCount === 0, 'Backend-primary mode unexpectedly called Supabase.', db);
      assert(db.backendApiRequestCount > 0, 'Backend-primary mode did not call the mock backend API.', db);
      assert(db.backendApiWriteCount > 0, 'Backend-primary mode did not perform backend API writes.', db);
    } else {
      assert(db.supabaseRequestCount > 0, 'Supabase-primary rollback mode did not call the mock Supabase API.', db);
      assert(db.supabaseWriteCount > 0, 'Supabase-primary rollback mode did not perform Supabase writes.', db);
      assert(db.backendApiRequestCount === 0, 'Supabase-primary rollback mode unexpectedly called the backend API.', db);
    }

    logOk(`Database provider smoke passed: ${scenario.name}`);
  } catch (error) {
    console.error(`\n❌ Database provider smoke failed: ${scenario.name}`);
    console.error(error?.stack || error?.message || error);
    if (error?.details) {
      console.error('\nFailure details:');
      console.error(JSON.stringify(error.details, null, 2));
    }
    if (workerProcess?.getOutput) {
      console.error('\nWrangler output:');
      console.error(workerProcess.getOutput().slice(-8000));
    }
    throw error;
  } finally {
    await stopWranglerDev(workerProcess).catch(() => null);
    await Promise.all([
      closeServer(rssServer),
      closeServer(aiServer),
      closeServer(supabaseServer),
      closeServer(backendApiServer),
    ]);
    if (ctx.configPath && existsSync(ctx.configPath)) {
      unlinkSync(ctx.configPath);
    }
  }
}

for (const scenario of scenarios) {
  await runScenario(scenario);
}

console.log('\n✅ Database provider mode smoke tests passed.');
