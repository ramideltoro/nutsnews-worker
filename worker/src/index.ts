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
	OPENAI_INPUT_COST_PER_1M_TOKENS?: string;
	OPENAI_OUTPUT_COST_PER_1M_TOKENS?: string;
	AI_COST_ALERT_RUN_USD?: string;
	AI_REVIEW_ALERT_RUN_LIMIT?: string;
	AI_TOKEN_ALERT_RUN_LIMIT?: string;
};

type RuntimeConfig = {
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	openAiApiKey: string;
	openAiInputCostPer1MTokens: number;
	openAiOutputCostPer1MTokens: number;
	aiCostAlertRunUsd: number;
	aiReviewAlertRunLimit: number;
	aiTokenAlertRunLimit: number;
};

type WorkerRunSaveConfig = {
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
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

type FeedFetchResult = {
	feed: RssFeed;
	articles: RssArticle[];
	ok: boolean;
	status: number | null;
	errorMessage: string | null;
	durationMs: number;
};

type RssFetchResult = {
	articles: RssArticle[];
	feedFetchSuccessCount: number;
	feedFetchFailureCount: number;
	failedFeeds: Array<{
		source: string;
		url: string;
		status: number | null;
		errorMessage: string | null;
	}>;
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
	image_url: string;
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
	runSource?: "manual" | "scheduled" | "unknown";
	requestId?: string;
};

type OpenAiUsage = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};

type AiClassificationResult = {
	aiDecision: AiArticleDecision;
	usage: OpenAiUsage;
	estimatedCostUsd: number;
	openAiModel: string;
};

type ReviewedArticleResult = {
	article: RssArticle;
	aiDecision: AiArticleDecision;
	usage?: OpenAiUsage;
	estimatedCostUsd?: number;
	openAiModel?: string;
	reviewSource?: "openai" | "local";
};

type ImageHydrationResult = {
	articles: RssArticle[];
	lookupCount: number;
	foundCount: number;
};

type AiUsageRunInsert = {
	run_started_at: string;
	run_completed_at: string;
	run_source: "manual" | "scheduled" | "unknown";
	request_id: string | null;
	shard_index: number;
	feeds_per_shard: number;
	max_ai_reviews: number;
	feed_count: number;
	fetched_count: number;
	candidate_count: number;
	already_reviewed_count: number;
	unreviewed_count: number;
	eligible_for_ai_count: number;
	ai_reviewed_count: number;
	openai_model: string;
	openai_call_count: number;
	openai_prompt_tokens: number;
	openai_completion_tokens: number;
	openai_total_tokens: number;
	estimated_openai_cost_usd: number;
	openai_accepted_count: number;
	openai_rejected_count: number;
	published_accepted_count: number;
	total_rejected_count: number;
	no_thumbnail_rejected_count: number;
	locally_rejected_count: number;
	image_hydration_lookup_count: number;
	image_hydration_found_count: number;
	cost_protection_limit_reached: boolean;
	spike_warning_triggered: boolean;
	review_save_ok: boolean;
	article_save_ok: boolean;
	duration_ms: number;
};

type WorkerRunInsert = {
	run_started_at: string;
	run_completed_at: string;
	run_source: "manual" | "scheduled" | "unknown";
	request_id: string | null;
	shard_index: number;
	feeds_per_shard: number;
	max_ai_reviews: number;
	success: boolean;
	error_name: string | null;
	error_message: string | null;
	feed_count: number;
	fetched_count: number;
	candidate_count: number;
	already_reviewed_count: number;
	unreviewed_count: number;
	eligible_for_ai_count: number;
	ai_reviewed_count: number;
	accepted_count: number;
	rejected_count: number;
	no_thumbnail_rejected_count: number;
	locally_rejected_count: number;
	image_hydration_lookup_count: number;
	image_hydration_found_count: number;
	review_save_ok: boolean;
	article_save_ok: boolean;
	ai_usage_save_ok: boolean;
	cost_protection_limit_reached: boolean;
	spike_warning_triggered: boolean;
	duration_ms: number;
};

type RefreshResult = {
	message: string;
	shardIndex: number;
	feedsPerShard: number;
	maxAiReviews: number;
	feedCount: number;
	feedFetchSuccessCount: number;
	feedFetchFailureCount: number;
	failedFeeds: Array<{
		source: string;
		url: string;
		status: number | null;
		errorMessage: string | null;
	}>;
	fetchedCount: number;
	candidateCount: number;
	alreadyReviewedCount: number;
	unreviewedCount: number;
	imageHydrationLookupCount: number;
	imageHydrationFoundCount: number;
	noThumbnailRejectedCount: number;
	locallyRejectedCount: number;
	eligibleForAiCount: number;
	aiReviewedCount: number;
	acceptedCount: number;
	rejectedCount: number;
	reviewSaveOk: boolean;
	articleSaveOk: boolean;
	aiUsageSaveOk: boolean;
	workerRunSaveOk: boolean;
	openAiModel: string;
	openAiCallCount: number;
	openAiPromptTokens: number;
	openAiCompletionTokens: number;
	openAiTotalTokens: number;
	estimatedOpenAiCostUsd: number;
	openAiAcceptedCount: number;
	openAiRejectedCount: number;
	costProtectionLimitReached: boolean;
	spikeWarningTriggered: boolean;
	durationMs: number;
};

const MAX_ITEMS_PER_FEED = 35;
const MAX_CANDIDATES_PER_RUN = 300;
const DEFAULT_MAX_AI_REVIEWS_PER_RUN = 12;
const HARD_MAX_AI_REVIEWS_PER_RUN = 18;
const AI_REVIEW_CONCURRENCY = 3;
const REVIEWED_URL_LOOKBACK_LIMIT = 5000;
const MAX_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN = 12;
const ARTICLE_PAGE_IMAGE_LOOKUP_CONCURRENCY = 3;
const MAX_ESTIMATED_SUBREQUESTS_PER_RUN = 45;
const RESERVED_NON_FEED_SUBREQUESTS_PER_RUN = 6;

const OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_INPUT_COST_PER_1M_TOKENS = 0.15;
const DEFAULT_OPENAI_OUTPUT_COST_PER_1M_TOKENS = 0.6;
const DEFAULT_AI_COST_ALERT_RUN_USD = 0.05;
const DEFAULT_AI_REVIEW_ALERT_RUN_LIMIT = 12;
const DEFAULT_AI_TOKEN_ALERT_RUN_LIMIT = 50000;

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

