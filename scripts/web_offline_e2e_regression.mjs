#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const webDir = fileURLToPath(new URL("../web/", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const requireFromWeb = createRequire(new URL("../web/package.json", import.meta.url));
const { chromium, expect } = requireFromWeb("@playwright/test");

const runId = `web-offline-e2e-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const supabasePort = Number(process.env.WEB_E2E_SUPABASE_PORT || 8895);
const mockExternalPort = Number(process.env.WEB_E2E_EXTERNAL_PORT || 8896);
const webPort = Number(process.env.WEB_E2E_WEB_PORT || 3011);
const supabaseUrl = `http://127.0.0.1:${supabasePort}`;
const mockExternalUrl = `http://127.0.0.1:${mockExternalPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

const articleUrlOne = `https://mock.nutsnews.test/story/cotton-candy-planets-${runId}`;
const articleUrlTwo = `https://mock.nutsnews.test/story/community-garden-${runId}`;

const articles = [
  {
    id: `web-e2e-article-1-${runId}`,
    source: "NutsNews Mock Science",
    title: `Mock super puff planets bring wonder ${runId}`,
    original_url: articleUrlOne,
    image_url: `${mockExternalUrl}/images/super-puff.png`,
    published_at: "2026-06-28T01:00:00+00:00",
    published_on_site_at: "2026-06-28T01:05:00+00:00",
    ai_summary:
      "A cheerful offline regression story about astronomers finding gentle super puff planets.",
    category: "Science | Uplifting",
    positivity_score: 9,
    snapshot_rank: 1,
  },
  {
    id: `web-e2e-article-2-${runId}`,
    source: "NutsNews Mock Community",
    title: `Mock community garden shares joy ${runId}`,
    original_url: articleUrlTwo,
    image_url: `${mockExternalUrl}/images/community-garden.png`,
    published_at: "2026-06-28T00:00:00+00:00",
    published_on_site_at: "2026-06-28T00:30:00+00:00",
    ai_summary:
      "Neighbors share vegetables, smiles, and a calm moment in a mock community garden.",
    category: "Community | Wellness",
    positivity_score: 8,
    snapshot_rank: 2,
  },
];

const articleSummaries = [
  {
    original_url: articleUrlOne,
    language_code: "fr",
    title: `Planètes super légères de test ${runId}`,
    summary:
      "Une histoire de test en français sur des planètes légères et une découverte joyeuse.",
  },
  {
    original_url: articleUrlTwo,
    language_code: "fr",
    title: `Jardin communautaire de test ${runId}`,
    summary:
      "Des voisins partagent un moment positif dans un jardin communautaire simulé.",
  },
  {
    original_url: articleUrlOne,
    language_code: "ja",
    title: `テスト用の軽い惑星 ${runId}`,
    summary: "軽い惑星の発見を伝える前向きな日本語テスト記事です。",
  },
  {
    original_url: articleUrlTwo,
    language_code: "ja",
    title: `テスト用コミュニティガーデン ${runId}`,
    summary: "地域の人々が笑顔を分かち合う日本語のテスト記事です。",
  },
];

const emailDeliveries = [];
const quotaEvents = [];
let nextQuotaEventId = 1;

function logStep(message) {
  console.log(`▶ ${message}`);
}

function logOk(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
    "access-control-expose-headers": "content-range",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function options(response) {
  response.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
  });
  response.end();
}

function stripColumns(row) {
  const { snapshot_rank: _snapshotRank, ...article } = row;
  return article;
}

function applyRange(request, rows) {
  const rangeHeader = request.headers.range;

  if (!rangeHeader) {
    return rows;
  }

  const match = String(rangeHeader).match(/(\d+)-(\d+)/);

  if (!match) {
    return rows;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return rows;
  }

  return rows.slice(start, end + 1);
}

