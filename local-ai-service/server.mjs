import http from "node:http";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT ?? "8788");
const LOCAL_AI_API_KEY = process.env.LOCAL_AI_API_KEY ?? "";
const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? "120000");
const MAX_ARTICLE_CHARS = Number(process.env.MAX_ARTICLE_CHARS ?? "3000");
const ACCEPTED_SUMMARY_MIN_CHARS = Number(process.env.ACCEPTED_SUMMARY_MIN_CHARS ?? "200");
const ACCEPTED_SUMMARY_MAX_CHARS = Number(process.env.ACCEPTED_SUMMARY_MAX_CHARS ?? "250");
const TRANSLATION_SUMMARY_MAX_CHARS = Number(process.env.TRANSLATION_SUMMARY_MAX_CHARS ?? "250");
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE ?? "30m";
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX ?? "2048");
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT ?? "320");
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE ?? "0");
const SERVICE_STARTED_AT = new Date().toISOString();

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readRequestBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizePlainText(value, fallback = "") {
  return normalizeString(value, fallback)
    .replace(/[`*_~>#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function trimToCharacterLimit(value, maxChars) {
  const text = normalizePlainText(value);

  if (text.length <= maxChars) {
    return text;
  }

  const slice = text.slice(0, maxChars + 1);
  const sentenceBreak = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );

  if (sentenceBreak >= ACCEPTED_SUMMARY_MIN_CHARS) {
    return slice.slice(0, sentenceBreak + 1).trim();
  }

  const wordBreak = slice.lastIndexOf(" ");
  const trimmed = slice
    .slice(0, wordBreak >= ACCEPTED_SUMMARY_MIN_CHARS ? wordBreak : maxChars)
    .replace(/[\s,;:.-]+$/, "")
    .trim();

  if (!trimmed) {
    return text.slice(0, maxChars).trim();
  }

  const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return punctuated.length <= maxChars ? punctuated : trimmed.slice(0, maxChars).trim();
}

function normalizeAcceptedSummary(value, { title, source, excerpt }) {
  const minChars = Math.max(1, Math.min(ACCEPTED_SUMMARY_MIN_CHARS, ACCEPTED_SUMMARY_MAX_CHARS));
  const maxChars = Math.max(minChars, ACCEPTED_SUMMARY_MAX_CHARS);
  const cleanedSummary = normalizePlainText(value);
  const cleanTitle = normalizePlainText(title);
  const cleanSource = normalizePlainText(source, "the original source");
  const cleanExcerpt = normalizePlainText(excerpt);
  const excerptContext = cleanExcerpt.length > 0 ? trimToCharacterLimit(cleanExcerpt, 220) : "";

  const candidates = [
    cleanedSummary,
    cleanTitle ? `The story centers on ${cleanTitle}, while keeping the focus on the positive outcome readers can take from it.` : "",
    excerptContext ? `The article adds useful context: ${excerptContext}` : "",
    `It gives NutsNews readers a calm, positive snapshot from ${cleanSource}, with enough detail to decide whether to open the full story.`,
  ].filter(Boolean);

  let summary = "";

  for (const candidate of candidates) {
    const next = normalizePlainText(`${summary} ${candidate}`);

    if (!summary || next.length <= maxChars || summary.length < minChars) {
      summary = next;
    }

    if (summary.length >= minChars) {
      break;
    }
  }

  if (!summary) {
    summary = `This uplifting story from ${cleanSource} gives NutsNews readers a calm, positive moment and a quick reason to open the original article.`;
  }

  if (summary.length > maxChars) {
    summary = trimToCharacterLimit(summary, maxChars);
  }

  while (summary.length < minChars) {
    const next = normalizePlainText(`${summary} It stays focused on the hopeful part of the story without adding extra claims.`);
    if (next.length > maxChars) {
      break;
    }
    summary = next;
  }

  if (summary.length > maxChars) {
    summary = trimToCharacterLimit(summary, maxChars);
  }

  return summary;
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function isAuthorized(req) {
  if (!LOCAL_AI_API_KEY) {
    return false;
  }

  return normalizeHeaderValue(req.headers["x-nutsnews-ai-key"]) === LOCAL_AI_API_KEY;
}

function normalizeScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(10, Math.round(parsed)));
}

function normalizeDecision(value, score) {
  const text = normalizeString(value).toLowerCase();
  if (text === "accept" || text === "accepted" || text === "true") {
    return "accept";
  }
  if (text === "reject" || text === "rejected" || text === "false") {
    return "reject";
  }
  return score >= 7 ? "accept" : "reject";
}

function extractJsonObject(text) {
  const trimmed = normalizeString(text);

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response did not contain JSON.");
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function buildPrompt({ title, source, excerpt, url }) {
  return `You are the NutsNews local AI reviewer.\n\nNutsNews accepts stories that are positive, uplifting, inspiring, useful, community-focused, wellness-focused, science-focused, animal-focused, travel-focused, culture-focused, nature-focused, space-focused, creativity-focused, or achievement-focused.\n\nNutsNews rejects politics, war, crime, tragedy, outrage, fear, finance/stock-market content, clickbait celebrity gossip, and stories that are mostly negative even if they contain one positive angle.\n\nReturn strict JSON only using exactly these keys:\n{\n  "decision": "accept" or "reject",\n  "category": "one short category label",\n  "positivity_score": integer from 0 to 10,\n  "summary": "200-250 characters for accepted stories, written as 1-2 warm, calm sentences; empty string for rejected stories",\n  "reason": "short reason for the decision"\n}\n\nFor accepted stories, the summary must be between 200 and 250 characters, including spaces. Write 1-2 warm, calm, complete sentences with enough detail for a NutsNews card. Keep it original, specific to the article, and do not copy the article text. For rejected stories, return an empty summary string.\n\nArticle source: ${source}\nArticle title: ${title}\nArticle URL: ${url}\nArticle text:\n${excerpt}`;
}

const SUPPORTED_TRANSLATION_LANGUAGES = {
  fr: "French",
  ja: "Japanese",
  "de-CH": "Swiss German",
  de: "German",
  el: "Greek",
};

function getLanguageName(languageCode) {
  return SUPPORTED_TRANSLATION_LANGUAGES[languageCode] ?? "the requested language";
}

function normalizeLanguageCode(value) {
  const rawLanguageCode = normalizeString(value);
  const lowerLanguageCode = rawLanguageCode.toLowerCase();

  if (
    lowerLanguageCode === "de-ch" ||
    lowerLanguageCode === "de_ch" ||
    lowerLanguageCode === "ch" ||
    lowerLanguageCode === "swiss"
  ) {
    return "de-CH";
  }

  if (lowerLanguageCode === "fr" || lowerLanguageCode === "ja" || lowerLanguageCode === "de" || lowerLanguageCode === "el") {
    return lowerLanguageCode;
  }

  return "";
}

function normalizeLocalizedSummary(value, { fallbackTitle, fallbackSummary }) {
  const title = normalizePlainText(value?.title, fallbackTitle).slice(0, 220).trim() || fallbackTitle;
  const summary = trimToCharacterLimit(normalizePlainText(value?.summary, fallbackSummary), TRANSLATION_SUMMARY_MAX_CHARS);

  return {
    title,
    summary: summary || fallbackSummary,
  };
}

function buildTranslationPrompt({ languageCode, source, title, summary, category }) {
  const languageName = getLanguageName(languageCode);

  return `You are the NutsNews local translation engine.

Translate the NutsNews article card into ${languageName}. Preserve the meaning, warmth, and calm positive tone. Do not add facts. Do not translate URLs or source names. Keep the translated title natural and concise. Keep the translated summary natural for a general reader and under ${TRANSLATION_SUMMARY_MAX_CHARS} characters.

Return strict JSON only using exactly these keys:
{
  "language_code": "${languageCode}",
  "title": "Natural ${languageName} title, no added facts",
  "summary": "Natural ${languageName} summary, no added facts"
}

Source: ${source}
English title: ${title}
English summary: ${summary}
Category: ${category}`;
}

async function callOllama({ model, prompt, signal, systemContent }) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        top_p: 0.8,
        num_ctx: OLLAMA_NUM_CTX,
        num_predict: OLLAMA_NUM_PREDICT,
      },
      messages: [
        {
          role: "system",
          content:
            systemContent ||
            "You are a careful JSON-only classifier and summarizer for an uplifting news app. Accepted summaries must be 200-250 characters for accepted stories.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Ollama request failed with ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return response.json();
}

async function getOllamaModels(signal) {
  const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal });
  const body = response.ok ? await response.json() : null;

  return {
    ok: response.ok,
    status: response.status,
    models: Array.isArray(body?.models)
      ? body.models.map((model) => ({
          name: normalizeString(model.name),
          size: Number(model.size ?? 0) || 0,
          modifiedAt: normalizeString(model.modified_at, null),
        })).filter((model) => model.name).slice(0, 20)
      : [],
  };
}

async function handleHealth(res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const ollama = await getOllamaModels(controller.signal);

    jsonResponse(res, ollama.ok ? 200 : 503, {
      ok: ollama.ok,
      service: "nutsnews-local-ai-service",
      startedAt: SERVICE_STARTED_AT,
      timestamp: new Date().toISOString(),
      ollamaUrl: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL,
      availableModels: ollama.models.map((model) => model.name),
    });
  } catch (error) {
    jsonResponse(res, 503, {
      ok: false,
      service: "nutsnews-local-ai-service",
      startedAt: SERVICE_STARTED_AT,
      timestamp: new Date().toISOString(),
      ollamaUrl: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL,
      error: error instanceof Error ? error.message : "Unknown health check error",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function bytesFromKb(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1024 : 0;
}

async function readMemoryInfo() {
  const meminfo = await readFile("/proc/meminfo", "utf8");
  const values = new Map();

  for (const line of meminfo.split("\n")) {
    const match = line.match(/^([^:]+):\s+(\d+)/);
    if (match) {
      values.set(match[1], Number(match[2]));
    }
  }

  const totalBytes = bytesFromKb(values.get("MemTotal"));
  const availableBytes = bytesFromKb(values.get("MemAvailable"));
  const freeBytes = bytesFromKb(values.get("MemFree"));
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  const swapTotalBytes = bytesFromKb(values.get("SwapTotal"));
  const swapFreeBytes = bytesFromKb(values.get("SwapFree"));

  return {
    totalBytes,
    usedBytes,
    freeBytes,
    availableBytes,
    usagePercent: totalBytes === 0 ? 0 : Math.round((usedBytes / totalBytes) * 100),
    swapTotalBytes,
    swapUsedBytes: Math.max(0, swapTotalBytes - swapFreeBytes),
    swapFreeBytes,
  };
}

async function readLoadAverage() {
  const loadavg = await readFile("/proc/loadavg", "utf8");
  const [oneMinute, fiveMinute, fifteenMinute] = loadavg.trim().split(/\s+/).map(Number);
  const cpuThreads = os.cpus().length;

  return {
    oneMinute: Number.isFinite(oneMinute) ? oneMinute : 0,
    fiveMinute: Number.isFinite(fiveMinute) ? fiveMinute : 0,
    fifteenMinute: Number.isFinite(fifteenMinute) ? fifteenMinute : 0,
    normalizedOneMinutePercent: cpuThreads === 0 ? 0 : Math.round((oneMinute / cpuThreads) * 100),
  };
}

async function readDiskInfo() {
  const { stdout } = await execFileAsync("df", ["-B1", "/"], { timeout: 3000 });
  const lines = stdout.trim().split("\n");
  const row = lines[1]?.trim().split(/\s+/) ?? [];
  const [filesystem, size, used, available, usePercent, mount] = row;

  return {
    filesystem: filesystem ?? "unknown",
    mount: mount ?? "/",
    totalBytes: Number(size ?? 0) || 0,
    usedBytes: Number(used ?? 0) || 0,
    availableBytes: Number(available ?? 0) || 0,
    usagePercent: Number(String(usePercent ?? "0").replace("%", "")) || 0,
  };
}

async function readServiceStatus(serviceName) {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", serviceName], { timeout: 3000 });
    const status = stdout.trim();

    return {
      name: serviceName,
      active: status === "active",
      status: status || "unknown",
    };
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
    const status = stdout || stderr || "inactive";

    return {
      name: serviceName,
      active: status === "active",
      status,
    };
  }
}

async function handleStats(req, res) {
  if (!LOCAL_AI_API_KEY) {
    jsonResponse(res, 500, {
      error: "LOCAL_AI_API_KEY is not configured on the local AI service.",
    });
    return;
  }

  if (!isAuthorized(req)) {
    jsonResponse(res, 401, { error: "Unauthorized" });
    return;
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const [memory, loadAverage, disk, ollama, services] = await Promise.all([
      readMemoryInfo(),
      readLoadAverage(),
      readDiskInfo(),
      getOllamaModels(controller.signal),
      Promise.all([
        readServiceStatus("ollama"),
        readServiceStatus("nutsnews-local-ai"),
        readServiceStatus("cloudflared"),
      ]),
    ]);

    jsonResponse(res, 200, {
      ok: true,
      requestId,
      service: "nutsnews-local-ai-service",
      timestamp: new Date().toISOString(),
      generatedInMs: Date.now() - startedAt,
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        kernel: os.release(),
        uptimeSeconds: Math.round(os.uptime()),
        startedAt: SERVICE_STARTED_AT,
      },
      cpu: {
        model: os.cpus()[0]?.model ?? "unknown",
        threads: os.cpus().length,
        loadAverage,
      },
      memory,
      disk,
      services,
      localAi: {
        port: PORT,
        ollamaUrl: OLLAMA_URL,
        defaultModel: OLLAMA_MODEL,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        maxArticleChars: MAX_ARTICLE_CHARS,
        acceptedSummaryMinChars: ACCEPTED_SUMMARY_MIN_CHARS,
        acceptedSummaryMaxChars: ACCEPTED_SUMMARY_MAX_CHARS,
        translationSummaryMaxChars: TRANSLATION_SUMMARY_MAX_CHARS,
        keepAlive: OLLAMA_KEEP_ALIVE,
        numCtx: OLLAMA_NUM_CTX,
        numPredict: OLLAMA_NUM_PREDICT,
        temperature: OLLAMA_TEMPERATURE,
      },
      ollama: {
        ok: ollama.ok,
        status: ollama.status,
        models: ollama.models,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    jsonResponse(res, 500, {
      ok: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown stats error",
      generatedInMs: Date.now() - startedAt,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleReview(req, res) {
  if (!LOCAL_AI_API_KEY) {
    jsonResponse(res, 500, {
      error: "LOCAL_AI_API_KEY is not configured on the local AI service.",
    });
    return;
  }

  if (!isAuthorized(req)) {
    jsonResponse(res, 401, { error: "Unauthorized" });
    return;
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");

    const model = normalizeString(payload.model, OLLAMA_MODEL) || OLLAMA_MODEL;
    const title = normalizeString(payload.title);
    const source = normalizeString(payload.source, "Unknown source");
    const url = normalizeString(payload.url);
    const excerpt = normalizeString(payload.excerpt).slice(0, MAX_ARTICLE_CHARS);

    if (!title || !excerpt) {
      jsonResponse(res, 400, {
        error: "Both title and excerpt are required.",
      });
      return;
    }

    const prompt = buildPrompt({ title, source, excerpt, url });
    const ollamaResponse = await callOllama({
      model,
      prompt,
      signal: controller.signal,
    });

    const content = normalizeString(ollamaResponse?.message?.content);
    const parsed = extractJsonObject(content);
    const positivityScore = normalizeScore(
      parsed.positivity_score ?? parsed.score ?? parsed.positivityScore,
    );
    const decision = normalizeDecision(parsed.decision ?? parsed.accepted, positivityScore);
    const durationMs = Date.now() - startedAt;
    const promptTokens = Number(ollamaResponse?.prompt_eval_count ?? 0) || 0;
    const completionTokens = Number(ollamaResponse?.eval_count ?? 0) || 0;

    const normalizedSummary = decision === "accept" ? normalizeAcceptedSummary(parsed.summary, { title, source, excerpt }) : "";

    jsonResponse(res, 200, {
      request_id: requestId,
      provider: "local",
      ai_provider: "local",
      model,
      ai_model: model,
      decision,
      category: normalizeString(parsed.category, decision === "accept" ? "Uplifting" : "Rejected") || "Uplifting",
      positivity_score: positivityScore,
      summary: normalizedSummary,
      summary_length: normalizedSummary.length,
      accepted_summary_min_chars: ACCEPTED_SUMMARY_MIN_CHARS,
      accepted_summary_max_chars: ACCEPTED_SUMMARY_MAX_CHARS,
      reason: normalizeString(parsed.reason, "Reviewed by local NutsNews AI model."),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      duration_ms: durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    jsonResponse(res, 500, {
      request_id: requestId,
      error: error instanceof Error ? error.message : "Unknown review error",
      duration_ms: durationMs,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleTranslate(req, res) {
  if (!LOCAL_AI_API_KEY) {
    jsonResponse(res, 500, {
      error: "LOCAL_AI_API_KEY is not configured on the local AI service.",
    });
    return;
  }

  if (!isAuthorized(req)) {
    jsonResponse(res, 401, { error: "Unauthorized" });
    return;
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const rawBody = await readRequestBody(req);
    const payload = JSON.parse(rawBody || "{}");

    const model = normalizeString(payload.model, OLLAMA_MODEL) || OLLAMA_MODEL;
    const languageCode = normalizeLanguageCode(payload.language_code ?? payload.languageCode);
    const title = normalizePlainText(payload.title);
    const source = normalizePlainText(payload.source, "Unknown source");
    const summary = normalizePlainText(payload.summary).slice(0, MAX_ARTICLE_CHARS);
    const category = normalizePlainText(payload.category, "Uplifting");

    if (!languageCode) {
      jsonResponse(res, 400, {
        error: "language_code must be one of: fr, ja, de-CH, de, el.",
      });
      return;
    }

    if (!title || !summary) {
      jsonResponse(res, 400, {
        error: "Both title and summary are required.",
      });
      return;
    }

    const prompt = buildTranslationPrompt({ languageCode, source, title, summary, category });
    const ollamaResponse = await callOllama({
      model,
      prompt,
      signal: controller.signal,
      systemContent:
        "You are a careful JSON-only translator for an uplifting news app. Preserve meaning and tone. Do not add facts.",
    });

    const content = normalizeString(ollamaResponse?.message?.content);
    const parsed = extractJsonObject(content);

    if (!normalizePlainText(parsed?.title) || !normalizePlainText(parsed?.summary)) {
      throw new Error("Ollama translation response did not include both title and summary.");
    }

    const normalized = normalizeLocalizedSummary(parsed, {
      fallbackTitle: title,
      fallbackSummary: summary,
    });
    const durationMs = Date.now() - startedAt;
    const promptTokens = Number(ollamaResponse?.prompt_eval_count ?? 0) || 0;
    const completionTokens = Number(ollamaResponse?.eval_count ?? 0) || 0;

    jsonResponse(res, 200, {
      request_id: requestId,
      provider: "local",
      ai_provider: "local",
      model,
      ai_model: model,
      language_code: languageCode,
      title: normalized.title,
      summary: normalized.summary,
      summary_length: normalized.summary.length,
      translation_summary_max_chars: TRANSLATION_SUMMARY_MAX_CHARS,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      duration_ms: durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    jsonResponse(res, 500, {
      request_id: requestId,
      error: error instanceof Error ? error.message : "Unknown translation error",
      duration_ms: durationMs,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    await handleHealth(res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/stats") {
    await handleStats(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/review") {
    await handleReview(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/translate") {
    await handleTranslate(req, res);
    return;
  }

  jsonResponse(res, 404, {
    error: "Not found",
    routes: ["GET /health", "GET /stats", "POST /review", "POST /translate"],
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      message: "NutsNews local AI service started",
      port: PORT,
      ollamaUrl: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL,
      startedAt: SERVICE_STARTED_AT,
    }),
  );
});