const NO_THUMBNAIL_REJECT_DECISION: AiArticleDecision = {
	decision: "reject",
	category: "Uplifting",
	positivity_score: 0,
	summary: "",
	reason:
		"Skipped before AI because the RSS item and article page did not include a usable image thumbnail.",
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

function getOptionalNumber(value: string | undefined, fallback: number) {
	if (!value) {
		return fallback;
	}

	const parsed = Number(value);

	if (Number.isNaN(parsed) || parsed < 0) {
		return fallback;
	}

	return parsed;
}

function emptyOpenAiUsage(): OpenAiUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
	};
}

function estimateOpenAiCost(usage: OpenAiUsage, config: RuntimeConfig) {
	const inputCost =
		(usage.promptTokens / 1_000_000) * config.openAiInputCostPer1MTokens;
	const outputCost =
		(usage.completionTokens / 1_000_000) *
		config.openAiOutputCostPer1MTokens;

	return inputCost + outputCost;
}

function normalizeOpenAiUsage(value: unknown): OpenAiUsage {
	if (!value || typeof value !== "object") {
		return emptyOpenAiUsage();
	}

	const record = value as Record<string, unknown>;

	const promptTokens =
		typeof record.prompt_tokens === "number" ? record.prompt_tokens : 0;
	const completionTokens =
		typeof record.completion_tokens === "number"
			? record.completion_tokens
			: 0;
	const totalTokens =
		typeof record.total_tokens === "number"
			? record.total_tokens
			: promptTokens + completionTokens;

	return {
		promptTokens,
		completionTokens,
		totalTokens,
	};
}

function buildAiClassificationResult(
	aiDecision: AiArticleDecision,
	usage: OpenAiUsage,
	config: RuntimeConfig,
): AiClassificationResult {
	return {
		aiDecision,
		usage,
		estimatedCostUsd: estimateOpenAiCost(usage, config),
		openAiModel: OPENAI_MODEL,
	};
}

function sumOpenAiUsage(reviewedArticles: ReviewedArticleResult[]) {
	return reviewedArticles.reduce(
		(total, reviewedArticle) => {
			if (!reviewedArticle.usage) {
				return total;
			}

			return {
				promptTokens:
					total.promptTokens + reviewedArticle.usage.promptTokens,
				completionTokens:
					total.completionTokens +
					reviewedArticle.usage.completionTokens,
				totalTokens: total.totalTokens + reviewedArticle.usage.totalTokens,
			};
		},
		emptyOpenAiUsage(),
	);
}

function shouldTriggerOpenAiUsageWarning(
	run: AiUsageRunInsert,
	config: RuntimeConfig,
) {
	return (
		run.cost_protection_limit_reached ||
		run.ai_reviewed_count >= config.aiReviewAlertRunLimit ||
		run.estimated_openai_cost_usd >= config.aiCostAlertRunUsd ||
		run.openai_total_tokens >= config.aiTokenAlertRunLimit
	);
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
		openAiInputCostPer1MTokens: getOptionalNumber(
			env.OPENAI_INPUT_COST_PER_1M_TOKENS,
			DEFAULT_OPENAI_INPUT_COST_PER_1M_TOKENS,
		),
		openAiOutputCostPer1MTokens: getOptionalNumber(
			env.OPENAI_OUTPUT_COST_PER_1M_TOKENS,
			DEFAULT_OPENAI_OUTPUT_COST_PER_1M_TOKENS,
		),
		aiCostAlertRunUsd: getOptionalNumber(
			env.AI_COST_ALERT_RUN_USD,
			DEFAULT_AI_COST_ALERT_RUN_USD,
		),
		aiReviewAlertRunLimit: getOptionalNumber(
			env.AI_REVIEW_ALERT_RUN_LIMIT,
			DEFAULT_AI_REVIEW_ALERT_RUN_LIMIT,
		),
		aiTokenAlertRunLimit: getOptionalNumber(
			env.AI_TOKEN_ALERT_RUN_LIMIT,
			DEFAULT_AI_TOKEN_ALERT_RUN_LIMIT,
		),
	};
}