function createSupabaseMockServer() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        options(response);
        return;
      }

      const url = new URL(request.url ?? "/", supabaseUrl);

      if (url.pathname === "/rest/v1/public_feed_snapshot" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articles.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/public_feed_snapshot" && request.method === "GET") {
        const rows = applyRange(
          request,
          articles.sort((a, b) => a.snapshot_rank - b.snapshot_rank).map(stripColumns),
        );
        json(response, 200, rows, { "content-range": `0-${rows.length - 1}/${articles.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/articles" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articles.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/articles" && request.method === "GET") {
        if (request.headers.prefer?.toString().includes("count=exact") || url.searchParams.get("select") === "*") {
          json(response, 200, [], { "content-range": `0-0/${articles.length}` });
          return;
        }

        const rows = applyRange(request, articles.map(stripColumns));
        json(response, 200, rows, { "content-range": `0-${rows.length - 1}/${articles.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/article_summaries" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articleSummaries.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/article_summaries" && request.method === "GET") {
        if (request.headers.prefer?.toString().includes("count=exact") || url.searchParams.get("select") === "*") {
          json(response, 200, [], { "content-range": `0-0/${articleSummaries.length}` });
          return;
        }

        const languageFilter = url.searchParams.get("language_code") ?? "";
        const languageMatch = languageFilter.match(/^eq\.(.+)$/);
        const languageCode = languageMatch?.[1];
        const rows = languageCode
          ? articleSummaries.filter((summary) => summary.language_code === languageCode)
          : articleSummaries;
        json(response, 200, rows, { "content-range": `0-${rows.length - 1}/${rows.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/rss_feeds" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": "0-0/1" });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/rss_feeds" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/1" });
        return;
      }

      if (url.pathname === "/rest/v1/ai_usage_runs" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/0" });
        return;
      }

      if (url.pathname === "/rest/v1/worker_runs" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/0" });
        return;
      }

      if (url.pathname === "/rest/v1/quota_usage_events" && request.method === "GET") {
        json(response, 200, quotaEvents, { "content-range": `0-${quotaEvents.length - 1}/${quotaEvents.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/quota_usage_events" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        quotaEvents.push({
          id: nextQuotaEventId++,
          created_at: new Date().toISOString(),
          event_type: payload.event_type,
          event_source: payload.event_source,
          provider: payload.provider,
          quantity: payload.quantity ?? 1,
          metadata: payload.metadata ?? {},
        });
        json(response, 201, [quotaEvents.at(-1)]);
        return;
      }

      if (url.pathname === "/rest/v1/rpc/search_articles" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const query = String(payload.search_query ?? "").toLowerCase();
        const rows = articles
          .filter((article) =>
            [article.title, article.ai_summary, article.source, article.category]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
          .map(stripColumns);
        json(response, 200, rows);
        return;
      }

      json(response, 404, { error: `Unhandled mock Supabase route ${request.method} ${url.pathname}` });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return server;
}

function createExternalMockServer() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        options(response);
        return;
      }

      const url = new URL(request.url ?? "/", mockExternalUrl);

      if ((url.pathname === "/images/super-puff.png" || url.pathname === "/images/community-garden.png") && request.method === "GET") {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
          "base64",
        );
        response.writeHead(200, {
          "content-type": "image/png",
          "cache-control": "public, max-age=31536000, immutable",
        });
        response.end(png);
        return;
      }

      if (url.pathname === "/turnstile/v0/siteverify" && request.method === "POST") {
        await readBody(request);
        json(response, 200, { success: true, challenge_ts: new Date().toISOString(), hostname: "localhost" });
        return;
      }

      if (url.pathname === "/emails" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        emailDeliveries.push(payload);
        json(response, 200, { id: `mock-email-${emailDeliveries.length}` });
        return;
      }

      json(response, 404, { error: `Unhandled external mock route ${request.method} ${url.pathname}` });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return server;
}

function listen(server, port, label) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      logOk(`${label} listening on http://127.0.0.1:${port}`);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function waitForUrl(url, timeoutMs = 60000, child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child?.e2eSpawnError) {
      fail(`Next.js failed to start: ${child.e2eSpawnError.message}`);
    }

    if (child && child.exitCode !== null) {
      const output = child.e2eOutput ? `\n\nNext.js output:\n${child.e2eOutput.slice(-4000)}` : "";
      fail(`Next.js dev server exited early with code ${child.exitCode}.${output}`);
    }

    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting.
    }

    await delay(500);
  }

  const output = child?.e2eOutput ? `\n\nNext.js output:\n${child.e2eOutput.slice(-4000)}` : "";
  fail(`Timed out waiting for ${url}.${output}`);
}

