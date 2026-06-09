type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY: string;
};

type RssArticle = {
  source: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string | null;
};

type AiArticleDecision = {
  decision: "accept" | "reject";
  category: string;
  positivity_score: number;
  summary: string;
  reason: string;
};

type ReviewedUrlRow = {
  original_url: string;
};

type ArticleReviewInsert = {
  original_url: string;
  source: string;
  title: string;
  decision: "accept" | "reject";
  category: string;
  positivity_score: number;
  summary: string;
  reason: string;
  reviewed_at: string;
};

type ArticleInsert = {
  source: string;
  title: string;
  original_url: string;
  image_url: string | null;
  published_at: string | null;
  published_on_site_at: string;
  original_excerpt: string;
  ai_summary: string;
  category: string;
  positivity_score: number;
  status: "published";
};

const MAX_CANDIDATES_PER_RUN = 40;
const MAX_AI_REVIEWS_PER_RUN = 20;

const RSS_FEEDS = [
  {
    source: "BBC",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
  },
  {
    source: "NPR",
    url: "https://feeds.npr.org/1001/rss.xml",
  },
  {
    source: "NASA",
    url: "https://www.nasa.gov/news-release/feed/",
  },
  {
    source: "ScienceDaily",
    url: "https://www.sciencedaily.com/rss/top.xml",
  },
  {
    source: "Good News Network",
    url: "https://www.goodnewsnetwork.org/feed/",
  },
  {
    source: "Positive News",
    url: "https://www.positive.news/feed/",
  },
];

function getTagValue(itemXml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = itemXml.match(regex);

  if (!match?.[1]) {
    return "";
  }

  return decodeHtml(match[1].trim());
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseRss(xml: string, source: string): RssArticle[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches.slice(0, 20).map((itemXml) => {
    const title = getTagValue(itemXml, "title");
    const link = getTagValue(itemXml, "link");
    const description = getTagValue(itemXml, "description");
    const pubDate = getTagValue(itemXml, "pubDate");

    return {
      source,
      title,
      url: link,
      excerpt: description.replace(/<[^>]*>/g, ""),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
    };
  });
}

function uniqueArticlesByUrl(articles: RssArticle[]): RssArticle[] {
  const seenUrls = new Set<string>();

  return articles.filter((article) => {
    if (!article.url || seenUrls.has(article.url)) {
      return false;
    }

    seenUrls.add(article.url);
    return true;
  });
}

function buildPostgrestInFilter(values: string[]): string {
  const quotedValues = values.map((value) => {
    const escapedValue = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escapedValue}"`;
  });

  return `in.(${quotedValues.join(",")})`;
}

async function fetchRssArticles(): Promise<RssArticle[]> {
  const allArticles: RssArticle[] = [];

  for (const feed of RSS_FEEDS) {
    const response = await fetch(feed.url);

    if (!response.ok) {
      console.log(`Failed to fetch ${feed.source}: ${response.status}`);
      continue;
    }

    const xml = await response.text();
    const articles = parseRss(xml, feed.source);

    allArticles.push(...articles);
  }

  return uniqueArticlesByUrl(allArticles);
}

async function getReviewedUrls(env: Env, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) {
    return new Set();
  }

  const inFilter = buildPostgrestInFilter(urls);

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/article_ai_reviews?select=original_url&original_url=${encodeURIComponent(
      inFilter,
    )}`,
    {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`Failed to batch-check reviewed URLs: ${response.status} ${errorText}`);

    // Fail open so the refresh can continue.
    // Duplicate protection still exists through unique constraints.
    return new Set();
  }

  const rows = (await response.json()) as ReviewedUrlRow[];

  return new Set(rows.map((row) => row.original_url));
}

async function classifyAndSummarizeArticle(
  env: Env,
  article: RssArticle,
): Promise<AiArticleDecision> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are filtering articles for NutsNews, a peaceful uplifting news feed. Reject politics, war, money, crime, tragedy, fear, conflict, elections, government, markets, inflation, business, stocks, military, and violence. Accept only positive, uplifting, inspiring, human-interest, wellness, lifestyle, science, culture, animals, travel, community, and remarkable achievement stories. Return only valid JSON.",
        },
        {
          role: "user",
          content: `
Article:
Source: ${article.source}
Title: ${article.title}
Excerpt: ${article.excerpt}

