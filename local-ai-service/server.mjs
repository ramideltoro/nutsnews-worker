import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? "8788");
const LOCAL_AI_API_KEY = process.env.LOCAL_AI_API_KEY ?? "";
const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? "120000");
const MAX_ARTICLE_CHARS = Number(process.env.MAX_ARTICLE_CHARS ?? "6000");
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
  return `You are the NutsNews local AI reviewer.\n\nNutsNews accepts stories that are positive, uplifting, inspiring, useful, community-focused, wellness-focused, science-focused, animal-focused, travel-focused, culture-focused, or achievement-focused.\n\nNutsNews rejects politics, war, crime, tragedy, outrage, fear, finance/stock-market content, clickbait celebrity gossip, and stories that are mostly negative even if they contain one positive angle.\n\nReturn strict JSON only using exactly these keys:\n{\n  "decision": "accept" or "reject",\n  "category": "one short category label",\n  "positivity_score": integer from 0 to 10,\n  "summary": "one or two warm, concise sentences for accepted stories; empty string for rejected stories",\n  "reason": "short reason for the decision"\n}\n\nArticle source: ${source}\nArticle title: ${title}\nArticle URL: ${url}\nArticle text:\n${excerpt}`;
}

async function callOllama({ model, prompt, signal }) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 450,
      },
      messages: [
        {
          role: "system",
          content:
            "You are a careful JSON-only classifier and summarizer for an uplifting news app.",
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

async function handleHealth(res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    const body = response.ok ? await response.json() : null;
    const models = Array.isArray(body?.models)
      ? body.models.map((model) => model.name).slice(0, 20)
      : [];

    jsonResponse(res, response.ok ? 200 : 503, {
      ok: response.ok,
      service: "nutsnews-local-ai-service",
      startedAt: SERVICE_STARTED_AT,
      timestamp: new Date().toISOString(),
      ollamaUrl: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL,
      availableModels: models,
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

async function handleReview(req, res) {
  if (!LOCAL_AI_API_KEY) {
    jsonResponse(res, 500, {
      error: "LOCAL_AI_API_KEY is not configured on the local AI service.",
    });
    return;
  }

  const providedKey = req.headers["x-nutsnews-ai-key"];
  if (providedKey !== LOCAL_AI_API_KEY) {
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

    jsonResponse(res, 200, {
      request_id: requestId,
      provider: "local",
      ai_provider: "local",
      model,
      ai_model: model,
      decision,
      category: normalizeString(parsed.category, decision === "accept" ? "Uplifting" : "Rejected") || "Uplifting",
      positivity_score: positivityScore,
      summary: decision === "accept" ? normalizeString(parsed.summary) : "",
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    await handleHealth(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/review") {
    await handleReview(req, res);
    return;
  }

  jsonResponse(res, 404, {
    error: "Not found",
    routes: ["GET /health", "POST /review"],
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