function startNextDev() {
  const child = spawn(npmCommand, ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: webDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "offline-e2e-anon-key",
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: "offline-e2e-service-role-key",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "offline-e2e-turnstile-site-key",
      TURNSTILE_SECRET_KEY: "offline-e2e-turnstile-secret-key",
      TURNSTILE_VERIFY_URL: `${mockExternalUrl}/turnstile/v0/siteverify`,
      RESEND_API_KEY: "offline-e2e-resend-key",
      RESEND_EMAILS_URL: `${mockExternalUrl}/emails`,
      CONTACT_TO_EMAIL: "rami@example.test",
      CONTACT_FROM_EMAIL: "NutsNews Offline E2E <noreply@example.test>",
      AUTH_SECRET: "offline-e2e-auth-secret-not-for-production",
      NEXTAUTH_URL: webUrl,
      NEXT_PUBLIC_APP_ENV: "offline-e2e",
    },
  });

  child.e2eOutput = "";
  child.once("error", (error) => {
    child.e2eSpawnError = error;
    console.error(`Next.js dev server failed to spawn from ${webDir}: ${error.message}`);
  });
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    child.e2eOutput += text;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    child.e2eOutput += text;
    process.stderr.write(chunk);
  });

  return child;
}

async function stopChild(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000).then(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

async function runBrowserChecks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: webUrl });
  await context.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.turnstile = {
          render: function(container, options) {
            container.setAttribute('data-mock-turnstile', 'rendered');
            setTimeout(function(){ options && options.callback && options.callback('mock-turnstile-token'); }, 25);
            return 'mock-widget-id';
          },
          reset: function() {},
          remove: function() {}
        };
      `,
    });
  });

  await context.route("**/_next/image**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV6I8QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });

  const page = await context.newPage();

  async function openSettingsPanel() {
    const settingsButton = page.getByRole("button", {
      name: /Open NutsNews settings|Ouvrir les paramètres NutsNews|NutsNewsの設定を開く/i,
    });
    const settingsPanel = page.locator(".theme-panel").first();

    await expect(settingsButton).toBeVisible({ timeout: 20000 });
    await settingsButton.scrollIntoViewIfNeeded();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (await settingsPanel.isVisible().catch(() => false)) {
        return settingsPanel;
      }

      await settingsButton.click({ force: true });

      try {
        await expect(settingsPanel).toBeVisible({ timeout: 10000 });
        return settingsPanel;
      } catch {
        await settingsButton.evaluate((button) => button.click());
        try {
          await expect(settingsPanel).toBeVisible({ timeout: 10000 });
          return settingsPanel;
        } catch {
          if (attempt === 3) {
            throw new Error("Settings panel did not open after clicking the footer settings button.");
          }
          await delay(500);
        }
      }
    }

    throw new Error("Settings panel did not open.");
  }

  async function closeSettingsPanel() {
    const settingsPanel = page.locator(".theme-panel").first();

    if (!(await settingsPanel.isVisible().catch(() => false))) {
      return;
    }

    const settingsButton = page.getByRole("button", {
      name: /Open NutsNews settings|Ouvrir les paramètres NutsNews|NutsNewsの設定を開く/i,
    });
    await settingsButton.click({ force: true });
    await expect(settingsPanel).toBeHidden({ timeout: 10000 }).catch(() => {});
  }

  logStep("Verifying homepage rendering");
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("Nuts");
  await expect(page.locator("h1")).toContainText("News");
  await expect(page.getByText(articles[0].title).first()).toBeVisible();
  logOk("Homepage rendered with mock article");

  logStep("Verifying footer home, search, settings, about, contact, and privacy controls");
  await page.getByLabel("Go to NutsNews home").click();
  await expect(page).toHaveURL(/\/$/);

  await openSettingsPanel();
  await closeSettingsPanel();

  await page.getByLabel("Open search").click();
  const searchDialog = page.getByRole("dialog", { name: /Search/i });
  await expect(searchDialog).toBeVisible();
  await searchDialog.locator("#footer-archive-search").fill("planets");
  await searchDialog.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText(articles[0].title).first()).toBeVisible();
  await searchDialog.getByRole("button", { name: "Close search", exact: true }).click();
  logOk("Footer search returned a mock article");

  const footer = page.locator("footer");
  const footerNavigationTimeoutMs = 20000;

  async function clickFooterLink(name, path, expectedUrlPattern) {
    const link = footer.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", path);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL(expectedUrlPattern, { timeout: footerNavigationTimeoutMs });
  }

  await clickFooterLink("About", "/about", /\/about$/);
  await expect(page.locator("main").getByText("About NutsNews", { exact: true })).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });

  await clickFooterLink("Privacy", "/privacy", /\/privacy$/);
  await expect(page.locator("main").getByText(/Privacy Policy|NutsNews Privacy Policy/i).first()).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });

  await clickFooterLink("Contact", "/contact", /\/contact$/);
  await expect(page.locator("main").getByRole("heading", { name: /Send a message/i })).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });
  logOk("Footer navigation links render public pages");

  logStep("Verifying contact form sends email through mock Resend");
  await page.getByLabel("Your email").fill("reader@example.test");
  await page.getByLabel("Message").fill("This is an offline regression test contact message for NutsNews.");
  await page.waitForFunction(() => document.querySelector('[data-mock-turnstile="rendered"]'));
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks. Your message was sent to NutsNews.")).toBeVisible({ timeout: 10000 });

  if (emailDeliveries.length !== 1) {
    fail(`Expected exactly 1 mock email delivery, got ${emailDeliveries.length}.`);
  }

  if (!emailDeliveries[0]?.reply_to?.includes("reader@example.test")) {
    fail("Mock email delivery did not include the submitted reply_to address.");
  }
  logOk("Contact form sent one mock email");

  logStep("Verifying language switch renders translated article text");
  await page.goto("/", { waitUntil: "networkidle" });
  const languageSettingsPanel = await openSettingsPanel();
  await languageSettingsPanel.getByRole("button", { name: /Language/i }).click();
  await languageSettingsPanel.getByRole("button", { name: /Français|French/i }).click();
  await expect(page.getByText(articleSummaries[0].title)).toBeVisible({ timeout: 10000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  logOk("French language change rendered translated articles");

  await browser.close();
}

async function run() {
  let nextProcess;
  const supabaseServer = createSupabaseMockServer();
  const externalServer = createExternalMockServer();

  console.log(`NutsNews fully offline Web E2E regression run: ${runId}`);
  console.log(`Mock Supabase URL: ${supabaseUrl}`);
  console.log(`Mock external service URL: ${mockExternalUrl}`);
  console.log(`Web URL: ${webUrl}`);

  try {
    logStep("Starting mock Supabase and external service servers");
    await listen(supabaseServer, supabasePort, "Mock Supabase/PostgREST server");
    await listen(externalServer, mockExternalPort, "Mock Turnstile/Resend server");

    logStep("Starting real Next.js app against mock services");
    nextProcess = startNextDev();
    await waitForUrl(webUrl, 90000, nextProcess);
    logOk("Next.js app is ready");

    await runBrowserChecks();

    if (quotaEvents.filter((event) => event.event_type === "email_send").length !== 1) {
      fail("Expected one quota_usage_events email_send row after contact form submission.");
    }

    console.log("✅ NutsNews fully offline Web E2E regression passed.");
  } finally {
    logStep("Stopping Next.js app and mock services");
    await stopChild(nextProcess);
    await closeServer(supabaseServer);
    await closeServer(externalServer);
    logOk("Cleanup complete; exiting Web E2E regression.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ NutsNews fully offline Web E2E regression failed.");
    console.error(error);
    process.exit(1);
  });