Return JSON exactly like this:
{
  "decision": "accept" or "reject",
  "category": "Community | Wellness | Science | Culture | Animals | Travel | Lifestyle | Achievement | Uplifting",
  "positivity_score": number from 1 to 10,
  "summary": "A cheerful, calm 2-3 sentence summary. Do not add facts. Do not copy the article.",
  "reason": "Short reason for the decision"
}
`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`OpenAI error: ${response.status} ${errorText}`);

    return {
      decision: "reject",
      category: "Uplifting",
      positivity_score: 0,
      summary: "",
      reason: "OpenAI request failed",
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return {
      decision: "reject",
      category: "Uplifting",
      positivity_score: 0,
      summary: "",
      reason: "OpenAI returned empty content",
    };
  }

  try {
    return JSON.parse(content) as AiArticleDecision;
  } catch {
    return {
      decision: "reject",
      category: "Uplifting",
      positivity_score: 0,
      summary: "",
      reason: "OpenAI returned invalid JSON",
    };
  }
}

async function saveArticleReviewsBatch(
  env: Env,
  reviews: ArticleReviewInsert[],
): Promise<boolean> {
  if (reviews.length === 0) {
    return true;
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/article_ai_reviews?on_conflict=original_url`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(reviews),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`Failed to batch-save AI reviews: ${response.status} ${errorText}`);
    return false;
  }

  return true;
}

async function saveAcceptedArticlesBatch(
  env: Env,
  articles: ArticleInsert[],
): Promise<boolean> {
  if (articles.length === 0) {
    return true;
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/articles?on_conflict=original_url`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(articles),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`Failed to batch-save accepted articles: ${response.status} ${errorText}`);
    return false;
  }

  return true;
}

async function refreshArticles(env: Env) {
  if (!env.SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL. Check worker/.dev.vars");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Check worker/.dev.vars");
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Check worker/.dev.vars");
  }

  const fetchedArticles = await fetchRssArticles();
  const candidateArticles = fetchedArticles.slice(0, MAX_CANDIDATES_PER_RUN);
  const candidateUrls = candidateArticles.map((article) => article.url);

  console.log(
    `Fetched ${fetchedArticles.length} unique RSS articles. Checking ${candidateArticles.length} candidates this run.`,
  );

  const reviewedUrls = await getReviewedUrls(env, candidateUrls);

  const newArticles = candidateArticles
    .filter((article) => !reviewedUrls.has(article.url))
    .slice(0, MAX_AI_REVIEWS_PER_RUN);

  console.log(
    `Skipped ${candidateArticles.length - newArticles.length} already-reviewed or over-limit articles. Sending ${newArticles.length} articles to AI.`,
  );

  const reviewRows: ArticleReviewInsert[] = [];
  const acceptedArticleRows: ArticleInsert[] = [];

  let acceptedCount = 0;
  let rejectedCount = 0;

  for (const article of newArticles) {
    const aiDecision = await classifyAndSummarizeArticle(env, article);

    const normalizedDecision =
      aiDecision.decision === "accept" ? "accept" : "reject";

    const normalizedCategory = aiDecision.category || "Uplifting";
    const normalizedScore = aiDecision.positivity_score ?? 0;
    const normalizedSummary =
      aiDecision.summary || article.excerpt || article.title;
    const normalizedReason = aiDecision.reason || "No reason provided";

    reviewRows.push({
      original_url: article.url,
      source: article.source,
      title: article.title,
      decision: normalizedDecision,
      category: normalizedCategory,
      positivity_score: normalizedScore,
      summary: normalizedSummary,
      reason: normalizedReason,
      reviewed_at: new Date().toISOString(),
    });

    if (normalizedDecision === "reject") {
      rejectedCount += 1;
      console.log(`Rejected and queued for review save: ${article.title} — ${normalizedReason}`);
      continue;
    }

    acceptedCount += 1;

    acceptedArticleRows.push({
      source: article.source,
      title: article.title,
      original_url: article.url,
      image_url: null,
      published_at: article.publishedAt,
      published_on_site_at: new Date().toISOString(),
      original_excerpt: article.excerpt,
      ai_summary: normalizedSummary,
      category: normalizedCategory,
      positivity_score: normalizedScore || 7,
      status: "published",
    });

    console.log(
      `Accepted and queued for article save: ${article.title} | Category: ${normalizedCategory} | Score: ${normalizedScore}`,
    );
  }

  const reviewsSaved = await saveArticleReviewsBatch(env, reviewRows);
  const articlesSaved = await saveAcceptedArticlesBatch(env, acceptedArticleRows);

  if (reviewsSaved) {
    console.log(`Batch-saved ${reviewRows.length} AI review records.`);
  }

  if (articlesSaved) {
    console.log(`Batch-saved ${acceptedArticleRows.length} accepted articles.`);
  }

  return {
    fetchedCount: fetchedArticles.length,
    candidateCount: candidateArticles.length,
    alreadyReviewedCount: candidateArticles.length - newArticles.length,
    aiReviewedCount: newArticles.length,
    acceptedCount,
    rejectedCount,
    reviewRowsQueued: reviewRows.length,
    articleRowsQueued: acceptedArticleRows.length,
    reviewsSaved,
    articlesSaved,
  };
}

export default {
  async fetch(_request: Request, env: Env) {
    const result = await refreshArticles(env);

    return Response.json({
      message: "NutsNews refresh complete",
      ...result,
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    console.log("NutsNews hourly refresh started");

    const result = await refreshArticles(env);

    console.log("NutsNews hourly refresh finished", result);
  },
};