type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type RssArticle = {
  source: string;
  title: string;
  url: string;
  excerpt: string;
  publishedAt: string | null;
};

const RSS_FEEDS = [
  {
    source: "BBC",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
  },
  {
    source: "NPR",
    url: "https://feeds.npr.org/1001/rss.xml",
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
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
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

  return allArticles;
}

function isProbablyPositive(article: RssArticle): boolean {
  const text = `${article.title} ${article.excerpt}`.toLowerCase();

  const blockedWords = [
    "politics",
    "political",
    "election",
    "government",
    "president",
    "minister",
    "war",
    "military",
    "attack",
    "killed",
    "death",
    "dead",
    "crime",
    "court",
    "lawsuit",
    "market",
    "stock",
    "inflation",
    "economy",
    "money",
    "bank",
  ];

  const positiveWords = [
    "community",
    "health",
    "wellness",
    "science",
    "culture",
    "animal",
    "travel",
    "inspiring",
    "hope",
    "happy",
    "remarkable",
    "achievement",
    "discovery",
    "garden",
    "nature",
    "music",
    "art",
  ];

  const isBlocked = blockedWords.some((word) => text.includes(word));
  const isPositive = positiveWords.some((word) => text.includes(word));

  return !isBlocked && isPositive;
}

async function saveArticleToSupabase(env: Env, article: RssArticle) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/articles`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      source: article.source,
      title: article.title,
      original_url: article.url,
      image_url: null,
      published_at: article.publishedAt,
      original_excerpt: article.excerpt,
      ai_summary: article.excerpt || article.title,
      category: "Uplifting",
      positivity_score: 7,
      status: "published",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`Failed to save article: ${response.status} ${errorText}`);
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

  const articles = await fetchRssArticles();
  const filteredArticles = articles.filter(isProbablyPositive);

  let savedCount = 0;

  for (const article of filteredArticles) {
    const saved = await saveArticleToSupabase(env, article);

    if (saved) {
      savedCount += 1;
    }
  }

  return {
    fetchedCount: articles.length,
    filteredCount: filteredArticles.length,
    savedCount,
  };
}

export default {
  async fetch(_request: Request, env: Env) {
    const result = await refreshArticles(env);

    return Response.json({
      message: "HappyNews refresh complete",
      ...result,
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    console.log("HappyNews hourly refresh started");

    const result = await refreshArticles(env);

    console.log("HappyNews hourly refresh finished", result);
  },
};