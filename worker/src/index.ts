type SecretBinding = {
  get: () => Promise<string>;
};

type Env = {
  SUPABASE_URL: SecretBinding;
  SUPABASE_SERVICE_ROLE_KEY: SecretBinding;
  OPENAI_API_KEY: SecretBinding;

  FEED_SHARD_INDEX?: string;
  FEEDS_PER_SHARD?: string;
};

type RuntimeConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openAiApiKey: string;
};

type RssFeed = {
  source: string;
  url: string;
  is_positive_source: boolean;
};

type RssArticle = {
  source: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string | null;
  imageUrl: string | null;
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

type RefreshOptions = {
  maxAiReviews?: number;
};

type ReviewedArticleResult = {
  article: RssArticle;
  aiDecision: AiArticleDecision;
};

const MAX_ITEMS_PER_FEED = 35;
const MAX_CANDIDATES_PER_RUN = 300;
const DEFAULT_MAX_AI_REVIEWS_PER_RUN = 12;
const HARD_MAX_AI_REVIEWS_PER_RUN = 18;
const AI_REVIEW_CONCURRENCY = 3;
const REVIEWED_URL_LOOKBACK_LIMIT = 5000;

const POSITIVE_KEYWORDS = [
  "good news",
  "uplifting",
  "inspiring",
  "inspired",
  "kindness",
  "rescue",
  "rescued",
  "reunited",
  "reunion",
  "community",
  "volunteer",
  "volunteers",
  "donation",
  "donated",
  "helping",
  "helps",
  "hero",
  "achievement",
  "breakthrough",
  "discovery",
  "restored",
  "restoration",
  "recover",
  "recovered",
  "healing",
  "wellness",
  "healthier",
  "happiness",
  "joy",
  "celebrate",
  "celebration",
  "wins",
  "award",
  "remarkable",
  "rare",
  "beautiful",
  "travel",
  "animals",
  "wildlife",
  "conservation",
  "garden",
  "nature",
  "science",
  "space",
  "students",
  "teacher",
  "school",
  "family",
  "friendship",
  "creative",
  "art",
  "music",
  "culture",
  "environment",
  "climate solution",
  "clean energy",
  "ocean cleanup",
  "forest",
  "tree",
  "trees",
  "young people",
  "kids",
  "children",
  "happiest",
  "hope",
  "hopeful",
];

const NEGATIVE_KEYWORDS = [
  "politics",
  "election",
  "president",
  "minister",
  "government",
  "senate",
  "congress",
  "parliament",
  "war",
  "military",
  "missile",
  "attack",
  "attacks",
  "killed",
  "dead",
  "death",
  "dies",
  "murder",
  "crime",
  "criminal",
  "shooting",
  "violence",
  "violent",
  "crash",
  "disaster",
  "tragedy",
  "tragic",
  "lawsuit",
  "court",
  "trial",
  "stocks",
  "market",
  "markets",
  "inflation",
  "recession",
  "tariff",
  "economy",
  "business",
  "money",
  "bank",
  "earnings",
  "profit",
  "losses",
  "layoffs",
  "fired",
];

const STRICT_LOCAL_PREFILTER_SOURCES = new Set(["NPR", "BBC Stories"]);

const HARD_NEGATIVE_KEYWORDS = [
  "politics",
  "political",
  "election",
  "elections",
  "campaign",
  "vote",
  "voters",
  "president",
  "minister",
  "government",
  "congress",
  "senate",
  "parliament",
  "democrat",
  "republican",
  "trump",
  "biden",
  "court",
  "supreme court",
  "judge",
  "lawsuit",
  "trial",
  "charges",
  "charged",
  "convicted",
  "prison",
  "war",
  "military",
  "missile",
  "bomb",
  "attack",
  "attacks",
  "hostage",
  "killed",
  "dead",
  "death",
  "dies",
  "murder",
  "shooting",
  "gun",
  "crime",
  "criminal",
  "violence",
  "violent",
  "abuse",
  "crash",
  "disaster",
  "tragedy",
  "tragic",
  "hurricane",
  "flood",
  "wildfire",
  "earthquake",
  "stocks",
  "stock market",
  "market",
  "markets",
  "inflation",
  "recession",
  "tariff",
  "economy",
  "business",
  "money",
  "bank",
  "earnings",
  "profit",
  "losses",
  "layoffs",
  "fired",
];

const HARD_POSITIVE_ESCAPE_KEYWORDS = [
  "rescue",
  "rescued",
  "reunited",
  "reunion",
  "healing",
  "recovered",
  "recovery",
  "breakthrough",
  "discovery",
  "donation",
  "donated",
  "volunteer",
  "volunteers",
  "kindness",
  "community",
  "hero",
  "heroes",
  "saved",
  "restored",
  "restoration",
  "conservation",
  "wildlife",
  "garden",
  "school",
  "students",
  "teacher",
  "science",
  "space",
  "nasa",
  "art",
  "music",
  "creative",
  "achievement",
  "award",
  "celebrate",
  "celebration",
  "hope",
  "hopeful",
];

const LOCAL_PREFILTER_REJECT_DECISION: AiArticleDecision = {
  decision: "reject",
  category: "Uplifting",
  positivity_score: 0,
  summary: "",
  reason: "Skipped before AI because the article matched hard negative local filters.",
};

async function getRuntimeConfig(env: Env): Promise<RuntimeConfig> {
  const supabaseUrl = await env.SUPABASE_URL.get();
  const supabaseServiceRoleKey = await env.SUPABASE_SERVICE_ROLE_KEY.get();
  const openAiApiKey = await env.OPENAI_API_KEY.get();

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL secret.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY secret.");
  }

  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY secret.");
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    openAiApiKey,
  };
}

