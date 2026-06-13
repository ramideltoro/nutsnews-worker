import { logError, logInfo, logWarn } from "./logger";

type SecretBinding = {
	get: () => Promise<string>;
};

type MaybeSecretBinding = string | SecretBinding | undefined;

type Env = {
	SUPABASE_URL: MaybeSecretBinding;
	SUPABASE_SERVICE_ROLE_KEY: MaybeSecretBinding;
	OPENAI_API_KEY: MaybeSecretBinding;

	FEED_SHARD_INDEX?: string;
	FEEDS_PER_SHARD?: string;

	BETTER_STACK_SOURCE_TOKEN?: MaybeSecretBinding;
	BETTER_STACK_INGESTING_HOST?: MaybeSecretBinding;
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

type RefreshResult = {
	message: string;
	shardIndex: number;
	feedsPerShard: number;
	maxAiReviews: number;
	feedCount: number;
	fetchedCount: number;
	candidateCount: number;
	alreadyReviewedCount: number;
	unreviewedCount: number;
	locallyRejectedCount: number;
	eligibleForAiCount: number;
	aiReviewedCount: number;
	acceptedCount: number;
	rejectedCount: number;
	reviewSaveOk: boolean;
	articleSaveOk: boolean;
	durationMs: number;
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
	"heroes",
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

async function resolveValue(value: MaybeSecretBinding) {
	if (!value) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	return value.get();
}

async function getRuntimeConfig(env: Env): Promise<RuntimeConfig> {
	const supabaseUrl = await resolveValue(env.SUPABASE_URL);
	const supabaseServiceRoleKey = await resolveValue(
		env.SUPABASE_SERVICE_ROLE_KEY,
	);
	const openAiApiKey = await resolveValue(env.OPENAI_API_KEY);

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

function clampAiReviewLimit(value: number | undefined): number {
	if (!value || Number.isNaN(value)) {
		return DEFAULT_MAX_AI_REVIEWS_PER_RUN;
	}

	return Math.max(1, Math.min(value, HARD_MAX_AI_REVIEWS_PER_RUN));
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

		await logWarn(
			env,
			"worker.feeds.load_failed",
			"Failed to load RSS feeds for shard",
			{
				shardIndex,
				feedsPerShard,
				offset,
				status: response.status,
				errorText,
			},
		);

		throw new Error(
			`Failed to load RSS feeds for shard ${shardIndex}: ${response.status} ${errorText}`,
		);
	}

	const feeds = (await response.json()) as RssFeed[];

	await logInfo(env, "worker.feeds.loaded", "Loaded RSS feeds for shard", {
		shardIndex,
		feedsPerShard,
		offset,
		feedCount: feeds.length,
		positiveFeedCount: feeds.filter((feed) => feed.is_positive_source).length,
	});

	return feeds;
}

function decodeHtml(value: string): string {
	return value
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/&#(\d+);/g, (_match, code) =>
			String.fromCharCode(Number(code)),
		)
		.replace(/&#x([a-fA-F0-9]+);/g, (_match, code) =>
			String.fromCharCode(Number.parseInt(code, 16)),
		)
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
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
		{
			length: Math.min(concurrency, items.length),
		},
		() => worker(),
	);

	await Promise.all(workers);

	return results;
}

async function fetchSingleFeed(env: Env, feed: RssFeed): Promise<RssArticle[]> {
	const startedAt = Date.now();

	try {
		const response = await fetch(feed.url, {
			headers: {
				"User-Agent": "NutsNewsBot/1.0",
			},
		});

		if (!response.ok) {
			await logWarn(env, "worker.rss.fetch_failed_status", "RSS feed fetch failed", {
				source: feed.source,
				feedUrl: feed.url,
				status: response.status,
				durationMs: Date.now() - startedAt,
			});

			return [];
		}

		const xml = await response.text();

		const articles = parseRss(xml, feed.source).filter(
			(article) => article.title && article.url,
		);

		const imageCount = articles.filter((article) => article.imageUrl).length;

		await logInfo(env, "worker.rss.feed_fetched", "RSS feed fetched", {
			source: feed.source,
			feedUrl: feed.url,
			articleCount: articles.length,
			imageCount,
			durationMs: Date.now() - startedAt,
		});

		return articles;
	} catch (error) {
		await logError(
			env,
			"worker.rss.fetch_failed_exception",
			"RSS feed fetch threw an exception",
			error,
			{
				source: feed.source,
				feedUrl: feed.url,
				durationMs: Date.now() - startedAt,
			},
		);

		return [];
	}
}