async function getWorkerRunSaveConfig(
	env: Env,
): Promise<WorkerRunSaveConfig | null> {
	const supabaseUrl = await resolveValue(env.SUPABASE_URL);
	const supabaseServiceRoleKey = await resolveValue(
		env.SUPABASE_SERVICE_ROLE_KEY,
	);

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		return null;
	}

	return {
		supabaseUrl,
		supabaseServiceRoleKey,
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

function getArticlePageImageLookupLimit(feedCount: number, maxAiReviews: number) {
	const estimatedAvailableSubrequests =
		MAX_ESTIMATED_SUBREQUESTS_PER_RUN -
		feedCount -
		maxAiReviews -
		RESERVED_NON_FEED_SUBREQUESTS_PER_RUN;

	return Math.max(
		0,
		Math.min(
			MAX_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN,
			estimatedAvailableSubrequests,
		),
	);
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
	const regex = new RegExp(
		`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
		"i",
	);
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
	const linkTags = itemXml.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const rel = getAttributeValue(tag, "rel").toLowerCase();
		const href = getAttributeValue(tag, "href");

		if (href && (!rel || rel === "alternate")) {
			return decodeHtml(href.trim());
		}
	}

	const hrefMatch = itemXml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);

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
		lowerUrl.includes(".avif") ||
		lowerUrl.includes("image") ||
		lowerUrl.includes("thumbnail") ||
		lowerUrl.includes("media") ||
		lowerUrl.includes("uploads")
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
		lowerUrl.includes("gravatar") ||
		lowerUrl.endsWith(".svg")
	);
}

function extractBestUrlFromSrcset(srcset: string) {
	const candidates = srcset
		.split(",")
		.map((part) => {
			const [url, descriptor] = part.trim().split(/\s+/);
			const widthMatch = descriptor?.match(/^(\d+)w$/);
			const densityMatch = descriptor?.match(/^(\d+(?:\.\d+)?)x$/);

			let score = 1;

			if (widthMatch?.[1]) {
				score = Number(widthMatch[1]);
			} else if (densityMatch?.[1]) {
				score = Number(densityMatch[1]) * 1000;
			}

			return {
				url,
				score,
			};
		})
		.filter(
			(candidate): candidate is { url: string; score: number } =>
				Boolean(candidate.url),
		)
		.sort((a, b) => b.score - a.score);

	return candidates[0]?.url ?? "";
}

function firstValidImageUrl(candidates: string[], articleUrl: string) {
	for (const candidate of candidates) {
		const normalizedUrl = normalizeImageUrl(candidate, articleUrl);

		if (normalizedUrl && !isBadImageCandidate(normalizedUrl)) {
			return normalizedUrl;
		}
	}

	return null;
}

function extractImageFromHtml(html: string, articleUrl: string): string | null {
	const candidates: string[] = [];
	const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];

	for (const tag of imageTags) {
		const srcset =
			getAttributeValue(tag, "srcset") ||
			getAttributeValue(tag, "data-srcset");

		if (srcset) {
			const bestSrcsetUrl = extractBestUrlFromSrcset(srcset);

			if (bestSrcsetUrl) {
				candidates.push(bestSrcsetUrl);
			}
		}

		[
			"data-original",
			"data-image",
			"data-src",
			"data-lazy-src",
			"data-orig-file",
			"data-medium-file",
			"data-large-file",
			"src",
		].forEach((attributeName) => {
			const value = getAttributeValue(tag, attributeName);

			if (value) {
				candidates.push(value);
			}
		});
	}

	return firstValidImageUrl(candidates, articleUrl);
}

function extractMetaImagesFromHtml(html: string) {
	const candidates: string[] = [];
	const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
	const imageMetaKeys = new Set([
		"og:image",
		"og:image:url",
		"og:image:secure_url",
		"twitter:image",
		"twitter:image:src",
		"thumbnail",
		"image",
	]);

	for (const tag of metaTags) {
		const property = getAttributeValue(tag, "property").toLowerCase();
		const name = getAttributeValue(tag, "name").toLowerCase();
		const itemprop = getAttributeValue(tag, "itemprop").toLowerCase();
		const content = getAttributeValue(tag, "content");

		if (
			content &&
			(imageMetaKeys.has(property) ||
				imageMetaKeys.has(name) ||
				imageMetaKeys.has(itemprop))
		) {
			candidates.push(content);
		}
	}

	return candidates;
}

function extractLinkImagesFromHtml(html: string) {
	const candidates: string[] = [];
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const rel = getAttributeValue(tag, "rel").toLowerCase();
		const asValue = getAttributeValue(tag, "as").toLowerCase();
		const href = getAttributeValue(tag, "href");

		if (
			href &&
			(rel.includes("image_src") ||
				rel.includes("preload") ||
				rel.includes("prefetch")) &&
			(!asValue || asValue === "image")
		) {
			candidates.push(href);
		}
	}

	return candidates;
}

function addJsonLdImageCandidate(value: unknown, candidates: string[]) {
	if (!value) {
		return;
	}

	if (typeof value === "string") {
		candidates.push(value);
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item) => addJsonLdImageCandidate(item, candidates));
		return;
	}

	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const url =
			record.url ?? record.contentUrl ?? record.thumbnailUrl ?? record["@id"];

		if (typeof url === "string") {
			candidates.push(url);
		}

		if (Array.isArray(url)) {
			url.forEach((item) => addJsonLdImageCandidate(item, candidates));
		}
	}
}

function extractJsonLdImagesFromValue(value: unknown, candidates: string[]) {
	if (!value) {
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item) => extractJsonLdImagesFromValue(item, candidates));
		return;
	}

	if (typeof value !== "object") {
		return;
	}

	const record = value as Record<string, unknown>;

	[
		"image",
		"thumbnail",
		"thumbnailUrl",
		"primaryImageOfPage",
		"associatedMedia",
	].forEach((key) => {
		if (key in record) {
			addJsonLdImageCandidate(record[key], candidates);
		}
	});

	Object.values(record).forEach((nestedValue) => {
		if (typeof nestedValue === "object") {
			extractJsonLdImagesFromValue(nestedValue, candidates);
		}
	});
}

function extractJsonLdImagesFromHtml(html: string) {
	const candidates: string[] = [];
	const scriptTags =
		html.match(
			/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
		) ?? [];

	for (const scriptTag of scriptTags) {
		const contentMatch = scriptTag.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
		const rawContent = contentMatch?.[1]?.trim();

		if (!rawContent) {
			continue;
		}

		try {
			const parsed = JSON.parse(decodeHtml(rawContent));
			extractJsonLdImagesFromValue(parsed, candidates);
		} catch {
			continue;
		}
	}

	return candidates;
}

function extractArticlePageImageFromHtml(
	html: string,
	articleUrl: string,
): string | null {
	const candidates = [
		...extractMetaImagesFromHtml(html),
		...extractLinkImagesFromHtml(html),
		...extractJsonLdImagesFromHtml(html),
	];

	const metadataImage = firstValidImageUrl(candidates, articleUrl);

	if (metadataImage) {
		return metadataImage;
	}

	return extractImageFromHtml(html, articleUrl);
}

function extractRssImageUrl(itemXml: string, articleUrl: string): string | null {
	const candidates: string[] = [];

	const mediaContentTags = itemXml.match(/<media:content\b[^>]*>/gi) ?? [];

	for (const tag of mediaContentTags) {
		const medium = getAttributeValue(tag, "medium").toLowerCase();
		const type = getAttributeValue(tag, "type").toLowerCase();
		const url = getAttributeValue(tag, "url");

		if (
			url &&
			(medium === "image" || type.startsWith("image/") || isLikelyImageUrl(url))
		) {
			candidates.push(url);
		}
	}

	const mediaThumbnailTags = itemXml.match(/<media:thumbnail\b[^>]*>/gi) ?? [];

	for (const tag of mediaThumbnailTags) {
		const url = getAttributeValue(tag, "url");

		if (url) {
			candidates.push(url);
		}
	}

	const enclosureTags = itemXml.match(/<enclosure\b[^>]*>/gi) ?? [];

	for (const tag of enclosureTags) {
		const type = getAttributeValue(tag, "type").toLowerCase();
		const url = getAttributeValue(tag, "url");

		if (url && (type.startsWith("image/") || isLikelyImageUrl(url))) {
			candidates.push(url);
		}
	}

	const itunesImageTags = itemXml.match(/<itunes:image\b[^>]*>/gi) ?? [];

	for (const tag of itunesImageTags) {
		const href = getAttributeValue(tag, "href");

		if (href) {
			candidates.push(href);
		}
	}

	const imageTags = itemXml.match(/<image\b[^>]*>[\s\S]*?<\/image>/gi) ?? [];

	for (const tag of imageTags) {
		const url = getTagValue(tag, "url") || getAttributeValue(tag, "url");

		if (url) {
			candidates.push(url);
		}
	}

	const directImage = firstValidImageUrl(candidates, articleUrl);

	if (directImage) {
		return directImage;
	}

	const description =
		getTagValue(itemXml, "description") ||
		getTagValue(itemXml, "summary") ||
		getTagValue(itemXml, "content:encoded") ||
		getTagValue(itemXml, "content");

	return extractImageFromHtml(description, articleUrl);
}

async function fetchArticlePageImage(article: RssArticle): Promise<RssArticle> {
	if (hasUsableThumbnail(article)) {
		return article;
	}

	try {
		const response = await fetch(article.url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; NutsNewsBot/1.0; +https://www.nutsnews.com)",
				Accept: "text/html,application/xhtml+xml",
			},
		});

		if (!response.ok) {
			return article;
		}

		const contentType = response.headers.get("content-type") ?? "";

		if (
			contentType &&
			!contentType.toLowerCase().includes("text/html") &&
			!contentType.toLowerCase().includes("application/xhtml")
		) {
			return article;
		}

		const html = await response.text();
		const imageUrl = extractArticlePageImageFromHtml(html, article.url);

		if (!imageUrl) {
			return article;
		}

		return {
			...article,
			imageUrl,
		};
	} catch {
		return article;
	}
}

async function hydrateMissingArticleImages(
	env: Env,
	articles: RssArticle[],
	lookupLimit: number,
): Promise<ImageHydrationResult> {
	if (lookupLimit <= 0) {
		return {
			articles,
			lookupCount: 0,
			foundCount: 0,
		};
	}

	const missingImageArticles = articles.filter(
		(article) => !hasUsableThumbnail(article),
	);
	const lookupCandidates = missingImageArticles.slice(0, lookupLimit);

	if (lookupCandidates.length === 0) {
		return {
			articles,
			lookupCount: 0,
			foundCount: 0,
		};
	}

	const hydratedCandidates = await mapWithConcurrency(
		lookupCandidates,
		ARTICLE_PAGE_IMAGE_LOOKUP_CONCURRENCY,
		fetchArticlePageImage,
	);

	const hydratedByUrl = new Map(
		hydratedCandidates.map((article) => [article.url, article]),
	);

	const hydratedArticles = articles.map((article) => {
		return hydratedByUrl.get(article.url) ?? article;
	});

	const foundCount = hydratedCandidates.filter(hasUsableThumbnail).length;

	await logInfo(
		env,
		"worker.images.hydration_completed",
		"Article page image hydration completed",
		{
			lookupLimit,
			lookupCount: lookupCandidates.length,
			foundCount,
			missingBeforeCount: missingImageArticles.length,
			missingAfterCount: hydratedArticles.filter(
				(article) => !hasUsableThumbnail(article),
			).length,
		},
	);

	return {
		articles: hydratedArticles,
		lookupCount: lookupCandidates.length,
		foundCount,
	};
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
	const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
	const entryMatches = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
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

function hasUsableThumbnail(
	article: RssArticle,
): article is RssArticle & { imageUrl: string } {
	return Boolean(article.imageUrl?.trim());
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

function buildRejectedArticles(
	articles: RssArticle[],
	baseDecision: AiArticleDecision,
	reasonBuilder: (article: RssArticle) => string,
): ReviewedArticleResult[] {
	return articles.map((article) => ({
		article,
		aiDecision: {
			...baseDecision,
			reason: reasonBuilder(article),
		},
		reviewSource: "local",
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
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await mapper(
				items[currentIndex] as T,
				currentIndex,
			);
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

async function readResponseTextSafely(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch (error) {
		return `Failed to read response body: ${getErrorMessage(error)}`;
	}
}

async function readResponseJsonSafely<T>(
	response: Response,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
	try {
		return {
			ok: true,
			value: (await response.json()) as T,
		};
	} catch (error) {
		return {
			ok: false,
			error,
		};
	}
}

async function fetchSingleFeed(
	env: Env,
	feed: RssFeed,
): Promise<FeedFetchResult> {
	const startedAt = Date.now();

	try {
		const response = await fetch(feed.url, {
			headers: {
				"User-Agent": "NutsNewsBot/1.0",
			},
		});

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);

			await logWarn(
				env,
				"worker.rss.fetch_failed_status",
				"RSS feed fetch failed",
				{
					source: feed.source,
					feedUrl: feed.url,
					status: response.status,
					errorText,
					durationMs: Date.now() - startedAt,
				},
			);

			return {
				feed,
				articles: [],
				ok: false,
				status: response.status,
				errorMessage: errorText || `RSS feed returned ${response.status}`,
				durationMs: Date.now() - startedAt,
			};
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

		return {
			feed,
			articles,
			ok: true,
			status: response.status,
			errorMessage: null,
			durationMs: Date.now() - startedAt,
		};
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

		return {
			feed,
			articles: [],
			ok: false,
			status: null,
			errorMessage: getErrorMessage(error),
			durationMs: Date.now() - startedAt,
		};
	}
}

async function fetchRssArticles(
	env: Env,
	feeds: RssFeed[],
	positiveSources: Set<string>,
): Promise<RssFetchResult> {
	const feedResults = await Promise.all(
		feeds.map((feed) => fetchSingleFeed(env, feed)),
	);
	const failedFeeds = feedResults
		.filter((result) => !result.ok)
		.map((result) => ({
			source: result.feed.source,
			url: result.feed.url,
			status: result.status,
			errorMessage: result.errorMessage,
		}));
	const allArticles = feedResults.flatMap((result) => result.articles);

	if (failedFeeds.length > 0) {
		await logWarn(
			env,
			"worker.rss.fetch_completed_with_failures",
			"RSS fetch completed with one or more feed failures",
			{
				feedCount: feeds.length,
				feedFetchSuccessCount: feedResults.length - failedFeeds.length,
				feedFetchFailureCount: failedFeeds.length,
				failedFeeds,
			},
		);
	}

	return {
		articles: sortArticlesForReview(
			uniqueArticlesByUrl(allArticles),
			positiveSources,
		),
		feedFetchSuccessCount: feedResults.length - failedFeeds.length,
		feedFetchFailureCount: failedFeeds.length,
		failedFeeds,
	};
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
	let response: Response;

	try {
		response = await fetch(
			`${config.supabaseUrl}/rest/v1/article_ai_reviews?select=original_url&order=reviewed_at.desc&limit=${REVIEWED_URL_LOOKBACK_LIMIT}`,
			{
				method: "GET",
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				},
			},
		);
	} catch (error) {
		await logError(
			env,
			"worker.supabase.review_lookup_exception",
			"Supabase reviewed URL lookup threw an exception",
			error,
			{
				candidateUrlCount: urls.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return reviewedUrls;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

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

	const jsonResult = await readResponseJsonSafely<ReviewedUrlRow[]>(response);

	if (!jsonResult.ok) {
		await logError(
			env,
			"worker.supabase.review_lookup_parse_failed",
			"Failed to parse Supabase reviewed URL lookup response",
			jsonResult.error,
			{
				candidateUrlCount: urls.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return reviewedUrls;
	}

	const rows = jsonResult.value;

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

function normalizeAiDecision(
	value: Partial<AiArticleDecision>,
): AiArticleDecision {
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

function buildRejectedAiClassificationResult(
	config: RuntimeConfig,
	reason: string,
	usage: OpenAiUsage = emptyOpenAiUsage(),
): AiClassificationResult {
	return buildAiClassificationResult(
		{
			decision: "reject",
			category: "Uplifting",
			positivity_score: 0,
			summary: "",
			reason,
		},
		usage,
		config,
	);
}

async function classifyAndSummarizeArticle(
	env: Env,
	config: RuntimeConfig,
	article: RssArticle,
): Promise<AiClassificationResult> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.openAiApiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: OPENAI_MODEL,
				response_format: {
					type: "json_object",
				},
				messages: [
					{
						role: "system",
						content:
							"You are filtering articles for NutsNews, a peaceful uplifting news feed.\nReject politics, war, money, crime, tragedy, fear, conflict, elections, government, markets, inflation, business, stocks, military, and violence.\nAccept positive, uplifting, inspiring, human-interest, wellness, lifestyle, science, culture, animals, travel, community, nature, space, creativity, and remarkable achievement stories.\nBe selective, but do not reject a clearly positive article just because it comes from a broad news source.\nReturn only valid JSON.",
					},
					{
						role: "user",
						content: `Article:
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
}`,
					},
				],
			}),
		});
	} catch (error) {
		await logError(
			env,
			"worker.openai.request_exception",
			"OpenAI request threw an exception",
			error,
			{
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				durationMs: Date.now() - startedAt,
			},
		);

		return buildRejectedAiClassificationResult(
			config,
			`OpenAI request exception: ${getErrorMessage(error)}`,
		);
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, "worker.openai.request_failed", "OpenAI request failed", {
			status: response.status,
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			errorText,
			durationMs: Date.now() - startedAt,
		});

		return buildRejectedAiClassificationResult(
			config,
			`OpenAI request failed: ${response.status}`,
		);
	}

	const jsonResult = await readResponseJsonSafely<{
		choices?: Array<{
			message?: {
				content?: string;
			};
		}>;
		usage?: unknown;
	}>(response);

	if (!jsonResult.ok) {
		await logError(
			env,
			"worker.openai.response_json_failed",
			"Failed to parse OpenAI response JSON",
			jsonResult.error,
			{
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				durationMs: Date.now() - startedAt,
			},
		);

		return buildRejectedAiClassificationResult(
			config,
			"OpenAI response JSON parse failed",
		);
	}

	const data = jsonResult.value;
	const usage = normalizeOpenAiUsage(data.usage);
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
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				totalTokens: usage.totalTokens,
				durationMs: Date.now() - startedAt,
			},
		);

		return buildRejectedAiClassificationResult(
			config,
			"OpenAI returned empty content",
			usage,
		);
	}

	try {
		const parsedDecision = normalizeAiDecision(
			JSON.parse(content) as Partial<AiArticleDecision>,
		);
		const estimatedCostUsd = estimateOpenAiCost(usage, config);

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
				openAiModel: OPENAI_MODEL,
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				totalTokens: usage.totalTokens,
				estimatedCostUsd,
				durationMs: Date.now() - startedAt,
			},
		);

		return buildAiClassificationResult(parsedDecision, usage, config);
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
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				totalTokens: usage.totalTokens,
				durationMs: Date.now() - startedAt,
			},
		);

		return buildRejectedAiClassificationResult(
			config,
			"OpenAI returned invalid JSON",
			usage,
		);
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

	let response: Response;

	try {
		response = await fetch(
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
	} catch (error) {
		await logError(
			env,
			"worker.supabase.review_batch_save_exception",
			"Supabase article AI review batch save threw an exception",
			error,
			{
				reviewCount: reviews.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

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

	let response: Response;

	try {
		response = await fetch(
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
	} catch (error) {
		await logError(
			env,
			"worker.supabase.article_batch_save_exception",
			"Supabase accepted article batch save threw an exception",
			error,
			{
				articleCount: articles.length,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

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

async function saveAiUsageRun(
	env: Env,
	config: RuntimeConfig,
	run: AiUsageRunInsert,
): Promise<boolean> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/ai_usage_runs`, {
			method: "POST",
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				"Content-Type": "application/json",
				Prefer: "return=minimal",
			},
			body: JSON.stringify(run),
		});
	} catch (error) {
		await logError(
			env,
			"worker.supabase.ai_usage_run_save_exception",
			"Supabase AI usage run save threw an exception",
			error,
			{
				shardIndex: run.shard_index,
				openAiCallCount: run.openai_call_count,
				estimatedOpenAiCostUsd: run.estimated_openai_cost_usd,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(
			env,
			"worker.supabase.ai_usage_run_save_failed",
			"Failed to save AI usage run",
			{
				status: response.status,
				errorText,
				shardIndex: run.shard_index,
				openAiCallCount: run.openai_call_count,
				estimatedOpenAiCostUsd: run.estimated_openai_cost_usd,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	await logInfo(
		env,
		"worker.supabase.ai_usage_run_saved",
		"Saved AI usage run",
		{
			shardIndex: run.shard_index,
			openAiCallCount: run.openai_call_count,
			openAiPromptTokens: run.openai_prompt_tokens,
			openAiCompletionTokens: run.openai_completion_tokens,
			openAiTotalTokens: run.openai_total_tokens,
			estimatedOpenAiCostUsd: run.estimated_openai_cost_usd,
			durationMs: Date.now() - startedAt,
		},
	);

	return true;
}

async function saveWorkerRun(
	env: Env,
	config: WorkerRunSaveConfig,
	run: WorkerRunInsert,
): Promise<boolean> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/worker_runs`, {
			method: "POST",
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				"Content-Type": "application/json",
				Prefer: "return=minimal",
			},
			body: JSON.stringify(run),
		});
	} catch (error) {
		await logError(
			env,
			"worker.supabase.worker_run_save_exception",
			"Supabase Worker run save threw an exception",
			error,
			{
				shardIndex: run.shard_index,
				runSource: run.run_source,
				success: run.success,
				errorName: run.error_name,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(
			env,
			"worker.supabase.worker_run_save_failed",
			"Failed to save Worker run",
			{
				status: response.status,
				errorText,
				shardIndex: run.shard_index,
				runSource: run.run_source,
				success: run.success,
				errorName: run.error_name,
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	await logInfo(env, "worker.supabase.worker_run_saved", "Saved Worker run", {
		shardIndex: run.shard_index,
		runSource: run.run_source,
		success: run.success,
		acceptedCount: run.accepted_count,
		rejectedCount: run.rejected_count,
		fetchedCount: run.fetched_count,
		durationMs: Date.now() - startedAt,
	});

	return true;
}

function buildSuccessfulWorkerRun(
	result: Omit<RefreshResult, "workerRunSaveOk">,
	options: {
		runStartedAt: number;
		runCompletedAt: Date;
		runSource: "manual" | "scheduled" | "unknown";
		requestId: string | null;
	},
): WorkerRunInsert {
	return {
		run_started_at: new Date(options.runStartedAt).toISOString(),
		run_completed_at: options.runCompletedAt.toISOString(),
		run_source: options.runSource,
		request_id: options.requestId,
		shard_index: result.shardIndex,
		feeds_per_shard: result.feedsPerShard,
		max_ai_reviews: result.maxAiReviews,
		success: true,
		error_name: null,
		error_message: null,
		feed_count: result.feedCount,
		fetched_count: result.fetchedCount,
		candidate_count: result.candidateCount,
		already_reviewed_count: result.alreadyReviewedCount,
		unreviewed_count: result.unreviewedCount,
		eligible_for_ai_count: result.eligibleForAiCount,
		ai_reviewed_count: result.aiReviewedCount,
		accepted_count: result.acceptedCount,
		rejected_count: result.rejectedCount,
		no_thumbnail_rejected_count: result.noThumbnailRejectedCount,
		locally_rejected_count: result.locallyRejectedCount,
		image_hydration_lookup_count: result.imageHydrationLookupCount,
		image_hydration_found_count: result.imageHydrationFoundCount,
		review_save_ok: result.reviewSaveOk,
		article_save_ok: result.articleSaveOk,
		ai_usage_save_ok: result.aiUsageSaveOk,
		cost_protection_limit_reached: result.costProtectionLimitReached,
		spike_warning_triggered: result.spikeWarningTriggered,
		duration_ms: result.durationMs,
	};
}

function getErrorName(error: unknown) {
	return error instanceof Error ? error.name : "UnknownError";
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

async function saveFailedWorkerRun(
	env: Env,
	options: {
		runStartedAt: number;
		runSource: "manual" | "scheduled" | "unknown";
		requestId: string | null;
		maxAiReviews?: number;
		error: unknown;
	},
): Promise<boolean> {
	const config = await getWorkerRunSaveConfig(env);

	if (!config) {
		await logWarn(
			env,
			"worker.supabase.worker_run_failed_save_skipped",
			"Skipped saving failed Worker run because Supabase config is missing",
			{
				requestId: options.requestId,
				shardIndex: getShardIndex(env),
				runSource: options.runSource,
				errorName: getErrorName(options.error),
				errorMessage: getErrorMessage(options.error),
			},
		);

		return false;
	}

	const runCompletedAt = new Date();
	const durationMs = Date.now() - options.runStartedAt;
	const maxAiReviews = clampAiReviewLimit(options.maxAiReviews);

	return saveWorkerRun(env, config, {
		run_started_at: new Date(options.runStartedAt).toISOString(),
		run_completed_at: runCompletedAt.toISOString(),
		run_source: options.runSource,
		request_id: options.requestId,
		shard_index: getShardIndex(env),
		feeds_per_shard: getFeedsPerShard(env),
		max_ai_reviews: maxAiReviews,
		success: false,
		error_name: getErrorName(options.error),
		error_message: getErrorMessage(options.error),
		feed_count: 0,
		fetched_count: 0,
		candidate_count: 0,
		already_reviewed_count: 0,
		unreviewed_count: 0,
		eligible_for_ai_count: 0,
		ai_reviewed_count: 0,
		accepted_count: 0,
		rejected_count: 0,
		no_thumbnail_rejected_count: 0,
		locally_rejected_count: 0,
		image_hydration_lookup_count: 0,
		image_hydration_found_count: 0,
		review_save_ok: false,
		article_save_ok: false,
		ai_usage_save_ok: false,
		cost_protection_limit_reached: false,
		spike_warning_triggered: false,
		duration_ms: durationMs,
	});
}

async function reviewArticleWithOpenAi(
	env: Env,
	config: RuntimeConfig,
	article: RssArticle,
): Promise<ReviewedArticleResult> {
	try {
		const aiResult = await classifyAndSummarizeArticle(env, config, article);

		return {
			article,
			aiDecision: aiResult.aiDecision,
			usage: aiResult.usage,
			estimatedCostUsd: aiResult.estimatedCostUsd,
			openAiModel: aiResult.openAiModel,
			reviewSource: "openai",
		};
	} catch (error) {
		await logError(
			env,
			"worker.openai.article_review_exception",
			"OpenAI article review failed unexpectedly and was converted to a safe rejection",
			error,
			{
				source: article.source,
				title: article.title,
				articleUrl: article.url,
			},
		);

		return {
			article,
			aiDecision: {
				decision: "reject",
				category: "Uplifting",
				positivity_score: 0,
				summary: "",
				reason: `OpenAI review exception: ${getErrorMessage(error)}`,
			},
			usage: emptyOpenAiUsage(),
			estimatedCostUsd: 0,
			openAiModel: OPENAI_MODEL,
			reviewSource: "openai",
		};
	}
}

function buildRowsFromReviewedArticles(reviewedArticles: ReviewedArticleResult[]) {
	const reviewRows: ArticleReviewInsert[] = [];
	const acceptedArticleRows: ArticleInsert[] = [];

	let acceptedCount = 0;
	let rejectedCount = 0;

	for (const reviewedArticle of reviewedArticles) {
		const { article, aiDecision } = reviewedArticle;
		const hasThumbnail = hasUsableThumbnail(article);
		const requestedDecision =
			aiDecision.decision === "accept" ? "accept" : "reject";
		const normalizedDecision: "accept" | "reject" =
			requestedDecision === "accept" && hasThumbnail ? "accept" : "reject";
		const normalizedCategory = aiDecision.category || "Uplifting";
		const normalizedScore = aiDecision.positivity_score ?? 0;
		const normalizedSummary = aiDecision.summary || article.excerpt || article.title;
		const normalizedReason =
			requestedDecision === "accept" && !hasThumbnail
				? "Rejected before publish because the RSS item and article page did not include a usable image thumbnail."
				: aiDecision.reason || "No reason provided";

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

		const imageUrl = article.imageUrl;

		if (!imageUrl) {
			rejectedCount += 1;
			continue;
		}

		acceptedCount += 1;

		acceptedArticleRows.push({
			source: article.source,
			title: article.title,
			original_url: article.url,
			image_url: imageUrl,
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
		runSource: options.runSource ?? "unknown",
		requestId: options.requestId ?? null,
	});

	const shardFeeds = await getFeedsForShard(env, config);
	const articlePageImageLookupLimit = getArticlePageImageLookupLimit(
		shardFeeds.length,
		maxAiReviews,
	);

	const positiveSources = new Set(
		shardFeeds
			.filter((feed) => feed.is_positive_source)
			.map((feed) => feed.source),
	);

	const rssFetchResult = await fetchRssArticles(env, shardFeeds, positiveSources);
	const fetchedArticles = rssFetchResult.articles;
	const candidateArticles = fetchedArticles.slice(0, MAX_CANDIDATES_PER_RUN);
	const candidateUrls = candidateArticles.map((article) => article.url);

	await logInfo(env, "worker.refresh.candidates_loaded", "RSS candidates loaded", {
		shardIndex,
		fetchedCount: fetchedArticles.length,
		feedFetchSuccessCount: rssFetchResult.feedFetchSuccessCount,
		feedFetchFailureCount: rssFetchResult.feedFetchFailureCount,
		failedFeeds: rssFetchResult.failedFeeds,
		candidateCount: candidateArticles.length,
		rssThumbnailCandidateCount: candidateArticles.filter(hasUsableThumbnail)
			.length,
		noRssThumbnailCandidateCount: candidateArticles.filter(
			(article) => !hasUsableThumbnail(article),
		).length,
		articlePageImageLookupLimit,
		maxCandidatesPerRun: MAX_CANDIDATES_PER_RUN,
	});

	const reviewedUrls = await getReviewedUrls(env, config, candidateUrls);

	const unreviewedArticlesBeforeImageHydration = candidateArticles.filter(
		(article) => !reviewedUrls.has(article.url),
	);

	const imageHydrationResult = await hydrateMissingArticleImages(
		env,
		unreviewedArticlesBeforeImageHydration,
		articlePageImageLookupLimit,
	);

	const unreviewedArticles = imageHydrationResult.articles;
	const noThumbnailArticles = unreviewedArticles.filter(
		(article) => !hasUsableThumbnail(article),
	);
	const unreviewedArticlesWithThumbnails =
		unreviewedArticles.filter(hasUsableThumbnail);

	const localFilterResults = unreviewedArticlesWithThumbnails.map((article) => ({
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
			imageHydrationLookupCount: imageHydrationResult.lookupCount,
			imageHydrationFoundCount: imageHydrationResult.foundCount,
			noThumbnailRejectedCount: noThumbnailArticles.length,
			locallyRejectedCount: locallyRejectedArticles.length,
			eligibleForAiCount: articlesEligibleForAi.length,
			aiReviewCount: articlesForAi.length,
		},
	);

	const noThumbnailRejectedResults = buildRejectedArticles(
		noThumbnailArticles,
		NO_THUMBNAIL_REJECT_DECISION,
		(article) =>
			`Skipped before AI from ${article.source}: RSS item and article page did not include a usable image thumbnail.`,
	);

	const locallyRejectedResults = buildRejectedArticles(
		locallyRejectedArticles,
		LOCAL_PREFILTER_REJECT_DECISION,
		(article) =>
			`Skipped before AI from ${article.source}: obvious negative topic detected in title or excerpt.`,
	);

	const aiReviewedArticles = await mapWithConcurrency(
		articlesForAi,
		AI_REVIEW_CONCURRENCY,
		(article) => reviewArticleWithOpenAi(env, config, article),
	);

	const reviewedArticles = [
		...noThumbnailRejectedResults,
		...locallyRejectedResults,
		...aiReviewedArticles,
	];

	const { reviewRows, acceptedArticleRows, acceptedCount, rejectedCount } =
		buildRowsFromReviewedArticles(reviewedArticles);

	const reviewSaveOk = await saveArticleReviewsBatch(env, config, reviewRows);

	const articleSaveOk = await saveAcceptedArticlesBatch(
		env,
		config,
		acceptedArticleRows,
	);

	const openAiUsage = sumOpenAiUsage(aiReviewedArticles);
	const estimatedOpenAiCostUsd = estimateOpenAiCost(openAiUsage, config);
	const openAiAcceptedCount = aiReviewedArticles.filter(
		(reviewedArticle) => reviewedArticle.aiDecision.decision === "accept",
	).length;
	const openAiRejectedCount = aiReviewedArticles.filter(
		(reviewedArticle) => reviewedArticle.aiDecision.decision === "reject",
	).length;
	const costProtectionLimitReached =
		articlesEligibleForAi.length > articlesForAi.length;

	const runCompletedAt = new Date();
	const durationMs = Date.now() - refreshStartedAt;

	const aiUsageRunBase: AiUsageRunInsert = {
		run_started_at: new Date(refreshStartedAt).toISOString(),
		run_completed_at: runCompletedAt.toISOString(),
		run_source: options.runSource ?? "unknown",
		request_id: options.requestId ?? null,
		shard_index: shardIndex,
		feeds_per_shard: feedsPerShard,
		max_ai_reviews: maxAiReviews,
		feed_count: shardFeeds.length,
		fetched_count: fetchedArticles.length,
		candidate_count: candidateArticles.length,
		already_reviewed_count: reviewedUrls.size,
		unreviewed_count: unreviewedArticles.length,
		eligible_for_ai_count: articlesEligibleForAi.length,
		ai_reviewed_count: aiReviewedArticles.length,
		openai_model: OPENAI_MODEL,
		openai_call_count: aiReviewedArticles.length,
		openai_prompt_tokens: openAiUsage.promptTokens,
		openai_completion_tokens: openAiUsage.completionTokens,
		openai_total_tokens: openAiUsage.totalTokens,
		estimated_openai_cost_usd: Number(estimatedOpenAiCostUsd.toFixed(6)),
		openai_accepted_count: openAiAcceptedCount,
		openai_rejected_count: openAiRejectedCount,
		published_accepted_count: acceptedCount,
		total_rejected_count: rejectedCount,
		no_thumbnail_rejected_count: noThumbnailArticles.length,
		locally_rejected_count: locallyRejectedArticles.length,
		image_hydration_lookup_count: imageHydrationResult.lookupCount,
		image_hydration_found_count: imageHydrationResult.foundCount,
		cost_protection_limit_reached: costProtectionLimitReached,
		spike_warning_triggered: false,
		review_save_ok: reviewSaveOk,
		article_save_ok: articleSaveOk,
		duration_ms: durationMs,
	};

	const spikeWarningTriggered = shouldTriggerOpenAiUsageWarning(
		aiUsageRunBase,
		config,
	);

	const aiUsageRun: AiUsageRunInsert = {
		...aiUsageRunBase,
		spike_warning_triggered: spikeWarningTriggered,
	};

	if (spikeWarningTriggered) {
		await logWarn(
			env,
			"worker.openai.usage_spike",
			"OpenAI usage warning threshold reached",
			{
				shardIndex,
				runSource: aiUsageRun.run_source,
				requestId: aiUsageRun.request_id,
				maxAiReviews,
				eligibleForAiCount: articlesEligibleForAi.length,
				aiReviewedCount: aiReviewedArticles.length,
				openAiPromptTokens: openAiUsage.promptTokens,
				openAiCompletionTokens: openAiUsage.completionTokens,
				openAiTotalTokens: openAiUsage.totalTokens,
				estimatedOpenAiCostUsd: aiUsageRun.estimated_openai_cost_usd,
				costProtectionLimitReached,
				aiCostAlertRunUsd: config.aiCostAlertRunUsd,
				aiReviewAlertRunLimit: config.aiReviewAlertRunLimit,
				aiTokenAlertRunLimit: config.aiTokenAlertRunLimit,
			},
		);
	}

	const aiUsageSaveOk = await saveAiUsageRun(env, config, aiUsageRun);

	const resultWithoutWorkerRunSaveStatus: Omit<
		RefreshResult,
		"workerRunSaveOk"
	> = {
		message: "NutsNews refresh complete",
		shardIndex,
		feedsPerShard,
		maxAiReviews,
		feedCount: shardFeeds.length,
		feedFetchSuccessCount: rssFetchResult.feedFetchSuccessCount,
		feedFetchFailureCount: rssFetchResult.feedFetchFailureCount,
		failedFeeds: rssFetchResult.failedFeeds,
		fetchedCount: fetchedArticles.length,
		candidateCount: candidateArticles.length,
		alreadyReviewedCount: reviewedUrls.size,
		unreviewedCount: unreviewedArticles.length,
		imageHydrationLookupCount: imageHydrationResult.lookupCount,
		imageHydrationFoundCount: imageHydrationResult.foundCount,
		noThumbnailRejectedCount: noThumbnailArticles.length,
		locallyRejectedCount: locallyRejectedArticles.length,
		eligibleForAiCount: articlesEligibleForAi.length,
		aiReviewedCount: aiReviewedArticles.length,
		acceptedCount,
		rejectedCount,
		reviewSaveOk,
		articleSaveOk,
		aiUsageSaveOk,
		openAiModel: OPENAI_MODEL,
		openAiCallCount: aiReviewedArticles.length,
		openAiPromptTokens: openAiUsage.promptTokens,
		openAiCompletionTokens: openAiUsage.completionTokens,
		openAiTotalTokens: openAiUsage.totalTokens,
		estimatedOpenAiCostUsd: aiUsageRun.estimated_openai_cost_usd,
		openAiAcceptedCount,
		openAiRejectedCount,
		costProtectionLimitReached,
		spikeWarningTriggered,
		durationMs,
	};

	const workerRunSaveOk = await saveWorkerRun(
		env,
		config,
		buildSuccessfulWorkerRun(resultWithoutWorkerRunSaveStatus, {
			runStartedAt: refreshStartedAt,
			runCompletedAt,
			runSource: options.runSource ?? "unknown",
			requestId: options.requestId ?? null,
		}),
	);

	const result: RefreshResult = {
		...resultWithoutWorkerRunSaveStatus,
		workerRunSaveOk,
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
			await logInfo(
				env,
				"worker.log_test.completed",
				"Worker Better Stack log test completed",
				{
					requestId,
					path: url.pathname,
					shardIndex: getShardIndex(env),
				},
			);

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

		const maxAiReviews = parseManualLimit(url);

		try {
			const result = await refreshArticles(env, {
				maxAiReviews,
				runSource: "manual",
				requestId,
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
			await saveFailedWorkerRun(env, {
				runStartedAt: requestStartedAt,
				runSource: "manual",
				requestId,
				maxAiReviews,
				error,
			});

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
			const result = await refreshArticles(env, {
				runSource: "scheduled",
				requestId,
			});

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
			await saveFailedWorkerRun(env, {
				runStartedAt: requestStartedAt,
				runSource: "scheduled",
				requestId,
				error,
			});

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