function getShardIndex(env: Env): number {
  const shardIndex = Number(env.FEED_SHARD_INDEX ?? "0");

  if (Number.isNaN(shardIndex) || shardIndex < 0) {
    return 0;
  }

  return Math.floor(shardIndex);
}

function getFeedsPerShard(env: Env): number {
  const feedsPerShard = Number(env.FEEDS_PER_SHARD ?? "20");

  if (Number.isNaN(feedsPerShard) || feedsPerShard < 1) {
    return 20;
  }

  return Math.floor(feedsPerShard);
}

async function getFeedsForShard(
  env: Env,
  config: RuntimeConfig,
): Promise<RssFeed[]> {
  const shardIndex = getShardIndex(env);
  const feedsPerShard = getFeedsPerShard(env);
  const offset = shardIndex * feedsPerShard;

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/rss_feeds?select=source,url,is_positive_source&is_active=eq.true&order=id.asc&limit=${feedsPerShard}&offset=${offset}`,
    {
      method: "GET",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to load RSS feeds for shard ${shardIndex}: ${response.status} ${errorText}`,
    );
  }

  return (await response.json()) as RssFeed[];
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_match, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(itemXml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = itemXml.match(regex);

  if (!match?.[1]) {
    return "";
  }

  return decodeHtml(match[1].trim());
}

function getAttributeValue(tagXml: string, attributeName: string): string {
  const regex = new RegExp(`${attributeName}=["']([^"']+)["']`, "i");
  const match = tagXml.match(regex);

  if (!match?.[1]) {
    return "";
  }

  return decodeHtml(match[1].trim());
}

function getAtomLink(itemXml: string): string {
  const hrefMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);

  if (!hrefMatch?.[1]) {
    return "";
  }

  return decodeHtml(hrefMatch[1].trim());
}

function normalizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url.trim());

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
    ].forEach((param) => parsedUrl.searchParams.delete(param));

    parsedUrl.hash = "";

    return parsedUrl.toString();
  } catch {
    return url.trim();
  }
}

function normalizeImageUrl(imageUrl: string, articleUrl: string): string | null {
  const cleanedImageUrl = decodeHtml(imageUrl).trim();

  if (
    !cleanedImageUrl ||
    cleanedImageUrl.startsWith("data:") ||
    cleanedImageUrl.startsWith("blob:") ||
    cleanedImageUrl.startsWith("javascript:")
  ) {
    return null;
  }

  try {
    const absoluteImageUrl = new URL(cleanedImageUrl, articleUrl);
    const protocol = absoluteImageUrl.protocol.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }

    absoluteImageUrl.hash = "";

    return absoluteImageUrl.toString();
  } catch {
    return null;
  }
}

function isLikelyImageUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  return (
    lowerUrl.includes(".jpg") ||
    lowerUrl.includes(".jpeg") ||
    lowerUrl.includes(".png") ||
    lowerUrl.includes(".webp") ||
    lowerUrl.includes(".gif") ||
    lowerUrl.includes("image") ||
    lowerUrl.includes("thumbnail") ||
    lowerUrl.includes("media")
  );
}

