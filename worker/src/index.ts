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
	  published_on_site_at: new Date().toISOString(),
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

  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Check worker/.dev.vars");
  }

  const articles = await fetchRssArticles();

  let acceptedCount = 0;
  let savedCount = 0;

  for (const article of articles) {
    const aiDecision = await classifyAndSummarizeArticle(env, article);

    if (aiDecision.decision !== "accept") {
      console.log(`Rejected: ${article.title} — ${aiDecision.reason}`);
      continue;
    }

    acceptedCount += 1;

    const saved = await saveArticleToSupabase(env, {
      ...article,
      excerpt: aiDecision.summary,
    });

    if (saved) {
      savedCount += 1;
    }
  }

  return {
    fetchedCount: articles.length,
    acceptedCount,
    savedCount,
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