async function fetchRssArticles(
	env: Env,
	feeds: RssFeed[],
	positiveSources: Set<string>,
): Promise<RssArticle[]> {
	const feedResults = await Promise.all(
		feeds.map((feed) => fetchSingleFeed(env, feed)),
	);

	const allArticles = feedResults.flat();

	return sortArticlesForReview(uniqueArticlesByUrl(allArticles), positiveSources);
}

async function getReviewedUrls(
	env: Env,
	config: RuntimeConfig,
	urls: string[],
): Promise<Set<string>> {
	const startedAt = Date.now();

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

		await logWarn(
			env,
			"worker.supabase.review_lookup_failed",
			"Failed to load recent reviewed URLs from Supabase",
			{
				status: response.status,
				errorText,
				candidateUrlCount: urls.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return reviewedUrls;
	}

	const rows = (await response.json()) as ReviewedUrlRow[];

	for (const row of rows) {
		if (candidateUrls.has(row.original_url)) {
			reviewedUrls.add(row.original_url);
		}
	}

	await logInfo(
		env,
		"worker.supabase.review_lookup_completed",
		"Loaded recent reviewed URLs from Supabase",
		{
			lookbackCount: rows.length,
			candidateUrlCount: urls.length,
			matchedReviewedCount: reviewedUrls.size,
			durationMs: Date.now() - startedAt,
		},
	);

	return reviewedUrls;
}

function normalizeAiDecision(value: Partial<AiArticleDecision>): AiArticleDecision {
	const decision = value.decision === "accept" ? "accept" : "reject";

	return {
		decision,
		category: value.category || "Uplifting",
		positivity_score:
			typeof value.positivity_score === "number" ? value.positivity_score : 0,
		summary: value.summary || "",
		reason: value.reason || "No reason provided by OpenAI.",
	};
}

async function classifyAndSummarizeArticle(
	env: Env,
	config: RuntimeConfig,
	article: RssArticle,
): Promise<AiArticleDecision> {
	const startedAt = Date.now();

	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.openAiApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			response_format: {
				type: "json_object",
			},
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

		await logWarn(env, "worker.openai.request_failed", "OpenAI request failed", {
			status: response.status,
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			errorText,
			durationMs: Date.now() - startedAt,
		});

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
		await logWarn(
			env,
			"worker.openai.empty_response",
			"OpenAI returned empty content",
			{
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				durationMs: Date.now() - startedAt,
			},
		);

		return {
			decision: "reject",
			category: "Uplifting",
			positivity_score: 0,
			summary: "",
			reason: "OpenAI returned empty content",
		};
	}

	try {
		const parsedDecision = normalizeAiDecision(
			JSON.parse(content) as Partial<AiArticleDecision>,
		);

		await logInfo(
			env,
			"worker.openai.article_reviewed",
			"OpenAI reviewed article",
			{
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				decision: parsedDecision.decision,
				category: parsedDecision.category,
				positivityScore: parsedDecision.positivity_score,
				durationMs: Date.now() - startedAt,
			},
		);

		return parsedDecision;
	} catch (error) {
		await logError(
			env,
			"worker.openai.invalid_json",
			"OpenAI returned invalid JSON",
			error,
			{
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				rawContent: content,
				durationMs: Date.now() - startedAt,
			},
		);

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
	config: RuntimeConfig,
	reviews: ArticleReviewInsert[],
): Promise<boolean> {
	const startedAt = Date.now();

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

		await logWarn(
			env,
			"worker.supabase.review_batch_save_failed",
			"Failed to batch-save article AI reviews",
			{
				status: response.status,
				errorText,
				reviewCount: reviews.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	await logInfo(
		env,
		"worker.supabase.review_batch_saved",
		"Batch-saved article AI reviews",
		{
			reviewCount: reviews.length,
			durationMs: Date.now() - startedAt,
		},
	);

	return true;
}

async function saveAcceptedArticlesBatch(
	env: Env,
	config: RuntimeConfig,
	articles: ArticleInsert[],
): Promise<boolean> {
	const startedAt = Date.now();

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

		await logWarn(
			env,
			"worker.supabase.article_batch_save_failed",
			"Failed to batch-save accepted articles",
			{
				status: response.status,
				errorText,
				articleCount: articles.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	await logInfo(
		env,
		"worker.supabase.article_batch_saved",
		"Batch-saved accepted articles",
		{
			articleCount: articles.length,
			durationMs: Date.now() - startedAt,
		},
	);

	return true;
}

function buildRowsFromReviewedArticles(reviewedArticles: ReviewedArticleResult[]) {
	const reviewRows: ArticleReviewInsert[] = [];
	const acceptedArticleRows: ArticleInsert[] = [];

	let acceptedCount = 0;
	let rejectedCount = 0;

	for (const reviewedArticle of reviewedArticles) {
		const { article, aiDecision } = reviewedArticle;

		const normalizedDecision =
			aiDecision.decision === "accept" ? "accept" : "reject";
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
	}

	return {
		reviewRows,
		acceptedArticleRows,
		acceptedCount,
		rejectedCount,
	};
}

async function refreshArticles(
	env: Env,
	options: RefreshOptions = {},
): Promise<RefreshResult> {
	const refreshStartedAt = Date.now();
	const config = await getRuntimeConfig(env);
	const maxAiReviews = clampAiReviewLimit(options.maxAiReviews);
	const shardIndex = getShardIndex(env);
	const feedsPerShard = getFeedsPerShard(env);

	await logInfo(env, "worker.refresh.started", "NutsNews Worker refresh started", {
		shardIndex,
		feedsPerShard,
		maxAiReviews,
	});

	const shardFeeds = await getFeedsForShard(env, config);

	const positiveSources = new Set(
		shardFeeds
			.filter((feed) => feed.is_positive_source)
			.map((feed) => feed.source),
	);

	const fetchedArticles = await fetchRssArticles(env, shardFeeds, positiveSources);
	const candidateArticles = fetchedArticles.slice(0, MAX_CANDIDATES_PER_RUN);
	const candidateUrls = candidateArticles.map((article) => article.url);

	await logInfo(
		env,
		"worker.refresh.candidates_loaded",
		"RSS candidates loaded",
		{
			shardIndex,
			fetchedCount: fetchedArticles.length,
			candidateCount: candidateArticles.length,
			maxCandidatesPerRun: MAX_CANDIDATES_PER_RUN,
		},
	);

	const reviewedUrls = await getReviewedUrls(env, config, candidateUrls);

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

	await logInfo(
		env,
		"worker.refresh.filtering_completed",
		"Local filtering completed",
		{
			shardIndex,
			alreadyReviewedCount: reviewedUrls.size,
			unreviewedCount: unreviewedArticles.length,
			locallyRejectedCount: locallyRejectedArticles.length,
			eligibleForAiCount: articlesEligibleForAi.length,
			aiReviewCount: articlesForAi.length,
		},
	);

	const locallyRejectedResults = buildLocalRejectedArticles(locallyRejectedArticles);

	const aiReviewedArticles = await mapWithConcurrency(
		articlesForAi,
		AI_REVIEW_CONCURRENCY,
		async (article) => {
			const aiDecision = await classifyAndSummarizeArticle(env, config, article);

			return {
				article,
				aiDecision,
			};
		},
	);

	const reviewedArticles = [...locallyRejectedResults, ...aiReviewedArticles];

	const { reviewRows, acceptedArticleRows, acceptedCount, rejectedCount } =
		buildRowsFromReviewedArticles(reviewedArticles);

	const reviewSaveOk = await saveArticleReviewsBatch(env, config, reviewRows);
	const articleSaveOk = await saveAcceptedArticlesBatch(
		env,
		config,
		acceptedArticleRows,
	);

	const result: RefreshResult = {
		message: "NutsNews refresh complete",
		shardIndex,
		feedsPerShard,
		maxAiReviews,
		feedCount: shardFeeds.length,
		fetchedCount: fetchedArticles.length,
		candidateCount: candidateArticles.length,
		alreadyReviewedCount: reviewedUrls.size,
		unreviewedCount: unreviewedArticles.length,
		locallyRejectedCount: locallyRejectedArticles.length,
		eligibleForAiCount: articlesEligibleForAi.length,
		aiReviewedCount: aiReviewedArticles.length,
		acceptedCount,
		rejectedCount,
		reviewSaveOk,
		articleSaveOk,
		durationMs: Date.now() - refreshStartedAt,
	};

	await logInfo(
		env,
		"worker.refresh.completed",
		"NutsNews Worker refresh completed",
		result,
	);

	return result;
}

function parseManualLimit(url: URL): number | undefined {
	const limitParam = url.searchParams.get("limit");

	if (!limitParam) {
		return undefined;
	}

	const limit = Number(limitParam);

	if (Number.isNaN(limit) || limit < 1) {
		return undefined;
	}

	return Math.floor(limit);
}

function createRequestId() {
	return crypto.randomUUID();
}

export default {
	async fetch(request: Request, env: Env) {
		const requestStartedAt = Date.now();
		const requestId = createRequestId();
		const url = new URL(request.url);

		if (url.pathname === "/favicon.ico") {
			return new Response(null, {
				status: 204,
			});
		}

		if (url.pathname === "/log-test") {
			await logInfo(env, "worker.log_test.completed", "Worker Better Stack log test completed", {
				requestId,
				path: url.pathname,
				shardIndex: getShardIndex(env),
			});

			return Response.json({
				ok: true,
				message: "Worker Better Stack test log emitted.",
				searchInBetterStackFor: {
					service: "nutsnews-worker",
					event: "worker.log_test.completed",
					level: "info",
					shardIndex: getShardIndex(env),
				},
			});
		}

		if (url.pathname === "/sentry-test") {
			throw new Error("NutsNews Worker Sentry test error");
		}

		await logInfo(env, "worker.request.started", "Worker manual request started", {
			requestId,
			method: request.method,
			path: url.pathname,
			query: url.search,
			shardIndex: getShardIndex(env),
		});

		try {
			const maxAiReviews = parseManualLimit(url);

			const result = await refreshArticles(env, {
				maxAiReviews,
			});

			await logInfo(
				env,
				"worker.request.completed",
				"Worker manual request completed",
				{
					requestId,
					status: 200,
					shardIndex: getShardIndex(env),
					durationMs: Date.now() - requestStartedAt,
					result,
				},
			);

			return Response.json({
				...result,
				mode: "manual",
				requestId,
			});
		} catch (error) {
			await logError(
				env,
				"worker.request.failed",
				"Worker manual request failed",
				error,
				{
					requestId,
					status: 500,
					shardIndex: getShardIndex(env),
					durationMs: Date.now() - requestStartedAt,
				},
			);

			return Response.json(
				{
					message: "NutsNews refresh failed",
					requestId,
					error:
						error instanceof Error
							? {
								name: error.name,
								message: error.message,
							}
							: String(error),
				},
				{
					status: 500,
				},
			);
		}
	},

	async scheduled(_event: ScheduledEvent, env: Env) {
		const requestStartedAt = Date.now();
		const requestId = createRequestId();

		await logInfo(
			env,
			"worker.scheduled.started",
			"Worker scheduled refresh started",
			{
				requestId,
				shardIndex: getShardIndex(env),
			},
		);

		try {
			const result = await refreshArticles(env);

			await logInfo(
				env,
				"worker.scheduled.completed",
				"Worker scheduled refresh completed",
				{
					requestId,
					shardIndex: getShardIndex(env),
					durationMs: Date.now() - requestStartedAt,
					result,
				},
			);
		} catch (error) {
			await logError(
				env,
				"worker.scheduled.failed",
				"Worker scheduled refresh failed",
				error,
				{
					requestId,
					shardIndex: getShardIndex(env),
					durationMs: Date.now() - requestStartedAt,
				},
			);

			throw error;
		}
	},
};