function isBadImageCandidate(imageUrl: string): boolean {
  const lowerUrl = imageUrl.toLowerCase();

  return (
    lowerUrl.includes("logo") ||
    lowerUrl.includes("icon") ||
    lowerUrl.includes("sprite") ||
    lowerUrl.includes("avatar") ||
    lowerUrl.includes("placeholder") ||
    lowerUrl.includes("blank") ||
    lowerUrl.includes("transparent") ||
    lowerUrl.includes("tracking") ||
    lowerUrl.includes("pixel") ||
    lowerUrl.includes("1x1") ||
    lowerUrl.endsWith(".svg")
  );
}

function extractImageFromHtml(html: string, articleUrl: string): string | null {
  const imageMatch =
    html.match(/<img[^>]+srcset=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<img[^>]+data-src=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<img[^>]+data-lazy-src=["']([^"']+)["'][^>]*>/i);

  if (!imageMatch?.[1]) {
    return null;
  }

  const rawImageValue = imageMatch[1].split(",")[0]?.trim().split(/\s+/)[0];

  if (!rawImageValue) {
    return null;
  }

  const normalizedUrl = normalizeImageUrl(rawImageValue, articleUrl);

  if (!normalizedUrl || isBadImageCandidate(normalizedUrl)) {
    return null;
  }

  return normalizedUrl;
}

function extractRssImageUrl(itemXml: string, articleUrl: string): string | null {
  const mediaContentTags = itemXml.match(/<media:content[^>]*>/gi) ?? [];

  for (const tag of mediaContentTags) {
    const medium = getAttributeValue(tag, "medium").toLowerCase();
    const type = getAttributeValue(tag, "type").toLowerCase();
    const url = getAttributeValue(tag, "url");

    if (
      url &&
      (medium === "image" || type.startsWith("image/") || isLikelyImageUrl(url))
    ) {
      const normalizedUrl = normalizeImageUrl(url, articleUrl);

      if (normalizedUrl && !isBadImageCandidate(normalizedUrl)) {
        return normalizedUrl;
      }
    }
  }

  const mediaThumbnailTags = itemXml.match(/<media:thumbnail[^>]*>/gi) ?? [];

  for (const tag of mediaThumbnailTags) {
    const url = getAttributeValue(tag, "url");
    const normalizedUrl = normalizeImageUrl(url, articleUrl);

    if (normalizedUrl && !isBadImageCandidate(normalizedUrl)) {
      return normalizedUrl;
    }
  }

  const enclosureTags = itemXml.match(/<enclosure[^>]*>/gi) ?? [];

  for (const tag of enclosureTags) {
    const type = getAttributeValue(tag, "type").toLowerCase();
    const url = getAttributeValue(tag, "url");

    if (url && (type.startsWith("image/") || isLikelyImageUrl(url))) {
      const normalizedUrl = normalizeImageUrl(url, articleUrl);

      if (normalizedUrl && !isBadImageCandidate(normalizedUrl)) {
        return normalizedUrl;
      }
    }
  }

  const itunesImageTags = itemXml.match(/<itunes:image[^>]*>/gi) ?? [];

  for (const tag of itunesImageTags) {
    const href = getAttributeValue(tag, "href");
    const normalizedUrl = normalizeImageUrl(href, articleUrl);

    if (normalizedUrl && !isBadImageCandidate(normalizedUrl)) {
      return normalizedUrl;
    }
  }

  const description =
    getTagValue(itemXml, "description") ||
    getTagValue(itemXml, "summary") ||
    getTagValue(itemXml, "content:encoded") ||
    getTagValue(itemXml, "content");

  return extractImageFromHtml(description, articleUrl);
}

function parsePublishedDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function parseRss(xml: string, source: string): RssArticle[] {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const matches = itemMatches.length > 0 ? itemMatches : entryMatches;

  return matches.slice(0, MAX_ITEMS_PER_FEED).map((itemXml) => {
    const title = stripHtml(getTagValue(itemXml, "title"));
    const rssLink = getTagValue(itemXml, "link");
    const atomLink = getAtomLink(itemXml);
    const url = normalizeUrl(rssLink || atomLink);

    const description =
      getTagValue(itemXml, "description") ||
      getTagValue(itemXml, "summary") ||
      getTagValue(itemXml, "content:encoded") ||
      getTagValue(itemXml, "content");

    const pubDate =
      getTagValue(itemXml, "pubDate") ||
      getTagValue(itemXml, "published") ||
      getTagValue(itemXml, "updated");

    return {
      source,
      title,
      url,
      excerpt: stripHtml(description),
      publishedAt: parsePublishedDate(pubDate),
      imageUrl: extractRssImageUrl(itemXml, url),
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

function scoreArticleCandidate(
  article: RssArticle,
  positiveSources: Set<string>,
): number {
  const text = `${article.source} ${article.title} ${article.excerpt}`.toLowerCase();
  let score = 0;

  if (positiveSources.has(article.source)) {
    score += 24;
  }

  for (const keyword of POSITIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 3;
    }
  }

  for (const keyword of NEGATIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score -= 7;
    }
  }

  if (article.excerpt.length >= 80) {
    score += 2;
  }

  if (article.imageUrl) {
    score += 1;
  }

  if (article.publishedAt) {
    const ageInHours =
      (Date.now() - new Date(article.publishedAt).getTime()) / 1000 / 60 / 60;

    if (ageInHours <= 24) {
      score += 6;
    } else if (ageInHours <= 72) {
      score += 3;
    } else if (ageInHours <= 168) {
      score += 1;
    }
  }

  return score;
}

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => {
    return text.includes(keyword) ? count + 1 : count;
  }, 0);
}

function shouldSkipBeforeAi(
  article: RssArticle,
  positiveSources: Set<string>,
): boolean {
  const text = `${article.source} ${article.title} ${article.excerpt}`.toLowerCase();

  const hardNegativeMatchCount = countKeywordMatches(
    text,
    HARD_NEGATIVE_KEYWORDS,
  );

  if (hardNegativeMatchCount === 0) {
    return false;
  }

  const positiveEscapeMatchCount = countKeywordMatches(
    text,
    HARD_POSITIVE_ESCAPE_KEYWORDS,
  );

  if (positiveSources.has(article.source)) {
    return hardNegativeMatchCount >= 3 && positiveEscapeMatchCount === 0;
  }

  if (STRICT_LOCAL_PREFILTER_SOURCES.has(article.source)) {
    return hardNegativeMatchCount >= 1 && positiveEscapeMatchCount === 0;
  }

  return hardNegativeMatchCount >= 2 && positiveEscapeMatchCount === 0;
}

function buildLocalRejectedArticles(
  articles: RssArticle[],
): ReviewedArticleResult[] {
  return articles.map((article) => ({
    article,
    aiDecision: {
      ...LOCAL_PREFILTER_REJECT_DECISION,
      reason: `Skipped before AI from ${article.source}: obvious negative topic detected in title or excerpt.`,
    },
  }));
}

function sortArticlesForReview(
  articles: RssArticle[],
  positiveSources: Set<string>,
): RssArticle[] {
  return [...articles].sort((a, b) => {
    const scoreDifference =
      scoreArticleCandidate(b, positiveSources) -
      scoreArticleCandidate(a, positiveSources);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

    return bTime - aTime;
  });
}

function clampAiReviewLimit(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_MAX_AI_REVIEWS_PER_RUN;
  }

  return Math.max(1, Math.min(value, HARD_MAX_AI_REVIEWS_PER_RUN));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);

  return results;
}

async function fetchSingleFeed(feed: {
  source: string;
  url: string;
}): Promise<RssArticle[]> {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "NutsNewsBot/1.0",
      },
    });

    if (!response.ok) {
      console.log(`Failed to fetch ${feed.source}: ${response.status}`);
      return [];
    }

    const xml = await response.text();

    const articles = parseRss(xml, feed.source).filter(
      (article) => article.title && article.url,
    );

    const imageCount = articles.filter((article) => article.imageUrl).length;

    console.log(
      `Fetched ${articles.length} articles from ${feed.source}. RSS images found: ${imageCount}`,
    );

    return articles;
  } catch (error) {
    console.log(`Failed to fetch ${feed.source}`, error);
    return [];
  }
}

async function fetchRssArticles(
  feeds: RssFeed[],
  positiveSources: Set<string>,
): Promise<RssArticle[]> {
  const feedResults = await Promise.all(
    feeds.map((feed) => fetchSingleFeed(feed)),
  );

  const allArticles = feedResults.flat();

  return sortArticlesForReview(uniqueArticlesByUrl(allArticles), positiveSources);
}

async function getReviewedUrls(
  config: RuntimeConfig,
  urls: string[],
): Promise<Set<string>> {
  if (urls.length === 0) {
    return new Set();
  }

  const candidateUrls = new Set(urls);
  const reviewedUrls = new Set<string>();

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/article_ai_reviews?select=original_url&order=reviewed_at.desc&limit=${REVIEWED_URL_LOOKBACK_LIMIT}`,
    {
      method: "GET",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.log(
      `Failed to load recent reviewed URLs: ${response.status} ${errorText}`,
    );

    return reviewedUrls;
  }

  const rows = (await response.json()) as ReviewedUrlRow[];

  for (const row of rows) {
    if (candidateUrls.has(row.original_url)) {
      reviewedUrls.add(row.original_url);
    }
  }

  console.log(
    `Loaded ${rows.length} recent AI review URLs. Matched ${reviewedUrls.size} current candidates.`,
  );

  return reviewedUrls;
}

async function classifyAndSummarizeArticle(
  config: RuntimeConfig,
  article: RssArticle,
): Promise<AiArticleDecision> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are filtering articles for NutsNews, a peaceful uplifting news feed. Reject politics, war, money, crime, tragedy, fear, conflict, elections, government, markets, inflation, business, stocks, military, and violence. Accept positive, uplifting, inspiring, human-interest, wellness, lifestyle, science, culture, animals, travel, community, nature, space, creativity, and remarkable achievement stories. Be selective, but do not reject a clearly positive article just because it comes from a broad news source. Return only valid JSON.",
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
  "category": "Community | Wellness | Science | Culture | Animals | Travel | Lifestyle | Achievement | Uplifting | Nature | Space | Creativity",
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
  config: RuntimeConfig,
  reviews: ArticleReviewInsert[],
): Promise<boolean> {
  if (reviews.length === 0) {
    return true;
  }

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/article_ai_reviews?on_conflict=original_url`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
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
  config: RuntimeConfig,
  articles: ArticleInsert[],
): Promise<boolean> {
  if (articles.length === 0) {
    return true;
  }

  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/articles?on_conflict=original_url`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseServiceRoleKey,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(articles),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.log(
      `Failed to batch-save accepted articles: ${response.status} ${errorText}`,
    );

    return false;
  }

  return true;
}

function buildRowsFromReviewedArticles(reviewedArticles: ReviewedArticleResult[]) {
  const reviewRows: ArticleReviewInsert[] = [];
  const acceptedArticleRows: ArticleInsert[] = [];
  let acceptedCount = 0;
  let rejectedCount = 0;

  for (const reviewedArticle of reviewedArticles) {
    const { article, aiDecision } = reviewedArticle;
    const normalizedDecision = aiDecision.decision === "accept" ? "accept" : "reject";
    const normalizedCategory = aiDecision.category || "Uplifting";
    const normalizedScore = aiDecision.positivity_score ?? 0;
    const normalizedSummary = aiDecision.summary || article.excerpt || article.title;
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
      console.log(`Rejected: ${article.title} — ${normalizedReason}`);
      continue;
    }

    acceptedCount += 1;

    acceptedArticleRows.push({
      source: article.source,
      title: article.title,
      original_url: article.url,
      image_url: article.imageUrl,
      published_at: article.publishedAt,
      published_on_site_at: new Date().toISOString(),
      original_excerpt: article.excerpt,
      ai_summary: normalizedSummary,
      category: normalizedCategory,
      positivity_score: normalizedScore || 7,
      status: "published",
    });

    console.log(
      `Accepted: ${article.title} | Category: ${normalizedCategory} | Score: ${normalizedScore} | Image: ${
        article.imageUrl ? "yes" : "none"
      }`,
    );
  }

  return {
    reviewRows,
    acceptedArticleRows,
    acceptedCount,
    rejectedCount,
  };
}

async function refreshArticles(env: Env, options: RefreshOptions = {}) {
  const config = await getRuntimeConfig(env);
  const maxAiReviews = clampAiReviewLimit(options.maxAiReviews);
  const shardIndex = getShardIndex(env);
  const feedsPerShard = getFeedsPerShard(env);
  const shardFeeds = await getFeedsForShard(env, config);

  const positiveSources = new Set(
    shardFeeds
      .filter((feed) => feed.is_positive_source)
      .map((feed) => feed.source),
  );

  console.log(
    `Worker shard ${shardIndex} loaded ${shardFeeds.length} RSS feeds. Feeds per shard: ${feedsPerShard}.`,
  );

  const fetchedArticles = await fetchRssArticles(shardFeeds, positiveSources);
  const candidateArticles = fetchedArticles.slice(0, MAX_CANDIDATES_PER_RUN);
  const candidateUrls = candidateArticles.map((article) => article.url);

  console.log(
    `Fetched ${fetchedArticles.length} unique RSS articles. Checking ${candidateArticles.length} sorted candidates this run.`,
  );

  const reviewedUrls = await getReviewedUrls(config, candidateUrls);

  const unreviewedArticles = candidateArticles.filter(
    (article) => !reviewedUrls.has(article.url),
  );

  const localFilterResults = unreviewedArticles.map((article) => ({
    article,
    shouldSkip: shouldSkipBeforeAi(article, positiveSources),
  }));

  const locallyRejectedArticles = localFilterResults
    .filter((result) => result.shouldSkip)
    .map((result) => result.article);

  const articlesEligibleForAi = localFilterResults
    .filter((result) => !result.shouldSkip)
    .map((result) => result.article);

  const articlesForAi = articlesEligibleForAi.slice(0, maxAiReviews);

  console.log(
    `Already reviewed: ${reviewedUrls.size}. Unreviewed candidates: ${unreviewedArticles.length}. Locally rejected before AI: ${locallyRejectedArticles.length}. Eligible for AI after local filter: ${articlesEligibleForAi.length}. Sending ${articlesForAi.length} articles to AI with concurrency ${AI_REVIEW_CONCURRENCY}.`,
  );

  const locallyReviewedArticles = buildLocalRejectedArticles(
    locallyRejectedArticles,
  );

  const aiReviewedArticles = await mapWithConcurrency(
    articlesForAi,
    AI_REVIEW_CONCURRENCY,
    async (article) => ({
      article,
      aiDecision: await classifyAndSummarizeArticle(config, article),
    }),
  );

  const reviewedArticles = [...locallyReviewedArticles, ...aiReviewedArticles];

  const { reviewRows, acceptedArticleRows, acceptedCount, rejectedCount } =
    buildRowsFromReviewedArticles(reviewedArticles);

  console.log(
    `Review complete. Reviews to save: ${reviewRows.length}. Accepted articles to save: ${acceptedArticleRows.length}.`,
  );

  const [reviewsSaved, articlesSaved] = await Promise.all([
    saveArticleReviewsBatch(config, reviewRows),
    saveAcceptedArticlesBatch(config, acceptedArticleRows),
  ]);

  if (reviewsSaved) {
    console.log(`Saved ${reviewRows.length} AI review records.`);
  }

  if (articlesSaved) {
    console.log(`Saved ${acceptedArticleRows.length} accepted article records.`);
  }

  return {
    fetchedCount: fetchedArticles.length,
    candidateCount: candidateArticles.length,
    alreadyReviewedCount: reviewedUrls.size,
    unreviewedCandidateCount: unreviewedArticles.length,
    locallyRejectedBeforeAiCount: locallyRejectedArticles.length,
    eligibleForAiCount: articlesEligibleForAi.length,
    aiReviewedCount: articlesForAi.length,
    acceptedCount,
    rejectedCount,
    reviewRowsQueued: reviewRows.length,
    articleRowsQueued: acceptedArticleRows.length,
    reviewsSaved,
    articlesSaved,
    feedCount: shardFeeds.length,
    feedShardIndex: shardIndex,
    feedsPerShard,
    aiReviewConcurrency: AI_REVIEW_CONCURRENCY,
    maxAiReviews,
    subrequestPlan:
      "Free-plan safe target: sharded RSS feeds + duplicate checks + local negative prefilter + limited OpenAI calls + Supabase batch saves",
  };
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    const limitParam = url.searchParams.get("limit");
    const requestedLimit = limitParam ? Number(limitParam) : undefined;

    const result = await refreshArticles(env, {
      maxAiReviews: requestedLimit,
    });

    return Response.json({
      message: "NutsNews refresh complete",
      ...result,
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    console.log("NutsNews scheduled shard refresh started");

    const result = await refreshArticles(env);

    console.log("NutsNews scheduled shard refresh finished", result);
  },
};