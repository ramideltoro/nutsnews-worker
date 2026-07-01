import { flushBetterStackLogs, logError, logInfo, logWarn } from './logger';

type SecretBinding = {
	get: () => Promise<string>;
};

type MaybeSecretBinding = string | SecretBinding | undefined;

type AiProvider = 'openai' | 'local';

type ReviewProvider = AiProvider | 'prefilter' | 'no_thumbnail';

type Env = {
	SUPABASE_URL: MaybeSecretBinding;
	SUPABASE_SERVICE_ROLE_KEY: MaybeSecretBinding;
	OPENAI_API_KEY: MaybeSecretBinding;
	AI_PROVIDER?: string;
	LOCAL_AI_URL?: MaybeSecretBinding;
	LOCAL_AI_API_KEY?: MaybeSecretBinding;
	LOCAL_AI_MODEL?: string;
	AI_PROVIDER_FALLBACK_TO_OPENAI?: string;
	AI_REVIEW_CONCURRENCY?: string;
	FEED_SHARD_INDEX?: string;
	FEEDS_PER_SHARD?: string;
	BETTER_STACK_SOURCE_TOKEN?: MaybeSecretBinding;
	BETTER_STACK_INGESTING_HOST?: MaybeSecretBinding;
	OPENAI_INPUT_COST_PER_1M_TOKENS?: string;
	OPENAI_OUTPUT_COST_PER_1M_TOKENS?: string;
	AI_COST_ALERT_RUN_USD?: string;
	AI_REVIEW_ALERT_RUN_LIMIT?: string;
	AI_TOKEN_ALERT_RUN_LIMIT?: string;
	ARTICLE_PAGE_IMAGE_LOOKUP_LIMIT?: string;
	ENABLED_SUMMARY_LANGUAGES?: string;
	SUMMARY_TRANSLATION_LIMIT?: string;
	HOLD_ARTICLES_FOR_TRANSLATIONS?: string;
	NUTSNEWS_KV?: KVNamespace;
	KV_RECENT_PROCESSED_URL_LIMIT?: string;
	UPSTASH_REDIS_REST_URL?: MaybeSecretBinding;
	UPSTASH_REDIS_REST_TOKEN?: MaybeSecretBinding;
	UPSTASH_REDIS_ENABLED?: string;
	UPSTASH_REDIS_WORKER_LOCK_TTL_SECONDS?: string;
	UPSTASH_REDIS_AI_REVIEW_LOCK_TTL_SECONDS?: string;
	UPSTASH_REDIS_MANUAL_RATE_LIMIT_MAX?: string;
	UPSTASH_REDIS_MANUAL_RATE_LIMIT_WINDOW_SECONDS?: string;
	UPSTASH_REDIS_COUNTER_TTL_SECONDS?: string;
};

type RuntimeConfig = {
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	openAiApiKey: string;
	aiProvider: AiProvider;
	localAiUrl: string;
	localAiApiKey: string;
	localAiModel: string;
	aiProviderFallbackToOpenAi: boolean;
	aiReviewConcurrency: number;
	openAiInputCostPer1MTokens: number;
	openAiOutputCostPer1MTokens: number;
	aiCostAlertRunUsd: number;
	aiReviewAlertRunLimit: number;
	aiTokenAlertRunLimit: number;
	articlePageImageLookupLimit: number;
	enabledSummaryLanguages: SummaryLanguageCode[];
	summaryTranslationLimit: number;
	holdArticlesForTranslations: boolean;
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
	feedResults: FeedFetchResult[];
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
	decision: 'accept' | 'reject';
	category: string;
	positivity_score: number;
	summary: string;
	reason: string;
};

type SummaryLanguageCode = 'fr' | 'ja' | 'de-CH' | 'de' | 'el';

type LocalizedSummaryDecision = {
	language_code: SummaryLanguageCode;
	title: string;
	summary: string;
};

type ReviewedUrlRow = {
	original_url: string;
	decision: 'accept' | 'reject';
	reason: string | null;
	reviewed_at: string | null;
};

type PublishedArticleUrlRow = {
	original_url: string;
};

type FeedHealthSnapshotRow = {
	feed_url: string;
	consecutive_failure_count: number | null;
	total_fetch_count: number | null;
	total_success_count: number | null;
	total_failure_count: number | null;
	total_article_count: number | null;
	total_image_count: number | null;
	total_accepted_count: number | null;
	total_rejected_count: number | null;
	last_success_at: string | null;
	last_failure_at: string | null;
};

type FeedHealthUpsert = {
	source: string;
	feed_url: string;
	last_checked_at: string;
	last_success_at: string | null;
	last_failure_at: string | null;
	last_status: number | null;
	last_error_message: string | null;
	last_article_count: number;
	last_image_count: number;
	last_accepted_count: number;
	last_rejected_count: number;
	consecutive_failure_count: number;
	total_fetch_count: number;
	total_success_count: number;
	total_failure_count: number;
	total_article_count: number;
	total_image_count: number;
	total_accepted_count: number;
	total_rejected_count: number;
	updated_at: string;
};

type FeedOutcomeCounts = {
	accepted: number;
	rejected: number;
};

type ArticleReviewInsert = {
	original_url: string;
	source: string;
	title: string;
	decision: 'accept' | 'reject';
	category: string;
	positivity_score: number;
	summary: string;
	reason: string;
	ai_provider: ReviewProvider;
	ai_model: string;
	review_duration_ms: number;
	reviewed_at: string;
};

type ArticleStatus = 'published' | 'translation_pending';

type ArticleSummarySourceArticle = {
	source: string;
	title: string;
	original_url: string;
	ai_summary: string;
	category: string;
	published_on_site_at?: string | null;
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
	ai_provider: ReviewProvider;
	ai_model: string;
	status: ArticleStatus;
};

type ArticleSummaryInsert = {
	original_url: string;
	language_code: SummaryLanguageCode;
	source_language_code: 'en';
	title: string;
	summary: string;
	generated_by: 'openai' | 'local';
	model: string;
	updated_at: string;
};

type ArticleSummaryFailureSample = {
	originalUrl: string;
	title: string;
	languageCode: SummaryLanguageCode;
	taskSource: 'new_article' | 'recovery';
	providerOrder: AiProvider[];
	errorMessage: string;
};

type ArticleSummarySaveErrorSample = {
	status: number | null;
	errorText: string;
	summaryCount: number;
	languageCodes: SummaryLanguageCode[];
	sampleOriginalUrls: string[];
	durationMs: number;
};

type ArticleSummarySaveResult = {
	ok: boolean;
	errorSamples: ArticleSummarySaveErrorSample[];
};

type RefreshOptions = {
	maxAiReviews?: number;
	imageLookupLimit?: number;
	runSource?: 'manual' | 'scheduled' | 'unknown';
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
	aiProvider: AiProvider;
	aiModel: string;
	durationMs: number;
};

type ReviewedArticleResult = {
	article: RssArticle;
	aiDecision: AiArticleDecision;
	usage?: OpenAiUsage;
	estimatedCostUsd?: number;
	aiProvider?: ReviewProvider;
	aiModel?: string;
	reviewDurationMs?: number;
};

type ImageHydrationResult = {
	articles: RssArticle[];
	lookupCount: number;
	foundCount: number;
};

type AiUsageRunInsert = {
	run_started_at: string;
	run_completed_at: string;
	run_source: 'manual' | 'scheduled' | 'unknown';
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
	ai_provider: AiProvider;
	local_ai_model: string;
	local_ai_call_count: number;
	local_ai_prompt_tokens: number;
	local_ai_completion_tokens: number;
	local_ai_total_tokens: number;
	local_ai_accepted_count: number;
	local_ai_rejected_count: number;
	local_ai_duration_ms: number;
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
	run_source: 'manual' | 'scheduled' | 'unknown';
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
	articlePageImageLookupLimit: number;
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
	aiProvider: AiProvider;
	aiReviewProviderOrder: AiProvider[];
	localAiConfigured: boolean;
	openAiFallbackEnabled: boolean;
	localAiModel: string;
	localAiCallCount: number;
	localAiPromptTokens: number;
	localAiCompletionTokens: number;
	localAiTotalTokens: number;
	localAiAcceptedCount: number;
	localAiRejectedCount: number;
	localAiDurationMs: number;
	acceptedCount: number;
	rejectedCount: number;
	reviewSaveOk: boolean;
	articleSaveOk: boolean;
	articleSummaryTranslationCount: number;
	articleSummaryTranslationTaskBudget: number;
	articleSummaryLocalTranslationCount: number;
	articleSummaryOpenAiTranslationCount: number;
	translationProviderOrder: AiProvider[];
	articleSummaryAttemptedTaskCount: number;
	articleSummaryFailedTaskCount: number;
	articleSummaryFailureSamples: ArticleSummaryFailureSample[];
	articleSummarySkippedByLimitArticleCount: number;
	articleSummarySkippedByLimitLanguageTaskCount: number;
	articleSummarySaveOk: boolean;
	articleSummarySaveErrorSamples: ArticleSummarySaveErrorSample[];
	articleSummaryRecoveryCandidateCount: number;
	articleSummaryRecoveryAttemptedTaskCount: number;
	articleSummaryPublishCount: number;
	articleSummaryPublishOk: boolean;
	publicFeedSnapshotRefreshOk: boolean;
	feedHealthSaveOk: boolean;
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
	kvEnabled: boolean;
	kvProcessedUrlHitCount: number;
	kvProcessedUrlSaveOk: boolean;
	kvRunStateSaveOk: boolean;
	redisEnabled: boolean;
	redisAiReviewLockAcquiredCount: number;
	redisAiReviewLockSkippedCount: number;
	redisStatsSaveOk: boolean;
	durationMs: number;
};


type WorkerRequestMode = 'refresh' | 'translate-backlog';

type TranslationBacklogResult = {
	message: string;
	shardIndex: number;
	enabledSummaryLanguages: SummaryLanguageCode[];
	summaryTranslationLimit: number;
	articleSummaryTranslationTaskBudget: number;
	articleSummaryTranslationCount: number;
	articleSummaryLocalTranslationCount: number;
	articleSummaryOpenAiTranslationCount: number;
	translationProviderOrder: AiProvider[];
	articleSummaryAttemptedTaskCount: number;
	articleSummaryFailedTaskCount: number;
	articleSummaryFailureSamples: ArticleSummaryFailureSample[];
	articleSummaryRecoveryCandidateCount: number;
	articleSummaryRecoveryAttemptedTaskCount: number;
	articleSummarySaveOk: boolean;
	articleSummarySaveErrorSamples: ArticleSummarySaveErrorSample[];
	articleSummaryPublishCount: number;
	articleSummaryPublishOk: boolean;
	publicFeedSnapshotRefreshOk: boolean;
	durationMs: number;
};

const MAX_ITEMS_PER_FEED = 35;
const MAX_CANDIDATES_PER_RUN = 300;
const DEFAULT_MAX_AI_REVIEWS_PER_RUN = 12;
const HARD_MAX_AI_REVIEWS_PER_RUN = 18;
const AI_REVIEW_CONCURRENCY = 3;
const REVIEWED_URL_LOOKBACK_LIMIT = 5000;
const PUBLISHED_URL_LOOKBACK_LIMIT = 5000;
const DEFAULT_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN = 6;
const HARD_MAX_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN = 8;
const ARTICLE_PAGE_IMAGE_LOOKUP_CONCURRENCY = 3;
const MAX_ESTIMATED_SUBREQUESTS_PER_RUN = 48;
const RESERVED_NON_FEED_SUBREQUESTS_PER_RUN = 10;
const NO_THUMBNAIL_RETRY_AFTER_HOURS = 6;
const MAX_RESPONSE_ERROR_TEXT_LENGTH = 500;
const AI_SUMMARY_MAX_CHARS = 250;
const TRUNCATED_TEXT_SUFFIX = '... [truncated]';

const OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_LOCAL_AI_MODEL = 'qwen2.5:3b';
const DEFAULT_LOCAL_AI_TIMEOUT_MS = 120000;
const DEFAULT_OPENAI_INPUT_COST_PER_1M_TOKENS = 0.15;
const DEFAULT_OPENAI_OUTPUT_COST_PER_1M_TOKENS = 0.6;
const DEFAULT_AI_COST_ALERT_RUN_USD = 0.05;
const DEFAULT_AI_REVIEW_ALERT_RUN_LIMIT = 12;
const DEFAULT_AI_TOKEN_ALERT_RUN_LIMIT = 50000;
const DEFAULT_ENABLED_SUMMARY_LANGUAGES = 'fr,ja,de-CH,de,el';
const DEFAULT_SUMMARY_TRANSLATION_LIMIT = 5;
const HARD_MAX_SUMMARY_TRANSLATION_LIMIT = 18;
const HARD_MAX_SUMMARY_TRANSLATION_TASKS_PER_RUN = 5;
const SUMMARY_TRANSLATION_RECOVERY_LOOKBACK_LIMIT = 80;
const SUMMARY_TRANSLATION_RETRY_ATTEMPTS = 2;
const SUMMARY_TRANSLATION_RETRY_DELAY_MS = 750;
const AI_REVIEW_RETRY_ATTEMPTS = 2;
const AI_REVIEW_RETRY_DELAY_MS = 750;
const KV_RECENT_PROCESSED_URL_KEY_VERSION = 1;
const DEFAULT_KV_RECENT_PROCESSED_URL_LIMIT = 2000;
const HARD_MAX_KV_RECENT_PROCESSED_URL_LIMIT = 5000;
const KV_RECENT_PROCESSED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
const KV_RUN_STATE_TTL_SECONDS = 14 * 24 * 60 * 60;
const DEFAULT_UPSTASH_REDIS_WORKER_LOCK_TTL_SECONDS = 10 * 60;
const DEFAULT_UPSTASH_REDIS_AI_REVIEW_LOCK_TTL_SECONDS = 30 * 60;
const DEFAULT_UPSTASH_REDIS_MANUAL_RATE_LIMIT_MAX = 20;
const DEFAULT_UPSTASH_REDIS_MANUAL_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const DEFAULT_UPSTASH_REDIS_COUNTER_TTL_SECONDS = 3 * 24 * 60 * 60;
const HARD_MAX_UPSTASH_REDIS_LOCK_TTL_SECONDS = 60 * 60;
const HARD_MAX_UPSTASH_REDIS_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;


const POSITIVE_KEYWORDS = [
	'good news',
	'uplifting',
	'inspiring',
	'inspired',
	'kindness',
	'rescue',
	'rescued',
	'reunited',
	'reunion',
	'community',
	'volunteer',
	'volunteers',
	'donation',
	'donated',
	'helping',
	'helps',
	'hero',
	'heroes',
	'achievement',
	'breakthrough',
	'discovery',
	'restored',
	'restoration',
	'recover',
	'recovered',
	'healing',
	'wellness',
	'healthier',
	'happiness',
	'joy',
	'celebrate',
	'celebration',
	'wins',
	'award',
	'remarkable',
	'rare',
	'beautiful',
	'travel',
	'animals',
	'wildlife',
	'conservation',
	'garden',
	'nature',
	'science',
	'space',
	'students',
	'teacher',
	'school',
	'family',
	'friendship',
	'creative',
	'art',
	'music',
	'culture',
	'environment',
	'climate solution',
	'clean energy',
	'ocean cleanup',
	'forest',
	'tree',
	'trees',
	'young people',
	'kids',
	'children',
	'happiest',
	'hope',
	'hopeful',
];

const NEGATIVE_KEYWORDS = [
	'politics',
	'election',
	'president',
	'minister',
	'government',
	'senate',
	'congress',
	'parliament',
	'war',
	'military',
	'missile',
	'attack',
	'attacks',
	'killed',
	'dead',
	'death',
	'dies',
	'murder',
	'crime',
	'criminal',
	'shooting',
	'violence',
	'violent',
	'crash',
	'disaster',
	'tragedy',
	'tragic',
	'lawsuit',
	'court',
	'trial',
	'stocks',
	'market',
	'markets',
	'inflation',
	'recession',
	'tariff',
	'economy',
	'business',
	'money',
	'bank',
	'earnings',
	'profit',
	'losses',
	'layoffs',
	'fired',
];

const STRICT_LOCAL_PREFILTER_SOURCES = new Set(['NPR', 'BBC Stories']);

const HARD_NEGATIVE_KEYWORDS = [
	'politics',
	'political',
	'election',
	'elections',
	'campaign',
	'vote',
	'voters',
	'president',
	'minister',
	'government',
	'congress',
	'senate',
	'parliament',
	'democrat',
	'republican',
	'trump',
	'biden',
	'court',
	'supreme court',
	'judge',
	'lawsuit',
	'trial',
	'charges',
	'charged',
	'convicted',
	'prison',
	'war',
	'military',
	'missile',
	'bomb',
	'attack',
	'attacks',
	'hostage',
	'killed',
	'dead',
	'death',
	'dies',
	'murder',
	'shooting',
	'gun',
	'crime',
	'criminal',
	'violence',
	'violent',
	'abuse',
	'crash',
	'disaster',
	'tragedy',
	'tragic',
	'hurricane',
	'flood',
	'wildfire',
	'earthquake',
	'stocks',
	'stock market',
	'market',
	'markets',
	'inflation',
	'recession',
	'tariff',
	'economy',
	'business',
	'money',
	'bank',
	'earnings',
	'profit',
	'losses',
	'layoffs',
	'fired',
];

const HARD_POSITIVE_ESCAPE_KEYWORDS = [
	'rescue',
	'rescued',
	'reunited',
	'reunion',
	'healing',
	'recovered',
	'recovery',
	'breakthrough',
	'discovery',
	'donation',
	'donated',
	'volunteer',
	'volunteers',
	'kindness',
	'community',
	'hero',
	'heroes',
	'saved',
	'restored',
	'restoration',
	'conservation',
	'wildlife',
	'garden',
	'school',
	'students',
	'teacher',
	'science',
	'space',
	'nasa',
	'art',
	'music',
	'creative',
	'achievement',
	'award',
	'celebrate',
	'celebration',
	'hope',
	'hopeful',
];

const LOCAL_PREFILTER_REJECT_DECISION: AiArticleDecision = {
	decision: 'reject',
	category: 'Uplifting',
	positivity_score: 0,
	summary: '',
	reason: 'Skipped before AI because the article matched hard negative local filters.',
};

const NO_THUMBNAIL_REJECT_DECISION: AiArticleDecision = {
	decision: 'reject',
	category: 'Uplifting',
	positivity_score: 0,
	summary: '',
	reason: 'Skipped before AI because the RSS item and article page did not include a usable image thumbnail.',
};

type RecentProcessedUrlCache = {
	version: typeof KV_RECENT_PROCESSED_URL_KEY_VERSION;
	shardIndex: number;
	updatedAt: string;
	hashes: string[];
};

type KvProcessedUrlLookupResult = {
	urls: Set<string>;
	hitCount: number;
	cacheAvailable: boolean;
};

type KvRunState = {
	version: 1;
	updatedAt: string;
	runStartedAt: string;
	runCompletedAt: string;
	runSource: RefreshOptions['runSource'];
	requestId: string | null;
	result: RefreshResult;
};

type UpstashRedisConfig = {
	restUrl: string;
	restToken: string;
};

type UpstashRedisCommandArg = string | number;

type UpstashRedisCommandResult<T = unknown> = {
	result?: T;
	error?: string;
};

type RedisLock = {
	key: string;
	value: string;
	acquired: boolean;
	enabled: boolean;
};

type RedisRateLimitResult = {
	allowed: boolean;
	count: number;
	limit: number;
	windowSeconds: number;
	enabled: boolean;
};

type RedisAiReviewLockResult = {
	articles: RssArticle[];
	acquiredCount: number;
	skippedCount: number;
	enabled: boolean;
};

function isKvEnabled(env: Env) {
	return Boolean(env.NUTSNEWS_KV);
}

function getKvRecentProcessedUrlLimit(env: Env) {
	return Math.min(
		Math.max(Math.floor(getOptionalNumber(env.KV_RECENT_PROCESSED_URL_LIMIT, DEFAULT_KV_RECENT_PROCESSED_URL_LIMIT)), 100),
		HARD_MAX_KV_RECENT_PROCESSED_URL_LIMIT,
	);
}

function getShardProcessedUrlCacheKey(shardIndex: number) {
	return `dedupe:shard:${shardIndex}:recent-processed-urls:v${KV_RECENT_PROCESSED_URL_KEY_VERSION}`;
}

function getShardRunStateKey(shardIndex: number) {
	return `state:shard:${shardIndex}:latest-run:v1`;
}

function getLastSuccessfulRunStateKey() {
	return 'state:last-successful-run:v1';
}

async function sha256Hex(value: string) {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function hashUrlForKv(url: string) {
	return sha256Hex(url.trim().toLowerCase());
}

async function readJsonFromKv<T>(env: Env, key: string): Promise<T | null> {
	if (!env.NUTSNEWS_KV) {
		return null;
	}

	try {
		return await env.NUTSNEWS_KV.get<T>(key, 'json');
	} catch (error) {
		await logWarn(env, 'worker.kv.read_failed', 'Cloudflare KV read failed', {
			key,
			errorMessage: getErrorMessage(error),
		});

		return null;
	}
}

async function writeJsonToKv(env: Env, key: string, value: unknown, expirationTtl: number): Promise<boolean> {
	if (!env.NUTSNEWS_KV) {
		return false;
	}

	try {
		await env.NUTSNEWS_KV.put(key, JSON.stringify(value), { expirationTtl });
		return true;
	} catch (error) {
		await logWarn(env, 'worker.kv.write_failed', 'Cloudflare KV write failed', {
			key,
			errorMessage: getErrorMessage(error),
		});

		return false;
	}
}

async function getProcessedUrlsFromKv(env: Env, shardIndex: number, urls: string[]): Promise<KvProcessedUrlLookupResult> {
	if (!env.NUTSNEWS_KV || urls.length === 0) {
		return {
			urls: new Set(),
			hitCount: 0,
			cacheAvailable: Boolean(env.NUTSNEWS_KV),
		};
	}

	const cache = await readJsonFromKv<RecentProcessedUrlCache>(env, getShardProcessedUrlCacheKey(shardIndex));

	if (!cache || cache.version !== KV_RECENT_PROCESSED_URL_KEY_VERSION || !Array.isArray(cache.hashes)) {
		return {
			urls: new Set(),
			hitCount: 0,
			cacheAvailable: true,
		};
	}

	const knownHashes = new Set(cache.hashes);
	const urlsByHash = await Promise.all(urls.map(async (url) => [url, await hashUrlForKv(url)] as const));
	const processedUrls = new Set(urlsByHash.filter(([, hash]) => knownHashes.has(hash)).map(([url]) => url));

	return {
		urls: processedUrls,
		hitCount: processedUrls.size,
		cacheAvailable: true,
	};
}

async function rememberProcessedUrlsInKv(env: Env, shardIndex: number, urls: string[]): Promise<boolean> {
	if (!env.NUTSNEWS_KV || urls.length === 0) {
		return false;
	}

	const key = getShardProcessedUrlCacheKey(shardIndex);
	const existingCache = await readJsonFromKv<RecentProcessedUrlCache>(env, key);
	const existingHashes =
		existingCache?.version === KV_RECENT_PROCESSED_URL_KEY_VERSION && Array.isArray(existingCache.hashes)
			? existingCache.hashes
			: [];
	const nextHashes = new Set(existingHashes);
	const hashedUrls = await Promise.all(urls.map(hashUrlForKv));

	for (const hash of hashedUrls) {
		nextHashes.add(hash);
	}

	const maxHashes = getKvRecentProcessedUrlLimit(env);
	const compactHashes = Array.from(nextHashes).slice(-maxHashes);
	const nextCache: RecentProcessedUrlCache = {
		version: KV_RECENT_PROCESSED_URL_KEY_VERSION,
		shardIndex,
		updatedAt: new Date().toISOString(),
		hashes: compactHashes,
	};

	return writeJsonToKv(env, key, nextCache, KV_RECENT_PROCESSED_URL_TTL_SECONDS);
}

async function saveRunStateToKv(
	env: Env,
	result: RefreshResult,
	metadata: {
		runStartedAt: number;
		runCompletedAt: Date;
		runSource: RefreshOptions['runSource'];
		requestId: string | null;
	},
): Promise<boolean> {
	if (!env.NUTSNEWS_KV) {
		return false;
	}

	const state: KvRunState = {
		version: 1,
		updatedAt: new Date().toISOString(),
		runStartedAt: new Date(metadata.runStartedAt).toISOString(),
		runCompletedAt: metadata.runCompletedAt.toISOString(),
		runSource: metadata.runSource,
		requestId: metadata.requestId,
		result,
	};

	const shardStateOk = await writeJsonToKv(env, getShardRunStateKey(result.shardIndex), state, KV_RUN_STATE_TTL_SECONDS);
	const lastSuccessfulRunOk = await writeJsonToKv(env, getLastSuccessfulRunStateKey(), state, KV_RUN_STATE_TTL_SECONDS);

	return shardStateOk && lastSuccessfulRunOk;
}

async function readKvStatus(env: Env) {
	const shardIndex = getShardIndex(env);
	const [latestShardRun, lastSuccessfulRun, recentProcessedUrlCache] = await Promise.all([
		readJsonFromKv<KvRunState>(env, getShardRunStateKey(shardIndex)),
		readJsonFromKv<KvRunState>(env, getLastSuccessfulRunStateKey()),
		readJsonFromKv<RecentProcessedUrlCache>(env, getShardProcessedUrlCacheKey(shardIndex)),
	]);

	return {
		kvEnabled: isKvEnabled(env),
		shardIndex,
		latestShardRun,
		lastSuccessfulRun,
		recentProcessedUrlCache: recentProcessedUrlCache
			? {
					version: recentProcessedUrlCache.version,
					shardIndex: recentProcessedUrlCache.shardIndex,
					updatedAt: recentProcessedUrlCache.updatedAt,
					hashCount: recentProcessedUrlCache.hashes.length,
				}
			: null,
	};
}

function isUpstashRedisExplicitlyDisabled(env: Env) {
	return env.UPSTASH_REDIS_ENABLED ? ['0', 'false', 'no', 'off'].includes(env.UPSTASH_REDIS_ENABLED.toLowerCase()) : false;
}

function clampPositiveNumber(value: string | undefined, fallback: number, max: number) {
	const parsed = Math.floor(getOptionalNumber(value, fallback));

	return Math.max(1, Math.min(parsed, max));
}

function getUpstashRedisWorkerLockTtlSeconds(env: Env) {
	return clampPositiveNumber(
		env.UPSTASH_REDIS_WORKER_LOCK_TTL_SECONDS,
		DEFAULT_UPSTASH_REDIS_WORKER_LOCK_TTL_SECONDS,
		HARD_MAX_UPSTASH_REDIS_LOCK_TTL_SECONDS,
	);
}

function getUpstashRedisAiReviewLockTtlSeconds(env: Env) {
	return clampPositiveNumber(
		env.UPSTASH_REDIS_AI_REVIEW_LOCK_TTL_SECONDS,
		DEFAULT_UPSTASH_REDIS_AI_REVIEW_LOCK_TTL_SECONDS,
		HARD_MAX_UPSTASH_REDIS_LOCK_TTL_SECONDS,
	);
}

function getUpstashRedisManualRateLimitMax(env: Env) {
	return clampPositiveNumber(env.UPSTASH_REDIS_MANUAL_RATE_LIMIT_MAX, DEFAULT_UPSTASH_REDIS_MANUAL_RATE_LIMIT_MAX, 500);
}

function getUpstashRedisManualRateLimitWindowSeconds(env: Env) {
	return clampPositiveNumber(
		env.UPSTASH_REDIS_MANUAL_RATE_LIMIT_WINDOW_SECONDS,
		DEFAULT_UPSTASH_REDIS_MANUAL_RATE_LIMIT_WINDOW_SECONDS,
		HARD_MAX_UPSTASH_REDIS_RATE_LIMIT_WINDOW_SECONDS,
	);
}

function getUpstashRedisCounterTtlSeconds(env: Env) {
	return clampPositiveNumber(env.UPSTASH_REDIS_COUNTER_TTL_SECONDS, DEFAULT_UPSTASH_REDIS_COUNTER_TTL_SECONDS, 14 * 24 * 60 * 60);
}

async function getUpstashRedisConfig(env: Env): Promise<UpstashRedisConfig | null> {
	if (isUpstashRedisExplicitlyDisabled(env)) {
		return null;
	}

	const restUrl = (await resolveValue(env.UPSTASH_REDIS_REST_URL)).trim().replace(/\/+$/, '');
	const restToken = (await resolveValue(env.UPSTASH_REDIS_REST_TOKEN)).trim();

	if (!restUrl || !restToken) {
		return null;
	}

	return {
		restUrl,
		restToken,
	};
}

async function isUpstashRedisEnabled(env: Env) {
	return Boolean(await getUpstashRedisConfig(env));
}

async function runUpstashRedisCommand<T = unknown>(
	env: Env,
	command: UpstashRedisCommandArg[],
	context: Record<string, unknown> = {},
): Promise<UpstashRedisCommandResult<T> | null> {
	const config = await getUpstashRedisConfig(env);

	if (!config) {
		return null;
	}

	const token = getSafeHeaderValue(config.restToken);

	if (!token) {
		await logWarn(env, 'worker.redis.invalid_token', 'Upstash Redis token is empty or invalid for an HTTP header', context);
		return null;
	}

	try {
		const response = await fetch(config.restUrl, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(command),
		});
		const body = (await response.json().catch(() => null)) as UpstashRedisCommandResult<T> | null;

		if (!response.ok || !body || body.error) {
			await logWarn(env, 'worker.redis.command_failed', 'Upstash Redis command failed', {
				...context,
				status: response.status,
				command: command[0],
				errorMessage: body?.error ?? 'Unable to parse Upstash Redis response.',
			});

			return null;
		}

		return body;
	} catch (error) {
		await logWarn(env, 'worker.redis.command_exception', 'Upstash Redis command threw an exception', {
			...context,
			command: command[0],
			errorMessage: getErrorMessage(error),
		});

		return null;
	}
}

async function runUpstashRedisPipeline(
	env: Env,
	commands: UpstashRedisCommandArg[][],
	context: Record<string, unknown> = {},
): Promise<UpstashRedisCommandResult[] | null> {
	const config = await getUpstashRedisConfig(env);

	if (!config || commands.length === 0) {
		return null;
	}

	const token = getSafeHeaderValue(config.restToken);

	if (!token) {
		await logWarn(env, 'worker.redis.invalid_token', 'Upstash Redis token is empty or invalid for an HTTP header', context);
		return null;
	}

	try {
		const response = await fetch(`${config.restUrl}/pipeline`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(commands),
		});
		const body = (await response.json().catch(() => null)) as UpstashRedisCommandResult[] | null;

		if (!response.ok || !Array.isArray(body) || body.some((item) => item.error)) {
			await logWarn(env, 'worker.redis.pipeline_failed', 'Upstash Redis pipeline failed', {
				...context,
				status: response.status,
				commandCount: commands.length,
				errorMessage: body?.find((item) => item.error)?.error ?? 'Unable to parse Upstash Redis pipeline response.',
			});

			return null;
		}

		return body;
	} catch (error) {
		await logWarn(env, 'worker.redis.pipeline_exception', 'Upstash Redis pipeline threw an exception', {
			...context,
			commandCount: commands.length,
			errorMessage: getErrorMessage(error),
		});

		return null;
	}
}

function getRedisWorkerLockKey(shardIndex: number) {
	return `nutsnews:worker-lock:shard:${shardIndex}:v1`;
}

function getRedisAiReviewLockKey(urlHash: string) {
	return `nutsnews:ai-review-lock:url:${urlHash}:v1`;
}

function getRedisManualRateLimitKey(clientId: string) {
	return `nutsnews:rate-limit:worker-manual:${clientId}:v1`;
}

function getRedisStatsDateKey(date = new Date()) {
	return date.toISOString().slice(0, 10);
}

async function acquireRedisLock(env: Env, key: string, value: string, ttlSeconds: number): Promise<RedisLock> {
	const enabled = await isUpstashRedisEnabled(env);

	if (!enabled) {
		return {
			key,
			value,
			acquired: true,
			enabled: false,
		};
	}

	const response = await runUpstashRedisCommand<string>(env, ['SET', key, value, 'NX', 'EX', ttlSeconds], { key });

	return {
		key,
		value,
		acquired: response?.result === 'OK',
		enabled: true,
	};
}

async function releaseRedisLock(env: Env, lock: RedisLock): Promise<boolean> {
	if (!lock.enabled || !lock.acquired) {
		return true;
	}

	const response = await runUpstashRedisCommand<number>(
		env,
		[
			'EVAL',
			"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
			1,
			lock.key,
			lock.value,
		],
		{ key: lock.key },
	);

	return response !== null;
}

async function acquireRedisWorkerRunLock(env: Env, requestId: string): Promise<RedisLock> {
	const shardIndex = getShardIndex(env);
	const key = getRedisWorkerLockKey(shardIndex);
	const value = `${requestId}:${Date.now()}`;

	return acquireRedisLock(env, key, value, getUpstashRedisWorkerLockTtlSeconds(env));
}

async function claimArticlesForAiReviewWithRedis(
	env: Env,
	articles: RssArticle[],
	maxClaimedArticles: number,
	requestId: string | null,
): Promise<RedisAiReviewLockResult> {
	const enabled = await isUpstashRedisEnabled(env);

	if (!enabled || articles.length === 0) {
		const selectedArticles = articles.slice(0, maxClaimedArticles);

		return {
			articles: selectedArticles,
			acquiredCount: enabled ? 0 : selectedArticles.length,
			skippedCount: 0,
			enabled,
		};
	}

	const ttlSeconds = getUpstashRedisAiReviewLockTtlSeconds(env);
	const claimedArticles: RssArticle[] = [];
	let skippedCount = 0;

	for (const article of articles) {
		if (claimedArticles.length >= maxClaimedArticles) {
			break;
		}

		const urlHash = await hashUrlForKv(article.url);
		const lock = await acquireRedisLock(env, getRedisAiReviewLockKey(urlHash), requestId ?? crypto.randomUUID(), ttlSeconds);

		if (lock.acquired) {
			claimedArticles.push(article);
		} else {
			skippedCount += 1;
		}
	}

	return {
		articles: claimedArticles,
		acquiredCount: claimedArticles.length,
		skippedCount,
		enabled: true,
	};
}

function getManualRateLimitClientId(request: Request) {
	const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown-ip';
	const userAgent = request.headers.get('user-agent') ?? 'unknown-agent';

	return `${ip}:${userAgent.slice(0, 80)}`;
}

async function checkManualRefreshRateLimit(env: Env, request: Request): Promise<RedisRateLimitResult> {
	const enabled = await isUpstashRedisEnabled(env);
	const limit = getUpstashRedisManualRateLimitMax(env);
	const windowSeconds = getUpstashRedisManualRateLimitWindowSeconds(env);

	if (!enabled) {
		return {
			allowed: true,
			count: 0,
			limit,
			windowSeconds,
			enabled: false,
		};
	}

	const clientHash = await sha256Hex(getManualRateLimitClientId(request));
	const key = getRedisManualRateLimitKey(clientHash);
	const incrementResponse = await runUpstashRedisCommand<number>(env, ['INCR', key], { key });
	const count = typeof incrementResponse?.result === 'number' ? incrementResponse.result : 0;

	if (count === 1) {
		await runUpstashRedisCommand(env, ['EXPIRE', key, windowSeconds], { key });
	}

	return {
		allowed: count === 0 || count <= limit,
		count,
		limit,
		windowSeconds,
		enabled: true,
	};
}

async function recordRedisWorkerStats(
	env: Env,
	result: Pick<RefreshResult, 'aiReviewedCount' | 'acceptedCount' | 'rejectedCount'>,
	runSource: RefreshOptions['runSource'],
): Promise<boolean> {
	const enabled = await isUpstashRedisEnabled(env);

	if (!enabled) {
		return false;
	}

	const dateKey = getRedisStatsDateKey();
	const ttlSeconds = getUpstashRedisCounterTtlSeconds(env);
	const keysAndIncrements: Array<[string, number]> = [
		[`nutsnews:stats:${dateKey}:worker-runs:${runSource ?? 'unknown'}:v1`, 1],
		[`nutsnews:stats:${dateKey}:ai-reviewed:v1`, result.aiReviewedCount],
		[`nutsnews:stats:${dateKey}:accepted:v1`, result.acceptedCount],
		[`nutsnews:stats:${dateKey}:rejected:v1`, result.rejectedCount],
	];
	const commands = keysAndIncrements.flatMap(([key, increment]) => [
		['INCRBY', key, increment] as UpstashRedisCommandArg[],
		['EXPIRE', key, ttlSeconds] as UpstashRedisCommandArg[],
	]);

	const response = await runUpstashRedisPipeline(env, commands, {
		event: 'record_worker_stats',
		dateKey,
		runSource,
	});

	return response !== null;
}

async function recordRedisWorkerFailure(env: Env, runSource: RefreshOptions['runSource']): Promise<boolean> {
	const enabled = await isUpstashRedisEnabled(env);

	if (!enabled) {
		return false;
	}

	const dateKey = getRedisStatsDateKey();
	const key = `nutsnews:stats:${dateKey}:worker-failures:${runSource ?? 'unknown'}:v1`;
	const ttlSeconds = getUpstashRedisCounterTtlSeconds(env);
	const response = await runUpstashRedisPipeline(
		env,
		[
			['INCRBY', key, 1],
			['EXPIRE', key, ttlSeconds],
		],
		{ event: 'record_worker_failure', dateKey, runSource },
	);

	return response !== null;
}

async function readRedisStatus(env: Env) {
	const enabled = await isUpstashRedisEnabled(env);
	const dateKey = getRedisStatsDateKey();
	const shardIndex = getShardIndex(env);

	if (!enabled) {
		return {
			redisEnabled: false,
			message: 'Upstash Redis is not configured for this Worker.',
			shardIndex,
		};
	}

	const ping = await runUpstashRedisCommand<string>(env, ['PING'], { event: 'redis_status_ping' });
	const counters = await runUpstashRedisPipeline(
		env,
		[
			['GET', `nutsnews:stats:${dateKey}:worker-runs:manual:v1`],
			['GET', `nutsnews:stats:${dateKey}:worker-runs:scheduled:v1`],
			['GET', `nutsnews:stats:${dateKey}:ai-reviewed:v1`],
			['GET', `nutsnews:stats:${dateKey}:accepted:v1`],
			['GET', `nutsnews:stats:${dateKey}:rejected:v1`],
		],
		{ event: 'redis_status_counters', dateKey },
	);

	return {
		redisEnabled: true,
		ping: ping?.result ?? null,
		shardIndex,
		dateKey,
		workerLockKey: getRedisWorkerLockKey(shardIndex),
		counters: {
			manualRunsToday: counters?.[0]?.result ?? null,
			scheduledRunsToday: counters?.[1]?.result ?? null,
			aiReviewedToday: counters?.[2]?.result ?? null,
			acceptedToday: counters?.[3]?.result ?? null,
			rejectedToday: counters?.[4]?.result ?? null,
		},
		settings: {
			workerLockTtlSeconds: getUpstashRedisWorkerLockTtlSeconds(env),
			aiReviewLockTtlSeconds: getUpstashRedisAiReviewLockTtlSeconds(env),
			manualRateLimitMax: getUpstashRedisManualRateLimitMax(env),
			manualRateLimitWindowSeconds: getUpstashRedisManualRateLimitWindowSeconds(env),
			counterTtlSeconds: getUpstashRedisCounterTtlSeconds(env),
		},
	};
}

async function resolveValue(value: MaybeSecretBinding) {
	if (!value) {
		return '';
	}

	if (typeof value === 'string') {
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

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayBeforeRetry(attempt: number) {
	if (attempt < SUMMARY_TRANSLATION_RETRY_ATTEMPTS) {
		await sleep(SUMMARY_TRANSLATION_RETRY_DELAY_MS * attempt);
	}
}

async function delayBeforeAiReviewRetry(attempt: number) {
	if (attempt < AI_REVIEW_RETRY_ATTEMPTS) {
		await sleep(AI_REVIEW_RETRY_DELAY_MS * attempt);
	}
}

function emptyOpenAiUsage(): OpenAiUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
	};
}

function estimateOpenAiCost(usage: OpenAiUsage, config: RuntimeConfig) {
	const inputCost = (usage.promptTokens / 1_000_000) * config.openAiInputCostPer1MTokens;
	const outputCost = (usage.completionTokens / 1_000_000) * config.openAiOutputCostPer1MTokens;

	return inputCost + outputCost;
}

function getSafeHeaderValue(value: string) {
	const trimmed = value.trim();

	if (!trimmed || /[\r\n\0]/.test(trimmed)) {
		return null;
	}

	return trimmed;
}

function describeLocalAiEndpoint(localAiUrl: string) {
	if (!localAiUrl) {
		return null;
	}

	try {
		const url = new URL(localAiUrl);

		return {
			parseable: true,
			origin: url.origin,
			pathname: url.pathname || '/',
			protocol: url.protocol,
			host: url.host,
		};
	} catch {
		return {
			parseable: false,
			length: localAiUrl.length,
		};
	}
}

function normalizeOpenAiUsage(value: unknown): OpenAiUsage {
	if (!value || typeof value !== 'object') {
		return emptyOpenAiUsage();
	}

	const record = value as Record<string, unknown>;

	const promptTokens = typeof record.prompt_tokens === 'number' ? record.prompt_tokens : 0;
	const completionTokens = typeof record.completion_tokens === 'number' ? record.completion_tokens : 0;
	const totalTokens = typeof record.total_tokens === 'number' ? record.total_tokens : promptTokens + completionTokens;

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
	aiProvider: AiProvider,
	aiModel: string,
	durationMs: number,
): AiClassificationResult {
	return {
		aiDecision,
		usage,
		estimatedCostUsd: aiProvider === 'openai' ? estimateOpenAiCost(usage, config) : 0,
		aiProvider,
		aiModel,
		durationMs,
	};
}

function sumProviderUsage(reviewedArticles: ReviewedArticleResult[], provider: AiProvider) {
	return reviewedArticles.reduce((total, reviewedArticle) => {
		if (reviewedArticle.aiProvider !== provider || !reviewedArticle.usage) {
			return total;
		}

		return {
			promptTokens: total.promptTokens + reviewedArticle.usage.promptTokens,
			completionTokens: total.completionTokens + reviewedArticle.usage.completionTokens,
			totalTokens: total.totalTokens + reviewedArticle.usage.totalTokens,
		};
	}, emptyOpenAiUsage());
}

function sumOpenAiUsage(reviewedArticles: ReviewedArticleResult[]) {
	return sumProviderUsage(reviewedArticles, 'openai');
}

function sumLocalAiUsage(reviewedArticles: ReviewedArticleResult[]) {
	return sumProviderUsage(reviewedArticles, 'local');
}

function sumReviewDuration(reviewedArticles: ReviewedArticleResult[], provider: AiProvider) {
	return reviewedArticles.reduce((total, reviewedArticle) => {
		if (reviewedArticle.aiProvider !== provider) {
			return total;
		}

		return total + (reviewedArticle.reviewDurationMs ?? 0);
	}, 0);
}

function shouldTriggerOpenAiUsageWarning(run: AiUsageRunInsert, config: RuntimeConfig) {
	return (
		run.cost_protection_limit_reached ||
		run.ai_reviewed_count >= config.aiReviewAlertRunLimit ||
		run.estimated_openai_cost_usd >= config.aiCostAlertRunUsd ||
		run.openai_total_tokens >= config.aiTokenAlertRunLimit
	);
}

function getAiProvider(value: string | undefined): AiProvider {
	return value?.toLowerCase() === 'local' ? 'local' : 'openai';
}

const SUMMARY_LANGUAGE_NAMES: Record<SummaryLanguageCode, string> = {
	fr: 'French',
	ja: 'Japanese',
	'de-CH': 'Swiss German',
	de: 'German',
	el: 'Greek',
};

function normalizeSummaryLanguageCode(value: string): SummaryLanguageCode | null {
	const normalizedValue = value.trim();

	if (!normalizedValue) {
		return null;
	}

	const lowerValue = normalizedValue.toLowerCase();

	if (lowerValue === 'de-ch' || lowerValue === 'de_ch' || lowerValue === 'ch' || lowerValue === 'swiss') {
		return 'de-CH';
	}

	if (lowerValue === 'fr' || lowerValue === 'ja' || lowerValue === 'de' || lowerValue === 'el') {
		return lowerValue;
	}

	return null;
}

function isSummaryLanguageCode(value: string): value is SummaryLanguageCode {
	return normalizeSummaryLanguageCode(value) === value;
}

function getSummaryLanguageName(languageCode: SummaryLanguageCode) {
	return SUMMARY_LANGUAGE_NAMES[languageCode];
}

function getEnabledSummaryLanguages(value: string | undefined): SummaryLanguageCode[] {
	const rawValue = value?.trim() || DEFAULT_ENABLED_SUMMARY_LANGUAGES;

	if (['', 'none', 'off', 'false', '0'].includes(rawValue.toLowerCase())) {
		return [];
	}

	const languages = rawValue
		.split(',')
		.map((language) => normalizeSummaryLanguageCode(language))
		.filter((language): language is SummaryLanguageCode => Boolean(language));

	return Array.from(new Set(languages));
}

function getSummaryTranslationLimit(value: string | undefined) {
	const parsed = Number(value ?? '');

	if (!Number.isFinite(parsed) || parsed < 0) {
		return DEFAULT_SUMMARY_TRANSLATION_LIMIT;
	}

	return Math.max(0, Math.min(Math.floor(parsed), HARD_MAX_SUMMARY_TRANSLATION_LIMIT));
}

function getBooleanConfig(value: string | undefined, fallback = false) {
	if (!value) {
		return fallback;
	}

	return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function getAiReviewConcurrency(value: string | undefined, provider: AiProvider) {
	const fallback = provider === 'local' ? 1 : AI_REVIEW_CONCURRENCY;
	const parsed = Number(value ?? '');

	if (!Number.isFinite(parsed) || parsed < 1) {
		return fallback;
	}

	return Math.max(1, Math.min(Math.floor(parsed), AI_REVIEW_CONCURRENCY));
}

async function getRuntimeConfig(env: Env): Promise<RuntimeConfig> {
	const supabaseUrl = await resolveValue(env.SUPABASE_URL);
	const supabaseServiceRoleKey = await resolveValue(env.SUPABASE_SERVICE_ROLE_KEY);
	const openAiApiKey = await resolveValue(env.OPENAI_API_KEY);
	const aiProvider = getAiProvider(env.AI_PROVIDER);
	const localAiUrl = await resolveValue(env.LOCAL_AI_URL);
	const localAiApiKey = await resolveValue(env.LOCAL_AI_API_KEY);
	const localAiModel = env.LOCAL_AI_MODEL?.trim() || DEFAULT_LOCAL_AI_MODEL;
	const aiProviderFallbackToOpenAi = getBooleanConfig(env.AI_PROVIDER_FALLBACK_TO_OPENAI, true);

	if (!supabaseUrl) {
		throw new Error('Missing SUPABASE_URL secret.');
	}

	if (!supabaseServiceRoleKey) {
		throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY secret.');
	}

	if (!openAiApiKey && !localAiUrl) {
		throw new Error('Missing AI provider secrets. Set OPENAI_API_KEY, or set LOCAL_AI_URL + LOCAL_AI_API_KEY.');
	}

	if (localAiUrl && !localAiApiKey && !openAiApiKey) {
		throw new Error('Missing LOCAL_AI_API_KEY secret or environment variable.');
	}

	if (!openAiApiKey && (!localAiUrl || !localAiApiKey)) {
		throw new Error('Missing OPENAI_API_KEY secret and complete local AI config.');
	}

	return {
		supabaseUrl,
		supabaseServiceRoleKey,
		openAiApiKey,
		aiProvider,
		localAiUrl: localAiUrl.replace(/\/+$/, ''),
		localAiApiKey,
		localAiModel,
		aiProviderFallbackToOpenAi: aiProviderFallbackToOpenAi && Boolean(openAiApiKey),
		aiReviewConcurrency: getAiReviewConcurrency(env.AI_REVIEW_CONCURRENCY, aiProvider),
		openAiInputCostPer1MTokens: getOptionalNumber(env.OPENAI_INPUT_COST_PER_1M_TOKENS, DEFAULT_OPENAI_INPUT_COST_PER_1M_TOKENS),
		openAiOutputCostPer1MTokens: getOptionalNumber(env.OPENAI_OUTPUT_COST_PER_1M_TOKENS, DEFAULT_OPENAI_OUTPUT_COST_PER_1M_TOKENS),
		aiCostAlertRunUsd: getOptionalNumber(env.AI_COST_ALERT_RUN_USD, DEFAULT_AI_COST_ALERT_RUN_USD),
		aiReviewAlertRunLimit: getOptionalNumber(env.AI_REVIEW_ALERT_RUN_LIMIT, DEFAULT_AI_REVIEW_ALERT_RUN_LIMIT),
		aiTokenAlertRunLimit: getOptionalNumber(env.AI_TOKEN_ALERT_RUN_LIMIT, DEFAULT_AI_TOKEN_ALERT_RUN_LIMIT),
		articlePageImageLookupLimit: Math.max(
			1,
			Math.min(
				getOptionalNumber(env.ARTICLE_PAGE_IMAGE_LOOKUP_LIMIT, DEFAULT_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN),
				HARD_MAX_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN,
			),
		),
		enabledSummaryLanguages: getEnabledSummaryLanguages(env.ENABLED_SUMMARY_LANGUAGES),
		summaryTranslationLimit: getSummaryTranslationLimit(env.SUMMARY_TRANSLATION_LIMIT),
		holdArticlesForTranslations: getBooleanConfig(env.HOLD_ARTICLES_FOR_TRANSLATIONS, true),
	};
}

async function getWorkerRunSaveConfig(env: Env): Promise<WorkerRunSaveConfig | null> {
	const supabaseUrl = await resolveValue(env.SUPABASE_URL);
	const supabaseServiceRoleKey = await resolveValue(env.SUPABASE_SERVICE_ROLE_KEY);

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		return null;
	}

	return {
		supabaseUrl,
		supabaseServiceRoleKey,
	};
}

function getShardIndex(env: Env): number {
	const shardIndex = Number(env.FEED_SHARD_INDEX ?? '0');

	if (Number.isNaN(shardIndex) || shardIndex < 0) {
		return 0;
	}

	return Math.floor(shardIndex);
}

function getFeedsPerShard(env: Env): number {
	const feedsPerShard = Number(env.FEEDS_PER_SHARD ?? '20');

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

function clampArticlePageImageLookupLimit(value: number | undefined, fallback: number): number {
	if (!value || Number.isNaN(value)) {
		return fallback;
	}

	return Math.max(0, Math.min(value, HARD_MAX_ARTICLE_PAGE_IMAGE_LOOKUPS_PER_RUN));
}

function shouldHoldAcceptedArticlesForTranslations(config: RuntimeConfig) {
	return config.holdArticlesForTranslations && config.enabledSummaryLanguages.length > 0 && config.summaryTranslationLimit > 0;
}

function getSummaryTranslationTaskBudget(config: RuntimeConfig) {
	if (config.enabledSummaryLanguages.length === 0 || config.summaryTranslationLimit <= 0) {
		return 0;
	}

	return Math.max(0, Math.min(config.summaryTranslationLimit, HARD_MAX_SUMMARY_TRANSLATION_TASKS_PER_RUN));
}

function getArticlePageImageLookupLimit(feedCount: number, maxAiReviews: number, requestedLookupLimit: number) {
	const estimatedAvailableSubrequests =
		MAX_ESTIMATED_SUBREQUESTS_PER_RUN - feedCount - maxAiReviews - RESERVED_NON_FEED_SUBREQUESTS_PER_RUN;

	return Math.max(0, Math.min(requestedLookupLimit, estimatedAvailableSubrequests));
}

async function getFeedsForShard(env: Env, config: RuntimeConfig): Promise<RssFeed[]> {
	const shardIndex = getShardIndex(env);
	const feedsPerShard = getFeedsPerShard(env);
	const offset = shardIndex * feedsPerShard;

	const response = await fetch(
		`${config.supabaseUrl}/rest/v1/rss_feeds?select=source,url,is_positive_source&is_active=eq.true&order=id.asc&limit=${feedsPerShard}&offset=${offset}`,
		{
			method: 'GET',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
			},
		},
	);

	if (!response.ok) {
		const errorText = await response.text();

		await logWarn(env, 'worker.feeds.load_failed', 'Failed to load RSS feeds for shard', {
			shardIndex,
			feedsPerShard,
			offset,
			status: response.status,
			errorText,
		});

		throw new Error(`Failed to load RSS feeds for shard ${shardIndex}: ${response.status} ${errorText}`);
	}

	const feeds = (await response.json()) as RssFeed[];

	await logInfo(env, 'worker.feeds.loaded', 'Loaded RSS feeds for shard', {
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
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([a-fA-F0-9]+);/g, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)))
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function stripHtml(value: string): string {
	return decodeHtml(value.replace(/<[^>]*>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

function getTagValue(itemXml: string, tagName: string): string {
	const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
	const match = itemXml.match(regex);

	if (!match?.[1]) {
		return '';
	}

	return decodeHtml(match[1].trim());
}

function getAttributeValue(tagXml: string, attributeName: string): string {
	const regex = new RegExp(`${attributeName}=["']([^"']+)["']`, 'i');
	const match = tagXml.match(regex);

	if (!match?.[1]) {
		return '';
	}

	return decodeHtml(match[1].trim());
}

function getAtomLink(itemXml: string): string {
	const linkTags = itemXml.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const rel = getAttributeValue(tag, 'rel').toLowerCase();
		const href = getAttributeValue(tag, 'href');

		if (href && (!rel || rel === 'alternate')) {
			return decodeHtml(href.trim());
		}
	}

	const hrefMatch = itemXml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);

	if (!hrefMatch?.[1]) {
		return '';
	}

	return decodeHtml(hrefMatch[1].trim());
}

function normalizeUrl(url: string): string {
	try {
		const parsedUrl = new URL(url.trim());

		['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'].forEach(
			(param) => parsedUrl.searchParams.delete(param),
		);

		parsedUrl.hash = '';

		return parsedUrl.toString();
	} catch {
		return url.trim();
	}
}

function normalizeImageUrl(imageUrl: string, articleUrl: string): string | null {
	const cleanedImageUrl = decodeHtml(imageUrl).trim();

	if (
		!cleanedImageUrl ||
		cleanedImageUrl.startsWith('data:') ||
		cleanedImageUrl.startsWith('blob:') ||
		cleanedImageUrl.startsWith('javascript:')
	) {
		return null;
	}

	try {
		const absoluteImageUrl = new URL(cleanedImageUrl, articleUrl);
		const protocol = absoluteImageUrl.protocol.toLowerCase();

		if (protocol !== 'http:' && protocol !== 'https:') {
			return null;
		}

		absoluteImageUrl.hash = '';

		return absoluteImageUrl.toString();
	} catch {
		return null;
	}
}

function isLikelyImageUrl(url: string): boolean {
	const lowerUrl = url.toLowerCase();

	if (
		/\.(?:jpg|jpeg|png|webp|gif|avif)(?:[?#]|$)/i.test(lowerUrl) ||
		lowerUrl.includes('image') ||
		lowerUrl.includes('images') ||
		lowerUrl.includes('thumbnail') ||
		lowerUrl.includes('thumb') ||
		lowerUrl.includes('photo') ||
		lowerUrl.includes('photos') ||
		lowerUrl.includes('picture') ||
		lowerUrl.includes('media') ||
		lowerUrl.includes('uploads') ||
		lowerUrl.includes('wp-content') ||
		lowerUrl.includes('assets') ||
		lowerUrl.includes('static') ||
		lowerUrl.includes('cdn')
	) {
		return true;
	}

	try {
		const hostname = new URL(url).hostname.toLowerCase();

		return (
			hostname.includes('imgix') ||
			hostname.includes('cloudfront') ||
			hostname.includes('akamai') ||
			hostname.includes('fastly') ||
			hostname.startsWith('images.') ||
			hostname.startsWith('media.') ||
			hostname.startsWith('static.') ||
			hostname.startsWith('assets.')
		);
	} catch {
		return false;
	}
}

function getImageDimensionHints(imageUrl: string): {
	width: number | null;
	height: number | null;
} {
	let width: number | null = null;
	let height: number | null = null;

	try {
		const parsedUrl = new URL(imageUrl);
		const widthParam = parsedUrl.searchParams.get('width') ?? parsedUrl.searchParams.get('w') ?? parsedUrl.searchParams.get('resize_w');
		const heightParam = parsedUrl.searchParams.get('height') ?? parsedUrl.searchParams.get('h') ?? parsedUrl.searchParams.get('resize_h');
		const fitParam = parsedUrl.searchParams.get('fit') ?? parsedUrl.searchParams.get('resize') ?? parsedUrl.searchParams.get('dimensions');

		if (widthParam && /^\d+$/.test(widthParam)) {
			width = Number(widthParam);
		}

		if (heightParam && /^\d+$/.test(heightParam)) {
			height = Number(heightParam);
		}

		const fitMatch = fitParam?.match(/(\d{1,4})\D+(\d{1,4})/);

		if (fitMatch?.[1] && fitMatch[2]) {
			width ??= Number(fitMatch[1]);
			height ??= Number(fitMatch[2]);
		}

		const pathDimensionMatch = parsedUrl.pathname.match(/(?:^|[-_/])(\d{1,4})x(\d{1,4})(?:[-_.]|$)/);

		if (pathDimensionMatch?.[1] && pathDimensionMatch[2]) {
			width ??= Number(pathDimensionMatch[1]);
			height ??= Number(pathDimensionMatch[2]);
		}
	} catch {
		return { width, height };
	}

	return { width, height };
}

function hasTinyImageDimensionHints(imageUrl: string): boolean {
	const { width, height } = getImageDimensionHints(imageUrl);

	if (width !== null && width <= 120) {
		return true;
	}

	if (height !== null && height <= 120) {
		return true;
	}

	return false;
}

function isGenericGoogleImageCandidate(imageUrl: string): boolean {
	try {
		const parsedUrl = new URL(imageUrl);
		const hostname = parsedUrl.hostname.toLowerCase();
		const pathname = parsedUrl.pathname.toLowerCase();
		const search = parsedUrl.search.toLowerCase();

		return (
			hostname === 'news.google.com' ||
			hostname.endsWith('.news.google.com') ||
			(hostname.includes('google') &&
				(pathname.includes('favicon') ||
					pathname.includes('logo') ||
					pathname.includes('icon') ||
					pathname.includes('placeholder') ||
					search.includes('favicon') ||
					search.includes('logo') ||
					search.includes('icon'))) ||
			hostname.includes('gstatic.com') ||
			(hostname.includes('googleusercontent.com') && pathname.includes('favicon'))
		);
	} catch {
		return false;
	}
}

function isBadImageCandidate(imageUrl: string): boolean {
	const lowerUrl = imageUrl.toLowerCase();

	return (
		isGenericGoogleImageCandidate(imageUrl) ||
		hasTinyImageDimensionHints(imageUrl) ||
		lowerUrl.includes('/logo') ||
		lowerUrl.includes('logo.') ||
		lowerUrl.includes('logo-') ||
		lowerUrl.includes('/icon') ||
		lowerUrl.includes('icon.') ||
		lowerUrl.includes('apple-touch-icon') ||
		lowerUrl.includes('favicon') ||
		lowerUrl.includes('sprite') ||
		lowerUrl.includes('avatar') ||
		lowerUrl.includes('author') ||
		lowerUrl.includes('profile') ||
		lowerUrl.includes('placeholder') ||
		lowerUrl.includes('default-image') ||
		lowerUrl.includes('missing-image') ||
		lowerUrl.includes('no-image') ||
		lowerUrl.includes('blank') ||
		lowerUrl.includes('transparent') ||
		lowerUrl.includes('tracking') ||
		lowerUrl.includes('pixel') ||
		lowerUrl.includes('spacer') ||
		lowerUrl.includes('loader') ||
		lowerUrl.includes('spinner') ||
		lowerUrl.includes('1x1') ||
		lowerUrl.includes('gravatar') ||
		lowerUrl.endsWith('.svg') ||
		lowerUrl.includes('.svg?')
	);
}

function extractBestUrlFromSrcset(srcset: string) {
	const candidates = srcset
		.split(',')
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
		.filter((candidate): candidate is { url: string; score: number } => Boolean(candidate.url))
		.sort((a, b) => b.score - a.score);

	return candidates[0]?.url ?? '';
}

function isUsableImageUrl(imageUrl: string) {
	const trimmedImageUrl = imageUrl.trim();

	if (!trimmedImageUrl || isBadImageCandidate(trimmedImageUrl)) {
		return false;
	}

	return isLikelyImageUrl(trimmedImageUrl);
}

function firstValidImageUrl(candidates: string[], articleUrl: string) {
	const seenCandidates = new Set<string>();

	for (const candidate of candidates) {
		const normalizedUrl = normalizeImageUrl(candidate, articleUrl);

		if (!normalizedUrl || seenCandidates.has(normalizedUrl)) {
			continue;
		}

		seenCandidates.add(normalizedUrl);

		if (isUsableImageUrl(normalizedUrl)) {
			return normalizedUrl;
		}
	}

	return null;
}

function extractImageFromHtml(html: string, articleUrl: string): string | null {
	const candidates: string[] = [];
	const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];
	const sourceTags = html.match(/<source\b[^>]*>/gi) ?? [];

	for (const tag of [...sourceTags, ...imageTags]) {
		const srcset = getAttributeValue(tag, 'srcset') || getAttributeValue(tag, 'data-srcset') || getAttributeValue(tag, 'data-lazy-srcset');

		if (srcset) {
			const bestSrcsetUrl = extractBestUrlFromSrcset(srcset);

			if (bestSrcsetUrl) {
				candidates.push(bestSrcsetUrl);
			}
		}

		[
			'data-original',
			'data-original-src',
			'data-image',
			'data-img',
			'data-src',
			'data-lazy-src',
			'data-orig-file',
			'data-medium-file',
			'data-large-file',
			'data-fallback-src',
			'data-hi-res-src',
			'poster',
			'src',
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
		'og:image',
		'og:image:url',
		'og:image:secure_url',
		'twitter:image',
		'twitter:image:src',
		'thumbnail',
		'thumbnailurl',
		'image',
		'parsely-image-url',
		'sailthru.image.full',
		'sailthru.image.thumb',
	]);

	for (const tag of metaTags) {
		const property = getAttributeValue(tag, 'property').toLowerCase();
		const name = getAttributeValue(tag, 'name').toLowerCase();
		const itemprop = getAttributeValue(tag, 'itemprop').toLowerCase();
		const content = getAttributeValue(tag, 'content');

		if (content && (imageMetaKeys.has(property) || imageMetaKeys.has(name) || imageMetaKeys.has(itemprop))) {
			candidates.push(content);
		}
	}

	return candidates;
}

function extractLinkImagesFromHtml(html: string) {
	const candidates: string[] = [];
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const rel = getAttributeValue(tag, 'rel').toLowerCase();
		const asValue = getAttributeValue(tag, 'as').toLowerCase();
		const href = getAttributeValue(tag, 'href');

		if (href && (rel.includes('image_src') || rel.includes('preload') || rel.includes('prefetch')) && (!asValue || asValue === 'image')) {
			candidates.push(href);
		}
	}

	return candidates;
}

function addJsonLdImageCandidate(value: unknown, candidates: string[]) {
	if (!value) {
		return;
	}

	if (typeof value === 'string') {
		candidates.push(value);
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((item) => addJsonLdImageCandidate(item, candidates));
		return;
	}

	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const url = record.url ?? record.contentUrl ?? record.thumbnailUrl ?? record['@id'];

		if (typeof url === 'string') {
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

	if (typeof value !== 'object') {
		return;
	}

	const record = value as Record<string, unknown>;

	['image', 'thumbnail', 'thumbnailUrl', 'primaryImageOfPage', 'associatedMedia'].forEach((key) => {
		if (key in record) {
			addJsonLdImageCandidate(record[key], candidates);
		}
	});

	Object.values(record).forEach((nestedValue) => {
		if (typeof nestedValue === 'object') {
			extractJsonLdImagesFromValue(nestedValue, candidates);
		}
	});
}

function extractJsonLdImagesFromHtml(html: string) {
	const candidates: string[] = [];
	const scriptTags = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

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

function extractArticlePageImageFromHtml(html: string, articleUrl: string): string | null {
	const candidates = [...extractMetaImagesFromHtml(html), ...extractLinkImagesFromHtml(html), ...extractJsonLdImagesFromHtml(html)];

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
		const medium = getAttributeValue(tag, 'medium').toLowerCase();
		const type = getAttributeValue(tag, 'type').toLowerCase();
		const url = getAttributeValue(tag, 'url');

		if (url && (medium === 'image' || type.startsWith('image/') || isLikelyImageUrl(url))) {
			candidates.push(url);
		}
	}

	const mediaThumbnailTags = itemXml.match(/<media:thumbnail\b[^>]*>/gi) ?? [];

	for (const tag of mediaThumbnailTags) {
		const url = getAttributeValue(tag, 'url');

		if (url) {
			candidates.push(url);
		}
	}

	const enclosureTags = itemXml.match(/<enclosure\b[^>]*>/gi) ?? [];

	for (const tag of enclosureTags) {
		const type = getAttributeValue(tag, 'type').toLowerCase();
		const url = getAttributeValue(tag, 'url');

		if (url && (type.startsWith('image/') || isLikelyImageUrl(url))) {
			candidates.push(url);
		}
	}

	const atomImageLinkTags = itemXml.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of atomImageLinkTags) {
		const rel = getAttributeValue(tag, 'rel').toLowerCase();
		const type = getAttributeValue(tag, 'type').toLowerCase();
		const href = getAttributeValue(tag, 'href');

		if (href && (rel.includes('enclosure') || rel.includes('image')) && (type.startsWith('image/') || isLikelyImageUrl(href))) {
			candidates.push(href);
		}
	}

	const itunesImageTags = itemXml.match(/<itunes:image\b[^>]*>/gi) ?? [];

	for (const tag of itunesImageTags) {
		const href = getAttributeValue(tag, 'href');

		if (href) {
			candidates.push(href);
		}
	}

	const imageTags = itemXml.match(/<image\b[^>]*>[\s\S]*?<\/image>/gi) ?? [];

	for (const tag of imageTags) {
		const url = getTagValue(tag, 'url') || getAttributeValue(tag, 'url');

		if (url) {
			candidates.push(url);
		}
	}

	const directImage = firstValidImageUrl(candidates, articleUrl);

	if (directImage) {
		return directImage;
	}

	const embeddedHtmlBlocks = [
		getTagValue(itemXml, 'description'),
		getTagValue(itemXml, 'summary'),
		getTagValue(itemXml, 'content:encoded'),
		getTagValue(itemXml, 'content'),
	].filter(Boolean);

	for (const embeddedHtml of embeddedHtmlBlocks) {
		const embeddedImage = extractImageFromHtml(embeddedHtml, articleUrl);

		if (embeddedImage) {
			return embeddedImage;
		}
	}

	return null;
}

async function fetchArticlePageImage(article: RssArticle): Promise<RssArticle> {
	if (hasUsableThumbnail(article)) {
		return article;
	}

	try {
		const response = await fetch(article.url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; NutsNewsBot/1.0; +https://www.nutsnews.com)',
				Accept: 'text/html,application/xhtml+xml',
			},
		});

		if (!response.ok) {
			return article;
		}

		const contentType = response.headers.get('content-type') ?? '';

		if (contentType && !contentType.toLowerCase().includes('text/html') && !contentType.toLowerCase().includes('application/xhtml')) {
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

async function hydrateMissingArticleImages(env: Env, articles: RssArticle[], lookupLimit: number): Promise<ImageHydrationResult> {
	if (lookupLimit <= 0) {
		return {
			articles,
			lookupCount: 0,
			foundCount: 0,
		};
	}

	const missingImageArticles = articles.filter((article) => !hasUsableThumbnail(article));
	const lookupCandidates = missingImageArticles.slice(0, lookupLimit);

	if (lookupCandidates.length === 0) {
		return {
			articles,
			lookupCount: 0,
			foundCount: 0,
		};
	}

	const hydratedCandidates = await mapWithConcurrency(lookupCandidates, ARTICLE_PAGE_IMAGE_LOOKUP_CONCURRENCY, fetchArticlePageImage);

	const hydratedByUrl = new Map(hydratedCandidates.map((article) => [article.url, article]));

	const hydratedArticles = articles.map((article) => {
		return hydratedByUrl.get(article.url) ?? article;
	});

	const foundCount = hydratedCandidates.filter(hasUsableThumbnail).length;

	await logInfo(env, 'worker.images.hydration_completed', 'Article page image hydration completed', {
		lookupLimit,
		lookupCount: lookupCandidates.length,
		foundCount,
		missingBeforeCount: missingImageArticles.length,
		missingAfterCount: hydratedArticles.filter((article) => !hasUsableThumbnail(article)).length,
	});

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
		const title = stripHtml(getTagValue(itemXml, 'title'));
		const rssLink = getTagValue(itemXml, 'link');
		const atomLink = getAtomLink(itemXml);
		const url = normalizeUrl(rssLink || atomLink);

		const description =
			getTagValue(itemXml, 'description') ||
			getTagValue(itemXml, 'summary') ||
			getTagValue(itemXml, 'content:encoded') ||
			getTagValue(itemXml, 'content');

		const pubDate = getTagValue(itemXml, 'pubDate') || getTagValue(itemXml, 'published') || getTagValue(itemXml, 'updated');

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

function hasUsableThumbnail(article: RssArticle): article is RssArticle & { imageUrl: string } {
	return Boolean(article.imageUrl?.trim() && isUsableImageUrl(article.imageUrl));
}

function scoreArticleCandidate(article: RssArticle, positiveSources: Set<string>): number {
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
		const ageInHours = (Date.now() - new Date(article.publishedAt).getTime()) / 1000 / 60 / 60;

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

function shouldSkipBeforeAi(article: RssArticle, positiveSources: Set<string>): boolean {
	const text = `${article.source} ${article.title} ${article.excerpt}`.toLowerCase();
	const hardNegativeMatchCount = countKeywordMatches(text, HARD_NEGATIVE_KEYWORDS);

	if (hardNegativeMatchCount === 0) {
		return false;
	}

	const positiveEscapeMatchCount = countKeywordMatches(text, HARD_POSITIVE_ESCAPE_KEYWORDS);

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
	aiProvider: ReviewProvider,
	aiModel: string,
): ReviewedArticleResult[] {
	return articles.map((article) => ({
		article,
		aiDecision: {
			...baseDecision,
			reason: reasonBuilder(article),
		},
		aiProvider,
		aiModel,
		reviewDurationMs: 0,
	}));
}

function sortArticlesForReview(articles: RssArticle[], positiveSources: Set<string>): RssArticle[] {
	return [...articles].sort((a, b) => {
		const scoreDifference = scoreArticleCandidate(b, positiveSources) - scoreArticleCandidate(a, positiveSources);

		if (scoreDifference !== 0) {
			return scoreDifference;
		}

		const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
		const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

		return bTime - aTime;
	});
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await mapper(items[currentIndex] as T, currentIndex);
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

function truncateText(value: string, maxLength = MAX_RESPONSE_ERROR_TEXT_LENGTH) {
	const normalizedValue = value.replace(/\s+/g, ' ').trim();

	if (normalizedValue.length <= maxLength) {
		return normalizedValue;
	}

	const safeMaxLength = Math.max(TRUNCATED_TEXT_SUFFIX.length, maxLength);
	const previewLength = safeMaxLength - TRUNCATED_TEXT_SUFFIX.length;

	return `${normalizedValue.slice(0, previewLength).trimEnd()}${TRUNCATED_TEXT_SUFFIX}`;
}

function removeHtmlNoise(value: string) {
	return value
		.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
}

function extractHtmlTitle(value: string) {
	const titleMatch = value.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

	if (!titleMatch?.[1]) {
		return '';
	}

	return stripHtml(titleMatch[1]);
}

function buildReadableResponsePreview(value: string) {
	const htmlTitle = extractHtmlTitle(value);
	const readableText = stripHtml(removeHtmlNoise(value));

	if (htmlTitle && readableText && !readableText.toLowerCase().startsWith(htmlTitle.toLowerCase())) {
		return `${htmlTitle}: ${readableText}`;
	}

	return readableText || htmlTitle;
}

async function readResponseTextSafely(response: Response, maxLength = MAX_RESPONSE_ERROR_TEXT_LENGTH): Promise<string> {
	try {
		const responseBody = await response.text();
		const statusText = response.statusText ? ` ${response.statusText}` : '';
		const readablePreview = buildReadableResponsePreview(responseBody);
		const statusPrefix = `HTTP ${response.status}${statusText}`;

		if (!readablePreview) {
			return statusPrefix;
		}

		return truncateText(`${statusPrefix}: ${readablePreview}`, maxLength);
	} catch (error) {
		return truncateText(`Failed to read response body: ${getErrorMessage(error)}`, maxLength);
	}
}

async function readResponseJsonSafely<T>(response: Response): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
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

async function fetchSingleFeed(env: Env, feed: RssFeed): Promise<FeedFetchResult> {
	const startedAt = Date.now();

	try {
		const response = await fetch(feed.url, {
			headers: {
				'User-Agent': 'NutsNewsBot/1.0',
			},
		});

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);

			await logWarn(env, 'worker.rss.fetch_failed_status', 'RSS feed fetch failed', {
				source: feed.source,
				feedUrl: feed.url,
				status: response.status,
				errorText,
				durationMs: Date.now() - startedAt,
			});

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
		const articles = parseRss(xml, feed.source).filter((article) => article.title && article.url);
		const imageCount = articles.filter((article) => article.imageUrl).length;

		await logInfo(env, 'worker.rss.feed_fetched', 'RSS feed fetched', {
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
		await logError(env, 'worker.rss.fetch_failed_exception', 'RSS feed fetch threw an exception', error, {
			source: feed.source,
			feedUrl: feed.url,
			durationMs: Date.now() - startedAt,
		});

		return {
			feed,
			articles: [],
			ok: false,
			status: null,
			errorMessage: truncateText(getErrorMessage(error)),
			durationMs: Date.now() - startedAt,
		};
	}
}

async function fetchRssArticles(env: Env, feeds: RssFeed[], positiveSources: Set<string>): Promise<RssFetchResult> {
	const feedResults = await Promise.all(feeds.map((feed) => fetchSingleFeed(env, feed)));
	const failedFeeds = feedResults
		.filter((result) => !result.ok)
		.map((result) => ({
			source: result.feed.source,
			url: result.feed.url,
			status: result.status,
			errorMessage: result.errorMessage ? truncateText(result.errorMessage) : null,
		}));
	const allArticles = feedResults.flatMap((result) => result.articles);

	if (failedFeeds.length > 0) {
		await logWarn(env, 'worker.rss.fetch_completed_with_failures', 'RSS fetch completed with one or more feed failures', {
			feedCount: feeds.length,
			feedFetchSuccessCount: feedResults.length - failedFeeds.length,
			feedFetchFailureCount: failedFeeds.length,
			failedFeeds,
		});
	}

	return {
		feedResults,
		articles: sortArticlesForReview(uniqueArticlesByUrl(allArticles), positiveSources),
		feedFetchSuccessCount: feedResults.length - failedFeeds.length,
		feedFetchFailureCount: failedFeeds.length,
		failedFeeds,
	};
}

function isNoThumbnailReview(row: ReviewedUrlRow): boolean {
	if (row.decision !== 'reject') {
		return false;
	}

	const reason = (row.reason ?? '').toLowerCase();

	return reason.includes('thumbnail') || reason.includes('usable image') || reason.includes('no image');
}

function shouldTreatReviewedRowAsProcessed(row: ReviewedUrlRow, nowMs: number): boolean {
	if (!isNoThumbnailReview(row)) {
		return true;
	}

	if (!row.reviewed_at) {
		return false;
	}

	const reviewedAtMs = Date.parse(row.reviewed_at);

	if (Number.isNaN(reviewedAtMs)) {
		return false;
	}

	const retryAfterMs = NO_THUMBNAIL_RETRY_AFTER_HOURS * 60 * 60 * 1000;

	return nowMs - reviewedAtMs < retryAfterMs;
}

async function getReviewedUrls(env: Env, config: RuntimeConfig, urls: string[]): Promise<Set<string>> {
	const startedAt = Date.now();

	if (urls.length === 0) {
		return new Set();
	}

	const candidateUrls = new Set(urls);
	const reviewedUrls = new Set<string>();
	let reviewedLookupRowCount = 0;
	let publishedLookupRowCount = 0;
	let matchedReviewUrlCount = 0;
	let matchedPublishedUrlCount = 0;
	let retryableNoThumbnailReviewCount = 0;
	const nowMs = Date.now();

	try {
		const response = await fetch(
			`${config.supabaseUrl}/rest/v1/article_ai_reviews?select=original_url,decision,reason,reviewed_at&order=reviewed_at.desc&limit=${REVIEWED_URL_LOOKBACK_LIMIT}`,
			{
				method: 'GET',
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				},
			},
		);

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);

			await logWarn(
				env,
				'worker.supabase.review_lookup_failed',
				'Failed to load recent reviewed URLs from Supabase; continuing with published article lookup',
				{
					status: response.status,
					errorText,
					candidateUrlCount: urls.length,
					durationMs: Date.now() - startedAt,
				},
			);
		} else {
			const jsonResult = await readResponseJsonSafely<ReviewedUrlRow[]>(response);

			if (!jsonResult.ok) {
				await logError(
					env,
					'worker.supabase.review_lookup_parse_failed',
					'Failed to parse Supabase reviewed URL lookup response; continuing with published article lookup',
					jsonResult.error,
					{
						candidateUrlCount: urls.length,
						durationMs: Date.now() - startedAt,
					},
				);
			} else {
				reviewedLookupRowCount = jsonResult.value.length;

				for (const row of jsonResult.value) {
					if (!candidateUrls.has(row.original_url)) {
						continue;
					}

					if (!shouldTreatReviewedRowAsProcessed(row, nowMs)) {
						retryableNoThumbnailReviewCount += 1;
						continue;
					}

					reviewedUrls.add(row.original_url);
					matchedReviewUrlCount += 1;
				}
			}
		}
	} catch (error) {
		await logError(
			env,
			'worker.supabase.review_lookup_exception',
			'Supabase reviewed URL lookup threw an exception; continuing with published article lookup',
			error,
			{
				candidateUrlCount: urls.length,
				durationMs: Date.now() - startedAt,
			},
		);
	}

	try {
		const response = await fetch(
			`${config.supabaseUrl}/rest/v1/articles?select=original_url&order=published_on_site_at.desc&limit=${PUBLISHED_URL_LOOKBACK_LIMIT}`,
			{
				method: 'GET',
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				},
			},
		);

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);

			await logWarn(env, 'worker.supabase.published_url_lookup_failed', 'Failed to load recently published article URLs from Supabase', {
				status: response.status,
				errorText,
				candidateUrlCount: urls.length,
				durationMs: Date.now() - startedAt,
			});
		} else {
			const jsonResult = await readResponseJsonSafely<PublishedArticleUrlRow[]>(response);

			if (!jsonResult.ok) {
				await logError(
					env,
					'worker.supabase.published_url_lookup_parse_failed',
					'Failed to parse Supabase published article URL lookup response',
					jsonResult.error,
					{
						candidateUrlCount: urls.length,
						durationMs: Date.now() - startedAt,
					},
				);
			} else {
				publishedLookupRowCount = jsonResult.value.length;

				for (const row of jsonResult.value) {
					if (candidateUrls.has(row.original_url)) {
						if (!reviewedUrls.has(row.original_url)) {
							matchedPublishedUrlCount += 1;
						}

						reviewedUrls.add(row.original_url);
					}
				}
			}
		}
	} catch (error) {
		await logError(
			env,
			'worker.supabase.published_url_lookup_exception',
			'Supabase published article URL lookup threw an exception',
			error,
			{
				candidateUrlCount: urls.length,
				durationMs: Date.now() - startedAt,
			},
		);
	}

	await logInfo(env, 'worker.supabase.processed_url_lookup_completed', 'Loaded previously processed article URLs from Supabase', {
		reviewedLookbackCount: reviewedLookupRowCount,
		publishedLookbackCount: publishedLookupRowCount,
		candidateUrlCount: urls.length,
		matchedReviewUrlCount,
		matchedPublishedUrlCount,
		retryableNoThumbnailReviewCount,
		noThumbnailRetryAfterHours: NO_THUMBNAIL_RETRY_AFTER_HOURS,
		matchedProcessedUrlCount: reviewedUrls.size,
		durationMs: Date.now() - startedAt,
	});

	return reviewedUrls;
}

function normalizeTextWhitespace(value: string) {
	return value
		.replace(/[`*_~>#]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.;:!?])/g, '$1')
		.trim();
}

function trimAiSummary(value: string, maxChars = AI_SUMMARY_MAX_CHARS) {
	const text = normalizeTextWhitespace(value);

	if (text.length <= maxChars) {
		return text;
	}

	const slice = text.slice(0, maxChars + 1);
	const sentenceBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));

	if (sentenceBreak >= 120) {
		return slice.slice(0, sentenceBreak + 1).trim();
	}

	const wordBreak = slice.lastIndexOf(' ');
	const trimmed = slice
		.slice(0, wordBreak > 0 ? wordBreak : maxChars)
		.replace(/[\s,;:.-]+$/, '')
		.trim();

	if (!trimmed) {
		return text.slice(0, maxChars).trim();
	}

	const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
	return punctuated.length <= maxChars ? punctuated : trimmed.slice(0, maxChars).trim();
}

function normalizeAiDecision(value: Partial<AiArticleDecision>): AiArticleDecision {
	const decision = value.decision === 'accept' ? 'accept' : 'reject';

	return {
		decision,
		category: value.category || 'Uplifting',
		positivity_score: typeof value.positivity_score === 'number' ? value.positivity_score : 0,
		summary: decision === 'accept' ? trimAiSummary(value.summary || '') : '',
		reason: value.reason || 'No reason provided by AI provider.',
	};
}

function buildRejectedAiClassificationResult(
	config: RuntimeConfig,
	reason: string,
	usage: OpenAiUsage = emptyOpenAiUsage(),
	aiProvider: AiProvider = config.aiProvider,
	aiModel = aiProvider === 'local' ? config.localAiModel : OPENAI_MODEL,
	durationMs = 0,
): AiClassificationResult {
	return buildAiClassificationResult(
		{
			decision: 'reject',
			category: 'Uplifting',
			positivity_score: 0,
			summary: '',
			reason,
		},
		usage,
		config,
		aiProvider,
		aiModel,
		durationMs,
	);
}

async function classifyAndSummarizeArticle(env: Env, config: RuntimeConfig, article: RssArticle): Promise<AiClassificationResult> {
	const startedAt = Date.now();
	const openAiApiKey = getSafeHeaderValue(config.openAiApiKey);

	if (!openAiApiKey) {
		await logWarn(env, 'worker.openai.invalid_api_key_header', 'Skipped OpenAI review because OPENAI_API_KEY is missing or contains invalid header characters', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
		});

		return buildRejectedAiClassificationResult(config, 'OPENAI_API_KEY is missing or contains invalid header characters.', emptyOpenAiUsage(), 'openai', OPENAI_MODEL, 0);
	}

	let response: Response;
	try {
		response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${openAiApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: OPENAI_MODEL,
				response_format: {
					type: 'json_object',
				},
				messages: [
					{
						role: 'system',
						content:
							'You are filtering articles for NutsNews, a peaceful uplifting news feed.\nReject politics, war, money, crime, tragedy, fear, conflict, elections, government, markets, inflation, business, stocks, military, and violence.\nAccept positive, uplifting, inspiring, human-interest, wellness, lifestyle, science, culture, animals, travel, community, nature, space, creativity, and remarkable achievement stories.\nBe selective, but do not reject a clearly positive article just because it comes from a broad news source.\nReturn only valid JSON.',
					},
					{
						role: 'user',
						content: `Article:
Source: ${article.source}
Title: ${article.title}
Excerpt: ${article.excerpt}

Return JSON exactly like this:
{
  "decision": "accept" or "reject",
  "category": "Community | Wellness | Science | Culture | Animals | Travel | Lifestyle | Achievement | Uplifting | Nature | Space | Creativity",
  "positivity_score": number from 1 to 10,
  "summary": "A cheerful, calm 1-2 sentence summary between 200 and 250 characters. Do not add facts. Do not copy the article.",
  "reason": "Short reason for the decision"
}`,
					},
				],
			}),
		});
	} catch (error) {
		await logError(env, 'worker.openai.request_exception', 'OpenAI request threw an exception', error, {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			durationMs: Date.now() - startedAt,
		});

		return buildRejectedAiClassificationResult(
			config,
			`OpenAI request exception: ${getErrorMessage(error)}`,
			emptyOpenAiUsage(),
			'openai',
			OPENAI_MODEL,
			Date.now() - startedAt,
		);
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.openai.request_failed', 'OpenAI request failed', {
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
			emptyOpenAiUsage(),
			'openai',
			OPENAI_MODEL,
			Date.now() - startedAt,
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
		await logError(env, 'worker.openai.response_json_failed', 'Failed to parse OpenAI response JSON', jsonResult.error, {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			durationMs: Date.now() - startedAt,
		});

		return buildRejectedAiClassificationResult(
			config,
			'OpenAI response JSON parse failed',
			emptyOpenAiUsage(),
			'openai',
			OPENAI_MODEL,
			Date.now() - startedAt,
		);
	}

	const data = jsonResult.value;
	const usage = normalizeOpenAiUsage(data.usage);
	const content = data.choices?.[0]?.message?.content;

	if (!content) {
		await logWarn(env, 'worker.openai.empty_response', 'OpenAI returned empty content', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			durationMs: Date.now() - startedAt,
		});

		return buildRejectedAiClassificationResult(
			config,
			'OpenAI returned empty content',
			usage,
			'openai',
			OPENAI_MODEL,
			Date.now() - startedAt,
		);
	}

	try {
		const parsedDecision = normalizeAiDecision(JSON.parse(content) as Partial<AiArticleDecision>);
		const estimatedCostUsd = estimateOpenAiCost(usage, config);

		await logInfo(env, 'worker.openai.article_reviewed', 'OpenAI reviewed article', {
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
		});

		return buildAiClassificationResult(parsedDecision, usage, config, 'openai', OPENAI_MODEL, Date.now() - startedAt);
	} catch (error) {
		await logError(env, 'worker.openai.invalid_json', 'OpenAI returned invalid JSON', error, {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			rawContent: content,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			durationMs: Date.now() - startedAt,
		});

		return buildRejectedAiClassificationResult(
			config,
			'OpenAI returned invalid JSON',
			usage,
			'openai',
			OPENAI_MODEL,
			Date.now() - startedAt,
		);
	}
}

type LocalAiReviewResponse = Partial<AiArticleDecision> & {
	model?: string;
	ai_model?: string;
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	duration_ms?: number;
};

function getLocalAiReviewUrl(config: RuntimeConfig) {
	return `${config.localAiUrl}/review`;
}

async function classifyAndSummarizeArticleWithLocalAi(
	env: Env,
	config: RuntimeConfig,
	article: RssArticle,
): Promise<AiClassificationResult> {
	const localAiApiKey = getSafeHeaderValue(config.localAiApiKey);

	await logInfo(env, 'worker.local_ai.diagnostics.review_start', 'Local AI review diagnostic started', {
		source: article.source,
		title: article.title,
		articleUrl: article.url,
		localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
		localAiReviewUrl: getLocalAiReviewUrl(config),
		localAiModel: config.localAiModel,
		hasLocalAiApiKey: Boolean(config.localAiApiKey),
		localAiApiKeyHeaderUsable: Boolean(localAiApiKey),
		openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
	});

	if (!localAiApiKey) {
		await logWarn(env, 'worker.local_ai.diagnostics.review_invalid_api_key', 'Local AI review diagnostic found an unusable API key header', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			hasLocalAiApiKey: Boolean(config.localAiApiKey),
			openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		});

		await logWarn(env, 'worker.local_ai.invalid_api_key_header', 'Local AI review key is blank or contains invalid header characters', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
		});

		if (config.aiProviderFallbackToOpenAi) {
			return classifyAndSummarizeArticle(env, config, article);
		}

		return buildRejectedAiClassificationResult(config, 'LOCAL_AI_API_KEY is blank or contains invalid header characters.', emptyOpenAiUsage(), 'local', config.localAiModel, 0);
	}

	let lastFailureReason = 'Local AI review failed.';
	let lastDurationMs = 0;

	for (let attempt = 1; attempt <= AI_REVIEW_RETRY_ATTEMPTS; attempt += 1) {
		const startedAt = Date.now();
		let response: Response;

		await logInfo(env, 'worker.local_ai.diagnostics.review_fetch_start', 'Local AI review fetch attempt started', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			localAiReviewUrl: getLocalAiReviewUrl(config),
			localAiModel: config.localAiModel,
			attempt,
			maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
		});

		try {
			response = await fetch(getLocalAiReviewUrl(config), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-nutsnews-ai-key': localAiApiKey,
				},
				body: JSON.stringify({
					model: config.localAiModel,
					source: article.source,
					title: article.title,
					excerpt: article.excerpt,
					url: article.url,
				}),
			});
		} catch (error) {
			lastDurationMs = Date.now() - startedAt;
			lastFailureReason = `Local AI request exception: ${getErrorMessage(error)}`;

			await logWarn(env, 'worker.local_ai.diagnostics.review_fetch_exception', 'Local AI review fetch attempt threw before receiving a response', {
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				localAiReviewUrl: getLocalAiReviewUrl(config),
				attempt,
				maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
				errorMessage: getErrorMessage(error),
				durationMs: lastDurationMs,
			});

			await logError(env, 'worker.local_ai.request_exception', 'Local AI request threw an exception', error, {
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				localAiUrl: config.localAiUrl,
				attempt,
				maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
				durationMs: lastDurationMs,
			});

			await delayBeforeAiReviewRetry(attempt);
			continue;
		}

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);
			lastDurationMs = Date.now() - startedAt;
			lastFailureReason = `Local AI request failed: ${response.status}`;

			await logWarn(env, 'worker.local_ai.diagnostics.review_fetch_failed_status', 'Local AI review fetch returned a non-OK response', {
				status: response.status,
				statusText: response.statusText,
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				attempt,
				maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
				errorText,
				durationMs: lastDurationMs,
			});

			await logWarn(env, 'worker.local_ai.request_failed', 'Local AI request failed', {
				status: response.status,
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				errorText,
				attempt,
				maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
				durationMs: lastDurationMs,
			});

			await delayBeforeAiReviewRetry(attempt);
			continue;
		}

		await logInfo(env, 'worker.local_ai.diagnostics.review_fetch_response', 'Local AI review fetch returned OK', {
			status: response.status,
			statusText: response.statusText,
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			attempt,
			maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
			durationMs: Date.now() - startedAt,
		});

		const jsonResult = await readResponseJsonSafely<LocalAiReviewResponse>(response);

		if (!jsonResult.ok) {
			lastDurationMs = Date.now() - startedAt;
			lastFailureReason = 'Local AI response JSON parse failed';

			await logWarn(env, 'worker.local_ai.diagnostics.review_response_json_failed', 'Local AI review response was not parseable JSON', {
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				attempt,
				maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
				errorMessage: getErrorMessage(jsonResult.error),
				durationMs: lastDurationMs,
			});

			await logError(env, 'worker.local_ai.response_json_failed', 'Failed to parse local AI response JSON', jsonResult.error, {
				source: article.source,
				title: article.title,
				articleUrl: article.url,
				attempt,
				maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
				durationMs: lastDurationMs,
			});

			await delayBeforeAiReviewRetry(attempt);
			continue;
		}

		const data = jsonResult.value;
		const aiDecision = normalizeAiDecision(data);
		const usage = {
			promptTokens: typeof data.prompt_tokens === 'number' ? data.prompt_tokens : 0,
			completionTokens: typeof data.completion_tokens === 'number' ? data.completion_tokens : 0,
			totalTokens:
				typeof data.total_tokens === 'number'
					? data.total_tokens
					: (typeof data.prompt_tokens === 'number' ? data.prompt_tokens : 0) +
						(typeof data.completion_tokens === 'number' ? data.completion_tokens : 0),
		};
		const durationMs = typeof data.duration_ms === 'number' ? data.duration_ms : Date.now() - startedAt;
		const aiModel = data.ai_model || data.model || config.localAiModel;

		await logInfo(env, 'worker.local_ai.diagnostics.review_success', 'Local AI review returned a usable decision', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			decision: aiDecision.decision,
			category: aiDecision.category,
			positivityScore: aiDecision.positivity_score,
			localAiModel: aiModel,
			attempt,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			durationMs,
		});

		await logInfo(env, 'worker.local_ai.article_reviewed', 'Local AI reviewed article', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			decision: aiDecision.decision,
			category: aiDecision.category,
			positivityScore: aiDecision.positivity_score,
			localAiModel: aiModel,
			attempt,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			durationMs,
		});

		return buildAiClassificationResult(aiDecision, usage, config, 'local', aiModel, durationMs);
	}

	if (config.aiProviderFallbackToOpenAi) {
		await logWarn(env, 'worker.local_ai.diagnostics.review_fallback_to_openai', 'Local AI review diagnostics show fallback to OpenAI after local attempts failed', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
			lastFailureReason,
		});

		await logWarn(env, 'worker.local_ai.fallback_to_openai', 'Falling back to OpenAI after local AI review retries failed', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
			lastFailureReason,
		});

		return classifyAndSummarizeArticle(env, config, article);
	}

	await logWarn(env, 'worker.local_ai.diagnostics.review_failed_no_fallback', 'Local AI review diagnostics show no fallback was available after local attempts failed', {
		source: article.source,
		title: article.title,
		articleUrl: article.url,
		maxAttempts: AI_REVIEW_RETRY_ATTEMPTS,
		lastFailureReason,
		lastDurationMs,
	});

	return buildRejectedAiClassificationResult(config, lastFailureReason, emptyOpenAiUsage(), 'local', config.localAiModel, lastDurationMs);
}

async function classifyAndSummarizeArticleWithConfiguredProvider(
	env: Env,
	config: RuntimeConfig,
	article: RssArticle,
): Promise<AiClassificationResult> {
	if (hasLocalAiReviewConfig(config)) {
		await logInfo(env, 'worker.local_ai.diagnostics.review_provider_selected', 'Local AI review provider selected', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			aiProvider: config.aiProvider,
			providerOrder: getAiReviewProviderOrder(config),
			localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
			localAiReviewUrl: getLocalAiReviewUrl(config),
			localAiModel: config.localAiModel,
			openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		});

		await logInfo(env, 'worker.local_ai.review_attempting', 'Trying local AI article review before OpenAI fallback', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			localAiUrl: config.localAiUrl,
			localAiModel: config.localAiModel,
			openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		});

		return classifyAndSummarizeArticleWithLocalAi(env, config, article);
	}

	if (config.localAiUrl || config.localAiApiKey) {
		await logWarn(env, 'worker.local_ai.diagnostics.review_skipped_missing_config', 'Local AI review provider was not selected because config is incomplete', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			aiProvider: config.aiProvider,
			providerOrder: getAiReviewProviderOrder(config),
			hasLocalAiUrl: Boolean(config.localAiUrl),
			hasLocalAiApiKey: Boolean(config.localAiApiKey),
			localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
			openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		});

		await logWarn(env, 'worker.local_ai.review_skipped_missing_config', 'Skipped local AI article review because LOCAL_AI_URL or LOCAL_AI_API_KEY is missing', {
			source: article.source,
			title: article.title,
			articleUrl: article.url,
			hasLocalAiUrl: Boolean(config.localAiUrl),
			hasLocalAiApiKey: Boolean(config.localAiApiKey),
		});
	}

	await logInfo(env, 'worker.openai.review_attempting', 'Trying OpenAI article review', {
		source: article.source,
		title: article.title,
		articleUrl: article.url,
		openAiModel: OPENAI_MODEL,
	});

	return classifyAndSummarizeArticle(env, config, article);
}

function normalizeLocalizedSummaryDecision(
	value: Partial<LocalizedSummaryDecision>,
	languageCode: SummaryLanguageCode,
	fallbackTitle: string,
	fallbackSummary: string,
): LocalizedSummaryDecision {
	return {
		language_code: languageCode,
		title:
			normalizeTextWhitespace(value.title || fallbackTitle)
				.slice(0, 220)
				.trim() || fallbackTitle,
		summary: trimAiSummary(value.summary || fallbackSummary),
	};
}

type LocalAiTranslationResponse = Partial<LocalizedSummaryDecision> & {
	model?: string;
	ai_model?: string;
	provider?: string;
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	duration_ms?: number;
};

function hasLocalAiTranslationConfig(config: RuntimeConfig) {
	return Boolean(config.localAiUrl && config.localAiApiKey);
}

function hasLocalAiReviewConfig(config: RuntimeConfig) {
	return Boolean(config.localAiUrl && config.localAiApiKey);
}

function getAiReviewProviderOrder(config: RuntimeConfig): AiProvider[] {
	return hasLocalAiReviewConfig(config) ? ['local', 'openai'] : ['openai'];
}

function getSummaryTranslationProviderOrder(config: RuntimeConfig): AiProvider[] {
	return hasLocalAiTranslationConfig(config) ? ['local', 'openai'] : ['openai'];
}

function getLocalAiTranslateUrl(config: RuntimeConfig) {
	return `${config.localAiUrl}/translate`;
}

async function translateArticleSummaryWithLocalAi(
	env: Env,
	config: RuntimeConfig,
	article: ArticleSummarySourceArticle,
	languageCode: SummaryLanguageCode,
): Promise<ArticleSummaryInsert | null> {
	if (!hasLocalAiTranslationConfig(config)) {
		return null;
	}

	const localAiApiKey = getSafeHeaderValue(config.localAiApiKey);

	await logInfo(env, 'worker.local_ai.diagnostics.translation_start', 'Local AI translation diagnostic started', {
		articleUrl: article.original_url,
		title: article.title,
		languageCode,
		localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
		localAiTranslateUrl: getLocalAiTranslateUrl(config),
		localAiModel: config.localAiModel,
		hasLocalAiApiKey: Boolean(config.localAiApiKey),
		localAiApiKeyHeaderUsable: Boolean(localAiApiKey),
	});

	if (!localAiApiKey) {
		await logWarn(env, 'worker.local_ai.diagnostics.translation_invalid_api_key', 'Local AI translation diagnostic found an unusable API key header', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			hasLocalAiApiKey: Boolean(config.localAiApiKey),
		});

		await logWarn(env, 'worker.translation.local.invalid_api_key_header', 'Skipped local summary translation because LOCAL_AI_API_KEY is blank or contains invalid header characters', {
			articleUrl: article.original_url,
			languageCode,
		});
		return null;
	}

	const languageName = getSummaryLanguageName(languageCode);
	const startedAt = Date.now();

	for (let attempt = 1; attempt <= SUMMARY_TRANSLATION_RETRY_ATTEMPTS; attempt += 1) {
		let response: Response;

		await logInfo(env, 'worker.local_ai.diagnostics.translation_fetch_start', 'Local AI translation fetch attempt started', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			localAiTranslateUrl: getLocalAiTranslateUrl(config),
			localAiModel: config.localAiModel,
			attempt,
			maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
		});

		try {
			response = await fetch(getLocalAiTranslateUrl(config), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-nutsnews-ai-key': localAiApiKey,
				},
				body: JSON.stringify({
					model: config.localAiModel,
					language_code: languageCode,
					language_name: languageName,
					source: article.source,
					title: article.title,
					summary: article.ai_summary,
					category: article.category,
					url: article.original_url,
				}),
			});
		} catch (error) {
			await logWarn(env, 'worker.local_ai.diagnostics.translation_fetch_exception', 'Local AI translation fetch attempt threw before receiving a response', {
				articleUrl: article.original_url,
				title: article.title,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				localAiTranslateUrl: getLocalAiTranslateUrl(config),
				errorMessage: getErrorMessage(error),
				durationMs: Date.now() - startedAt,
			});

			await logWarn(env, 'worker.translation.local.request_exception', 'Local summary translation request threw an exception', {
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				localAiUrl: config.localAiUrl,
				errorMessage: getErrorMessage(error),
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);

			await logWarn(env, 'worker.local_ai.diagnostics.translation_fetch_failed_status', 'Local AI translation fetch returned a non-OK response', {
				status: response.status,
				statusText: response.statusText,
				articleUrl: article.original_url,
				title: article.title,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				errorText,
				durationMs: Date.now() - startedAt,
			});

			await logWarn(env, 'worker.translation.local.request_failed', 'Local summary translation request failed', {
				status: response.status,
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				errorText,
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		await logInfo(env, 'worker.local_ai.diagnostics.translation_fetch_response', 'Local AI translation fetch returned OK', {
			status: response.status,
			statusText: response.statusText,
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			attempt,
			maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
			durationMs: Date.now() - startedAt,
		});

		const jsonResult = await readResponseJsonSafely<LocalAiTranslationResponse>(response);

		if (!jsonResult.ok) {
			await logWarn(env, 'worker.local_ai.diagnostics.translation_response_json_failed', 'Local AI translation response was not parseable JSON', {
				articleUrl: article.original_url,
				title: article.title,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				errorMessage: getErrorMessage(jsonResult.error),
				durationMs: Date.now() - startedAt,
			});

			await logWarn(env, 'worker.translation.local.response_json_failed', 'Failed to parse local translation response JSON', {
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				errorMessage: getErrorMessage(jsonResult.error),
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		const data = jsonResult.value;
		const rawTitle = typeof data.title === 'string' ? data.title : '';
		const rawSummary = typeof data.summary === 'string' ? data.summary : '';

		if (!normalizeTextWhitespace(rawTitle) || !normalizeTextWhitespace(rawSummary)) {
			await logWarn(env, 'worker.local_ai.diagnostics.translation_invalid_payload', 'Local AI translation response was JSON but missed title or summary', {
				articleUrl: article.original_url,
				title: article.title,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				hasTitle: Boolean(normalizeTextWhitespace(rawTitle)),
				hasSummary: Boolean(normalizeTextWhitespace(rawSummary)),
				durationMs: Date.now() - startedAt,
			});

			await logWarn(env, 'worker.translation.local.invalid_payload', 'Local summary translation response missed title or summary', {
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		const parsedSummary = normalizeLocalizedSummaryDecision(data, languageCode, article.title, article.ai_summary);
		const model = data.ai_model || data.model || config.localAiModel;

		await logInfo(env, 'worker.local_ai.diagnostics.translation_success', 'Local AI translation returned a usable summary', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			model,
			attempt,
			promptTokens: typeof data.prompt_tokens === 'number' ? data.prompt_tokens : 0,
			completionTokens: typeof data.completion_tokens === 'number' ? data.completion_tokens : 0,
			totalTokens: typeof data.total_tokens === 'number' ? data.total_tokens : 0,
			durationMs: Date.now() - startedAt,
		});

		await logInfo(env, 'worker.translation.local.article_summary_translated', 'Translated article summary with local AI', {
			articleUrl: article.original_url,
			languageCode,
			model,
			attempt,
			promptTokens: typeof data.prompt_tokens === 'number' ? data.prompt_tokens : 0,
			completionTokens: typeof data.completion_tokens === 'number' ? data.completion_tokens : 0,
			totalTokens: typeof data.total_tokens === 'number' ? data.total_tokens : 0,
			durationMs: Date.now() - startedAt,
		});

		return {
			original_url: article.original_url,
			language_code: parsedSummary.language_code,
			source_language_code: 'en',
			title: parsedSummary.title,
			summary: parsedSummary.summary,
			generated_by: 'local',
			model,
			updated_at: new Date().toISOString(),
		};
	}

	return null;
}

async function translateArticleSummaryWithOpenAi(
	env: Env,
	config: RuntimeConfig,
	article: ArticleSummarySourceArticle,
	languageCode: SummaryLanguageCode,
): Promise<ArticleSummaryInsert | null> {
	const openAiApiKey = getSafeHeaderValue(config.openAiApiKey);

	if (!openAiApiKey) {
		await logWarn(env, 'worker.translation.skipped_missing_openai_key', 'Skipped summary translation because OPENAI_API_KEY is missing or contains invalid header characters', {
			articleUrl: article.original_url,
			languageCode,
		});
		return null;
	}

	const languageName = getSummaryLanguageName(languageCode);
	const startedAt = Date.now();

	for (let attempt = 1; attempt <= SUMMARY_TRANSLATION_RETRY_ATTEMPTS; attempt += 1) {
		let response: Response;

		try {
			response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${config.openAiApiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: OPENAI_MODEL,
					response_format: {
						type: 'json_object',
					},
					messages: [
						{
							role: 'system',
							content:
								'You translate NutsNews article cards. Preserve the meaning and warm positive tone. Do not add facts. Do not translate URLs or source names. Return only valid JSON.',
						},
						{
							role: 'user',
							content: `Translate this NutsNews article card into ${languageName}.

Source: ${article.source}
English title: ${article.title}
English summary: ${article.ai_summary}
Category: ${article.category}

Return JSON exactly like this:
{
  "language_code": "${languageCode}",
  "title": "Natural ${languageName} title, no added facts",
  "summary": "Natural ${languageName} summary between 200 and 250 characters, no added facts"
}`,
						},
					],
				}),
			});
		} catch (error) {
			await logError(env, 'worker.translation.openai.request_exception', 'OpenAI summary translation threw an exception', error, {
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		if (!response.ok) {
			const errorText = await readResponseTextSafely(response);
			await logWarn(env, 'worker.translation.openai.request_failed', 'OpenAI summary translation request failed', {
				status: response.status,
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				errorText,
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		const jsonResult = await readResponseJsonSafely<{
			choices?: Array<{
				message?: {
					content?: string;
				};
			}>;
		}>(response);

		if (!jsonResult.ok) {
			await logError(
				env,
				'worker.translation.openai.response_json_failed',
				'Failed to parse OpenAI translation response JSON',
				jsonResult.error,
				{
					articleUrl: article.original_url,
					languageCode,
					attempt,
					maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
					durationMs: Date.now() - startedAt,
				},
			);

			await delayBeforeRetry(attempt);
			continue;
		}

		const content = jsonResult.value.choices?.[0]?.message?.content;

		if (!content) {
			await logWarn(env, 'worker.translation.openai.empty_response', 'OpenAI summary translation returned empty content', {
				articleUrl: article.original_url,
				languageCode,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
			continue;
		}

		try {
			const parsedRawSummary = JSON.parse(content) as Partial<LocalizedSummaryDecision>;

			if (!normalizeTextWhitespace(parsedRawSummary.title || '') || !normalizeTextWhitespace(parsedRawSummary.summary || '')) {
				throw new Error('OpenAI translation response missed title or summary.');
			}

			const parsedSummary = normalizeLocalizedSummaryDecision(parsedRawSummary, languageCode, article.title, article.ai_summary);

			await logInfo(env, 'worker.translation.openai.article_summary_translated', 'Translated article summary with OpenAI', {
				articleUrl: article.original_url,
				languageCode,
				model: OPENAI_MODEL,
				attempt,
				durationMs: Date.now() - startedAt,
			});

			return {
				original_url: article.original_url,
				language_code: parsedSummary.language_code,
				source_language_code: 'en',
				title: parsedSummary.title,
				summary: parsedSummary.summary,
				generated_by: 'openai',
				model: OPENAI_MODEL,
				updated_at: new Date().toISOString(),
			};
		} catch (error) {
			await logError(env, 'worker.translation.openai.invalid_json', 'OpenAI summary translation returned invalid JSON', error, {
				articleUrl: article.original_url,
				languageCode,
				rawContent: content,
				attempt,
				maxAttempts: SUMMARY_TRANSLATION_RETRY_ATTEMPTS,
				durationMs: Date.now() - startedAt,
			});

			await delayBeforeRetry(attempt);
		}
	}

	return null;
}

async function translateArticleSummary(
	env: Env,
	config: RuntimeConfig,
	article: ArticleSummarySourceArticle,
	languageCode: SummaryLanguageCode,
): Promise<ArticleSummaryInsert | null> {
	if (hasLocalAiTranslationConfig(config)) {
		await logInfo(env, 'worker.local_ai.diagnostics.translation_provider_selected', 'Local AI translation provider selected', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			providerOrder: getSummaryTranslationProviderOrder(config),
			localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
			localAiTranslateUrl: getLocalAiTranslateUrl(config),
			localAiModel: config.localAiModel,
		});

		await logInfo(env, 'worker.translation.local.attempting', 'Trying local AI summary translation before OpenAI fallback', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			localAiUrl: config.localAiUrl,
			localAiModel: config.localAiModel,
		});

		const localTranslation = await translateArticleSummaryWithLocalAi(env, config, article, languageCode);

		if (localTranslation) {
			return localTranslation;
		}

		await logWarn(env, 'worker.translation.fallback_to_openai', 'Falling back to OpenAI after local summary translation failed', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
		});

		await logWarn(env, 'worker.local_ai.diagnostics.translation_fallback_to_openai', 'Local AI translation diagnostics show fallback to OpenAI', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			providerOrder: getSummaryTranslationProviderOrder(config),
		});
	} else {
		await logWarn(env, 'worker.local_ai.diagnostics.translation_skipped_missing_config', 'Local AI translation provider was not selected because config is incomplete', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			providerOrder: getSummaryTranslationProviderOrder(config),
			hasLocalAiUrl: Boolean(config.localAiUrl),
			hasLocalAiApiKey: Boolean(config.localAiApiKey),
			localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
		});

		await logWarn(env, 'worker.translation.local.skipped_missing_config', 'Skipped local AI summary translation because LOCAL_AI_URL or LOCAL_AI_API_KEY is missing', {
			articleUrl: article.original_url,
			title: article.title,
			languageCode,
			hasLocalAiUrl: Boolean(config.localAiUrl),
			hasLocalAiApiKey: Boolean(config.localAiApiKey),
		});
	}

	await logInfo(env, 'worker.translation.openai.attempting', 'Trying OpenAI summary translation', {
		articleUrl: article.original_url,
		title: article.title,
		languageCode,
		openAiModel: OPENAI_MODEL,
	});

	return translateArticleSummaryWithOpenAi(env, config, article, languageCode);
}

function encodePostgrestInFilter(values: string[]) {
	return `in.(${values
		.map((value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
		.join(',')})`;
}

function getSummaryTaskKey(article: ArticleSummarySourceArticle, languageCode: SummaryLanguageCode) {
	return `${languageCode}::${article.original_url}`;
}

async function loadExistingSummaryLanguageCodes(
	env: Env,
	config: RuntimeConfig,
	originalUrls: string[],
): Promise<Map<string, Set<SummaryLanguageCode>>> {
	const languageCodesByUrl = new Map<string, Set<SummaryLanguageCode>>();
	const uniqueOriginalUrls = Array.from(new Set(originalUrls.filter(Boolean)));

	if (uniqueOriginalUrls.length === 0 || config.enabledSummaryLanguages.length === 0) {
		return languageCodesByUrl;
	}

	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(
			`${config.supabaseUrl}/rest/v1/article_summaries?select=original_url,language_code&original_url=${encodeURIComponent(
				encodePostgrestInFilter(uniqueOriginalUrls),
			)}&language_code=in.(${config.enabledSummaryLanguages.join(',')})&limit=500`,
			{
				method: 'GET',
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				},
			},
		);
	} catch (error) {
		await logError(env, 'worker.supabase.article_summary_lookup_exception', 'Article summary lookup threw an exception', error, {
			candidateUrlCount: uniqueOriginalUrls.length,
			durationMs: Date.now() - startedAt,
		});
		return languageCodesByUrl;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);
		await logWarn(env, 'worker.supabase.article_summary_lookup_failed', 'Failed to load article summary rows', {
			status: response.status,
			errorText,
			candidateUrlCount: uniqueOriginalUrls.length,
			durationMs: Date.now() - startedAt,
		});
		return languageCodesByUrl;
	}

	const jsonResult = await readResponseJsonSafely<Array<{ original_url: string; language_code: string }>>(response);

	if (!jsonResult.ok) {
		await logError(env, 'worker.supabase.article_summary_lookup_parse_failed', 'Failed to parse article summary lookup response', jsonResult.error, {
			candidateUrlCount: uniqueOriginalUrls.length,
			durationMs: Date.now() - startedAt,
		});
		return languageCodesByUrl;
	}

	for (const row of jsonResult.value) {
		if (!isSummaryLanguageCode(row.language_code)) {
			continue;
		}

		const current = languageCodesByUrl.get(row.original_url) ?? new Set<SummaryLanguageCode>();
		current.add(row.language_code);
		languageCodesByUrl.set(row.original_url, current);
	}

	return languageCodesByUrl;
}

async function loadSummaryTranslationRecoveryArticles(
	env: Env,
	config: RuntimeConfig,
	articleLimit: number,
	excludedOriginalUrls: Set<string>,
): Promise<ArticleSummarySourceArticle[]> {
	if (articleLimit <= 0 || config.enabledSummaryLanguages.length === 0) {
		return [];
	}

	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(
			`${config.supabaseUrl}/rest/v1/articles?select=source,title,original_url,ai_summary,category,published_on_site_at,status&status=in.(published,translation_pending)&image_url=not.is.null&ai_summary=not.is.null&order=published_on_site_at.desc.nullslast,created_at.desc&limit=${SUMMARY_TRANSLATION_RECOVERY_LOOKBACK_LIMIT}`,
			{
				method: 'GET',
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				},
			},
		);
	} catch (error) {
		await logError(env, 'worker.translation.recovery_article_lookup_exception', 'Translation recovery article lookup threw an exception', error, {
			articleLimit,
			durationMs: Date.now() - startedAt,
		});
		return [];
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);
		await logWarn(env, 'worker.translation.recovery_article_lookup_failed', 'Failed to load translation recovery articles', {
			status: response.status,
			errorText,
			articleLimit,
			durationMs: Date.now() - startedAt,
		});
		return [];
	}

	const jsonResult = await readResponseJsonSafely<Array<ArticleSummarySourceArticle & { status?: string | null }>>(response);

	if (!jsonResult.ok) {
		await logError(env, 'worker.translation.recovery_article_lookup_parse_failed', 'Failed to parse translation recovery article lookup response', jsonResult.error, {
			articleLimit,
			durationMs: Date.now() - startedAt,
		});
		return [];
	}

	const candidateRows = jsonResult.value.filter(
		(article) => article.original_url && article.title && article.ai_summary && !excludedOriginalUrls.has(article.original_url),
	);
	const existingLanguageCodesByUrl = await loadExistingSummaryLanguageCodes(
		env,
		config,
		candidateRows.map((article) => article.original_url),
	);
	const recoveryArticles: ArticleSummarySourceArticle[] = [];

	for (const article of candidateRows) {
		const existingLanguageCodes = existingLanguageCodesByUrl.get(article.original_url) ?? new Set<SummaryLanguageCode>();
		const hasMissingLanguage = config.enabledSummaryLanguages.some((languageCode) => !existingLanguageCodes.has(languageCode));

		if (!hasMissingLanguage) {
			continue;
		}

		recoveryArticles.push({
			source: article.source,
			title: article.title,
			original_url: article.original_url,
			ai_summary: article.ai_summary,
			category: article.category || 'Uplifting',
			published_on_site_at: article.published_on_site_at ?? null,
		});

		if (recoveryArticles.length >= articleLimit) {
			break;
		}
	}

	if (recoveryArticles.length > 0) {
		await logInfo(env, 'worker.translation.recovery_candidates_loaded', 'Loaded articles that need translation recovery', {
			candidateRowCount: candidateRows.length,
			recoveryCandidateCount: recoveryArticles.length,
			articleLimit,
			durationMs: Date.now() - startedAt,
		});
	}

	return recoveryArticles;
}

type ArticleSummaryTranslationBuildResult = {
	summaries: ArticleSummaryInsert[];
	attemptedTaskCount: number;
	failedTaskCount: number;
	failureSamples: ArticleSummaryFailureSample[];
	skippedByLimitArticleCount: number;
	skippedByLimitLanguageTaskCount: number;
	recoveryCandidateCount: number;
	recoveryAttemptedTaskCount: number;
	localTranslationCount: number;
	openAiTranslationCount: number;
};

async function buildArticleSummaryTranslations(
	env: Env,
	config: RuntimeConfig,
	acceptedArticles: ArticleInsert[],
): Promise<ArticleSummaryTranslationBuildResult> {
	const emptyResult: ArticleSummaryTranslationBuildResult = {
		summaries: [],
		attemptedTaskCount: 0,
		failedTaskCount: 0,
		failureSamples: [],
		skippedByLimitArticleCount: 0,
		skippedByLimitLanguageTaskCount: 0,
		recoveryCandidateCount: 0,
		recoveryAttemptedTaskCount: 0,
		localTranslationCount: 0,
		openAiTranslationCount: 0,
	};

	if (config.enabledSummaryLanguages.length === 0 || config.summaryTranslationLimit <= 0) {
		return emptyResult;
	}

	const maxTranslationTaskCount = getSummaryTranslationTaskBudget(config);

	if (maxTranslationTaskCount <= 0) {
		return emptyResult;
	}

	const acceptedOriginalUrls = new Set(acceptedArticles.map((article) => article.original_url));
	const taskKeys = new Set<string>();
	const translationTasks: Array<{ article: ArticleSummarySourceArticle; languageCode: SummaryLanguageCode; taskSource: 'new_article' | 'recovery' }> = [];
	const addTask = (article: ArticleSummarySourceArticle, languageCode: SummaryLanguageCode, taskSource: 'new_article' | 'recovery') => {
		if (translationTasks.length >= maxTranslationTaskCount) {
			return;
		}

		const key = getSummaryTaskKey(article, languageCode);

		if (taskKeys.has(key)) {
			return;
		}

		taskKeys.add(key);
		translationTasks.push({ article, languageCode, taskSource });
	};

	// Drain old translation gaps first. This prevents today's pending/untranslated articles from
	// starving forever when the RSS lane keeps accepting new articles on every run.
	const recoveryArticleBudget = Math.ceil(maxTranslationTaskCount / Math.max(1, config.enabledSummaryLanguages.length));
	const recoveryArticles = await loadSummaryTranslationRecoveryArticles(env, config, recoveryArticleBudget, acceptedOriginalUrls);

	if (recoveryArticles.length > 0) {
		const existingLanguageCodesByUrl = await loadExistingSummaryLanguageCodes(
			env,
			config,
			recoveryArticles.map((article) => article.original_url),
		);

		for (const article of recoveryArticles) {
			const existingLanguageCodes = existingLanguageCodesByUrl.get(article.original_url) ?? new Set<SummaryLanguageCode>();

			for (const languageCode of config.enabledSummaryLanguages) {
				if (!existingLanguageCodes.has(languageCode)) {
					addTask(article, languageCode, 'recovery');
				}
			}

			if (translationTasks.length >= maxTranslationTaskCount) {
				break;
			}
		}
	}

	const articlesSelectedForTranslation: ArticleInsert[] = [];
	const articlesSkippedByLimit: ArticleInsert[] = [];

	for (const article of acceptedArticles) {
		const articleTaskCount = config.enabledSummaryLanguages.length;

		if (articleTaskCount > 0 && translationTasks.length + articleTaskCount <= maxTranslationTaskCount) {
			articlesSelectedForTranslation.push(article);

			for (const languageCode of config.enabledSummaryLanguages) {
				addTask(article, languageCode, 'new_article');
			}
		} else {
			articlesSkippedByLimit.push(article);
		}
	}

	const skippedByLimitArticleCount = articlesSkippedByLimit.length;
	const skippedByLimitLanguageTaskCount = skippedByLimitArticleCount * config.enabledSummaryLanguages.length;

	if (skippedByLimitArticleCount > 0) {
		await logWarn(
			env,
			'worker.translation.skipped_by_limit',
			'Accepted articles were left as translation_pending because this invocation reached the safe summary translation task budget',
			{
				acceptedArticleCount: acceptedArticles.length,
				recoveryCandidateCount: recoveryArticles.length,
				recoveryTaskCount: translationTasks.filter((task) => task.taskSource === 'recovery').length,
				summaryTranslationLimit: config.summaryTranslationLimit,
				summaryTranslationTaskBudget: maxTranslationTaskCount,
				enabledSummaryLanguages: config.enabledSummaryLanguages,
				skippedByLimitArticleCount,
				skippedByLimitLanguageTaskCount,
				skippedArticleSamples: articlesSkippedByLimit.slice(0, 10).map((article) => ({
					source: article.source,
					title: article.title,
					articleUrl: article.original_url,
					publishedOnSiteAt: article.published_on_site_at,
				})),
			},
		);
	}

	if (translationTasks.length === 0) {
		return {
			...emptyResult,
			skippedByLimitArticleCount,
			skippedByLimitLanguageTaskCount,
			recoveryCandidateCount: recoveryArticles.length,
		};
	}

	const translationResults = await mapWithConcurrency(translationTasks, 2, async (task) => {
		const summary = await translateArticleSummary(env, config, task.article, task.languageCode);
		return { task, summary };
	});
	const summaries = translationResults
		.map((result) => result.summary)
		.filter((translation): translation is ArticleSummaryInsert => Boolean(translation));
	const failureSamples: ArticleSummaryFailureSample[] = translationResults
		.filter((result) => !result.summary)
		.slice(0, 12)
		.map(({ task }) => ({
			originalUrl: task.article.original_url,
			title: task.article.title,
			languageCode: task.languageCode,
			taskSource: task.taskSource,
			providerOrder: getSummaryTranslationProviderOrder(config),
			errorMessage: 'No translation returned after provider attempts. Check worker.translation.* logs for the exact local/OpenAI error.',
		}));
	const recoveryAttemptedTaskCount = translationTasks.filter((task) => task.taskSource === 'recovery').length;
	const localTranslationCount = summaries.filter((summary) => summary.generated_by === 'local').length;
	const openAiTranslationCount = summaries.filter((summary) => summary.generated_by === 'openai').length;

	return {
		summaries,
		attemptedTaskCount: translationTasks.length,
		failedTaskCount: translationTasks.length - summaries.length,
		failureSamples,
		skippedByLimitArticleCount,
		skippedByLimitLanguageTaskCount,
		recoveryCandidateCount: recoveryArticles.length,
		recoveryAttemptedTaskCount,
		localTranslationCount,
		openAiTranslationCount,
	};
}

async function saveArticleSummariesBatch(env: Env, config: RuntimeConfig, summaries: ArticleSummaryInsert[]): Promise<ArticleSummarySaveResult> {
	const startedAt = Date.now();

	if (summaries.length === 0) {
		return { ok: true, errorSamples: [] };
	}

	let response: Response;
	const buildSaveErrorSample = (status: number | null, errorText: string): ArticleSummarySaveErrorSample => ({
		status,
		errorText,
		summaryCount: summaries.length,
		languageCodes: Array.from(new Set(summaries.map((summary) => summary.language_code))).slice(0, 10),
		sampleOriginalUrls: summaries.map((summary) => summary.original_url).slice(0, 10),
		durationMs: Date.now() - startedAt,
	});

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/article_summaries?on_conflict=original_url,language_code`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'resolution=merge-duplicates,return=minimal',
			},
			body: JSON.stringify(summaries),
		});
	} catch (error) {
		await logError(
			env,
			'worker.supabase.article_summary_batch_save_exception',
			'Supabase article summary batch save threw an exception',
			error,
			{
				summaryCount: summaries.length,
				durationMs: Date.now() - startedAt,
			},
		);
		return { ok: false, errorSamples: [buildSaveErrorSample(null, getErrorMessage(error))] };
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);
		await logWarn(env, 'worker.supabase.article_summary_batch_save_failed', 'Failed to batch-save article summaries', {
			status: response.status,
			errorText,
			summaryCount: summaries.length,
			durationMs: Date.now() - startedAt,
		});
		return { ok: false, errorSamples: [buildSaveErrorSample(response.status, errorText)] };
	}

	await logInfo(env, 'worker.supabase.article_summary_batch_saved', 'Batch-saved article summaries', {
		summaryCount: summaries.length,
		durationMs: Date.now() - startedAt,
	});

	return { ok: true, errorSamples: [] };
}

function buildFeedOutcomeCounts(reviewedArticles: ReviewedArticleResult[]): Map<string, FeedOutcomeCounts> {
	const countsBySource = new Map<string, FeedOutcomeCounts>();

	for (const reviewedArticle of reviewedArticles) {
		const source = reviewedArticle.article.source;
		const current = countsBySource.get(source) ?? {
			accepted: 0,
			rejected: 0,
		};
		const hasThumbnail = hasUsableThumbnail(reviewedArticle.article);
		const accepted = reviewedArticle.aiDecision.decision === 'accept' && hasThumbnail;

		if (accepted) {
			current.accepted += 1;
		} else {
			current.rejected += 1;
		}

		countsBySource.set(source, current);
	}

	return countsBySource;
}

async function getFeedHealthSnapshots(env: Env, config: RuntimeConfig): Promise<Map<string, FeedHealthSnapshotRow>> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(
			`${config.supabaseUrl}/rest/v1/feed_health?select=feed_url,consecutive_failure_count,total_fetch_count,total_success_count,total_failure_count,total_article_count,total_image_count,total_accepted_count,total_rejected_count,last_success_at,last_failure_at&limit=10000`,
			{
				method: 'GET',
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				},
			},
		);
	} catch (error) {
		await logError(env, 'worker.supabase.feed_health_lookup_exception', 'Supabase feed health lookup threw an exception', error, {
			durationMs: Date.now() - startedAt,
		});

		return new Map();
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.feed_health_lookup_failed', 'Failed to load feed health snapshots', {
			status: response.status,
			errorText,
			durationMs: Date.now() - startedAt,
		});

		return new Map();
	}

	const rows = await readResponseJsonSafely<FeedHealthSnapshotRow[]>(response);

	if (!rows.ok) {
		await logError(env, 'worker.supabase.feed_health_lookup_parse_failed', 'Failed to parse feed health lookup response', rows.error, {
			durationMs: Date.now() - startedAt,
		});

		return new Map();
	}

	return new Map(rows.value.map((row) => [row.feed_url, row]));
}

function buildFeedHealthRows(
	feedResults: FeedFetchResult[],
	outcomeCounts: Map<string, FeedOutcomeCounts>,
	previousHealthByUrl: Map<string, FeedHealthSnapshotRow>,
	checkedAt: Date,
): FeedHealthUpsert[] {
	const checkedAtIso = checkedAt.toISOString();

	return feedResults.map((result) => {
		const previous = previousHealthByUrl.get(result.feed.url);
		const outcome = outcomeCounts.get(result.feed.source) ?? {
			accepted: 0,
			rejected: 0,
		};
		const previousConsecutiveFailureCount = previous?.consecutive_failure_count ?? 0;
		const previousTotalFetchCount = previous?.total_fetch_count ?? 0;
		const previousTotalSuccessCount = previous?.total_success_count ?? 0;
		const previousTotalFailureCount = previous?.total_failure_count ?? 0;
		const previousTotalArticleCount = previous?.total_article_count ?? 0;
		const previousTotalImageCount = previous?.total_image_count ?? 0;
		const previousTotalAcceptedCount = previous?.total_accepted_count ?? 0;
		const previousTotalRejectedCount = previous?.total_rejected_count ?? 0;
		const articleCount = result.articles.length;
		const imageCount = result.articles.filter(hasUsableThumbnail).length;
		const lastSuccessAt = result.ok ? checkedAtIso : (previous?.last_success_at ?? null);
		const lastFailureAt = result.ok ? (previous?.last_failure_at ?? null) : checkedAtIso;

		return {
			source: result.feed.source,
			feed_url: result.feed.url,
			last_checked_at: checkedAtIso,
			last_success_at: lastSuccessAt,
			last_failure_at: lastFailureAt,
			last_status: result.status,
			last_error_message: result.ok ? null : result.errorMessage,
			last_article_count: articleCount,
			last_image_count: imageCount,
			last_accepted_count: outcome.accepted,
			last_rejected_count: outcome.rejected,
			consecutive_failure_count: result.ok ? 0 : previousConsecutiveFailureCount + 1,
			total_fetch_count: previousTotalFetchCount + 1,
			total_success_count: previousTotalSuccessCount + (result.ok ? 1 : 0),
			total_failure_count: previousTotalFailureCount + (result.ok ? 0 : 1),
			total_article_count: previousTotalArticleCount + articleCount,
			total_image_count: previousTotalImageCount + imageCount,
			total_accepted_count: previousTotalAcceptedCount + outcome.accepted,
			total_rejected_count: previousTotalRejectedCount + outcome.rejected,
			updated_at: checkedAtIso,
		};
	});
}

async function saveFeedHealthBatch(env: Env, config: RuntimeConfig, feedHealthRows: FeedHealthUpsert[]): Promise<boolean> {
	const startedAt = Date.now();

	if (feedHealthRows.length === 0) {
		return true;
	}

	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/feed_health?on_conflict=feed_url`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'resolution=merge-duplicates,return=minimal',
			},
			body: JSON.stringify(feedHealthRows),
		});
	} catch (error) {
		await logError(env, 'worker.supabase.feed_health_batch_save_exception', 'Supabase feed health batch save threw an exception', error, {
			feedHealthRowCount: feedHealthRows.length,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.feed_health_batch_save_failed', 'Failed to batch-save feed health rows', {
			status: response.status,
			errorText,
			feedHealthRowCount: feedHealthRows.length,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	await logInfo(env, 'worker.supabase.feed_health_batch_saved', 'Batch-saved feed health rows', {
		feedHealthRowCount: feedHealthRows.length,
		durationMs: Date.now() - startedAt,
	});

	return true;
}

async function saveArticleReviewsBatch(env: Env, config: RuntimeConfig, reviews: ArticleReviewInsert[]): Promise<boolean> {
	const startedAt = Date.now();

	if (reviews.length === 0) {
		return true;
	}

	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/article_ai_reviews?on_conflict=original_url`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'resolution=merge-duplicates,return=minimal',
			},
			body: JSON.stringify(reviews),
		});
	} catch (error) {
		await logError(env, 'worker.supabase.review_batch_save_exception', 'Supabase article AI review batch save threw an exception', error, {
			reviewCount: reviews.length,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.review_batch_save_failed', 'Failed to batch-save article AI reviews', {
			status: response.status,
			errorText,
			reviewCount: reviews.length,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	await logInfo(env, 'worker.supabase.review_batch_saved', 'Batch-saved article AI reviews', {
		reviewCount: reviews.length,
		durationMs: Date.now() - startedAt,
	});

	return true;
}

async function saveAcceptedArticlesBatch(env: Env, config: RuntimeConfig, articles: ArticleInsert[]): Promise<boolean> {
	const startedAt = Date.now();

	if (articles.length === 0) {
		return true;
	}

	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/articles?on_conflict=original_url`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'resolution=ignore-duplicates,return=minimal',
			},
			body: JSON.stringify(articles),
		});
	} catch (error) {
		await logError(env, 'worker.supabase.article_batch_save_exception', 'Supabase accepted article batch save threw an exception', error, {
			articleCount: articles.length,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.article_batch_save_failed', 'Failed to batch-save accepted articles', {
			status: response.status,
			errorText,
			articleCount: articles.length,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	await logInfo(env, 'worker.supabase.article_batch_saved', 'Batch-saved accepted articles', {
		articleCount: articles.length,
		durationMs: Date.now() - startedAt,
	});

	return true;
}

function getFullyTranslatedOriginalUrls(
	originalUrls: string[],
	languageCodesByUrl: Map<string, Set<SummaryLanguageCode>>,
	requiredLanguages: SummaryLanguageCode[],
) {
	const uniqueOriginalUrls = Array.from(new Set(originalUrls.filter(Boolean)));

	if (requiredLanguages.length === 0) {
		return uniqueOriginalUrls;
	}

	return uniqueOriginalUrls.filter((originalUrl) => {
		const languageCodes = languageCodesByUrl.get(originalUrl) ?? new Set<SummaryLanguageCode>();
		return requiredLanguages.every((languageCode) => languageCodes.has(languageCode));
	});
}

async function publishArticlesBatch(env: Env, config: RuntimeConfig, originalUrls: string[]): Promise<boolean> {
	const uniqueOriginalUrls = Array.from(new Set(originalUrls.filter(Boolean)));
	const startedAt = Date.now();

	if (uniqueOriginalUrls.length === 0) {
		return true;
	}

	let response: Response;

	try {
		response = await fetch(
			`${config.supabaseUrl}/rest/v1/articles?original_url=${encodeURIComponent(encodePostgrestInFilter(uniqueOriginalUrls))}`,
			{
				method: 'PATCH',
				headers: {
					apikey: config.supabaseServiceRoleKey,
					Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
					'Content-Type': 'application/json',
					Prefer: 'return=minimal',
				},
				body: JSON.stringify({ status: 'published' }),
			},
		);
	} catch (error) {
		await logError(env, 'worker.supabase.article_publish_batch_exception', 'Publishing translated articles threw an exception', error, {
			articleCount: uniqueOriginalUrls.length,
			durationMs: Date.now() - startedAt,
		});
		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);
		await logWarn(env, 'worker.supabase.article_publish_batch_failed', 'Failed to publish translated articles', {
			status: response.status,
			errorText,
			articleCount: uniqueOriginalUrls.length,
			durationMs: Date.now() - startedAt,
		});
		return false;
	}

	await logInfo(env, 'worker.supabase.article_publish_batch_saved', 'Published translated articles', {
		articleCount: uniqueOriginalUrls.length,
		durationMs: Date.now() - startedAt,
	});

	return true;
}

async function refreshPublicFeedSnapshot(env: Env, config: RuntimeConfig): Promise<boolean> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/refresh_public_feed_snapshot`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'return=representation',
			},
			body: '{}',
		});
	} catch (error) {
		await logError(
			env,
			'worker.supabase.public_feed_snapshot_refresh_exception',
			'Public feed snapshot refresh threw an exception',
			error,
			{
				durationMs: Date.now() - startedAt,
			},
		);

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.public_feed_snapshot_refresh_failed', 'Failed to refresh public feed snapshot', {
			status: response.status,
			errorText,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	await logInfo(env, 'worker.supabase.public_feed_snapshot_refreshed', 'Refreshed public feed snapshot', {
		durationMs: Date.now() - startedAt,
	});

	return true;
}

async function saveAiUsageRun(env: Env, config: RuntimeConfig, run: AiUsageRunInsert): Promise<boolean> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/ai_usage_runs`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'return=minimal',
			},
			body: JSON.stringify(run),
		});
	} catch (error) {
		await logError(env, 'worker.supabase.ai_usage_run_save_exception', 'Supabase AI usage run save threw an exception', error, {
			shardIndex: run.shard_index,
			openAiCallCount: run.openai_call_count,
			estimatedOpenAiCostUsd: run.estimated_openai_cost_usd,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.ai_usage_run_save_failed', 'Failed to save AI usage run', {
			status: response.status,
			errorText,
			shardIndex: run.shard_index,
			openAiCallCount: run.openai_call_count,
			estimatedOpenAiCostUsd: run.estimated_openai_cost_usd,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	await logInfo(env, 'worker.supabase.ai_usage_run_saved', 'Saved AI usage run', {
		shardIndex: run.shard_index,
		openAiCallCount: run.openai_call_count,
		openAiPromptTokens: run.openai_prompt_tokens,
		openAiCompletionTokens: run.openai_completion_tokens,
		openAiTotalTokens: run.openai_total_tokens,
		estimatedOpenAiCostUsd: run.estimated_openai_cost_usd,
		durationMs: Date.now() - startedAt,
	});

	return true;
}

async function saveWorkerRun(env: Env, config: WorkerRunSaveConfig, run: WorkerRunInsert): Promise<boolean> {
	const startedAt = Date.now();
	let response: Response;

	try {
		response = await fetch(`${config.supabaseUrl}/rest/v1/worker_runs`, {
			method: 'POST',
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
				'Content-Type': 'application/json',
				Prefer: 'return=minimal',
			},
			body: JSON.stringify(run),
		});
	} catch (error) {
		await logError(env, 'worker.supabase.worker_run_save_exception', 'Supabase Worker run save threw an exception', error, {
			shardIndex: run.shard_index,
			runSource: run.run_source,
			success: run.success,
			errorName: run.error_name,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	if (!response.ok) {
		const errorText = await readResponseTextSafely(response);

		await logWarn(env, 'worker.supabase.worker_run_save_failed', 'Failed to save Worker run', {
			status: response.status,
			errorText,
			shardIndex: run.shard_index,
			runSource: run.run_source,
			success: run.success,
			errorName: run.error_name,
			durationMs: Date.now() - startedAt,
		});

		return false;
	}

	await logInfo(env, 'worker.supabase.worker_run_saved', 'Saved Worker run', {
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
	result: Omit<RefreshResult, 'workerRunSaveOk'>,
	options: {
		runStartedAt: number;
		runCompletedAt: Date;
		runSource: 'manual' | 'scheduled' | 'unknown';
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
	return error instanceof Error ? error.name : 'UnknownError';
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

async function saveFailedWorkerRun(
	env: Env,
	options: {
		runStartedAt: number;
		runSource: 'manual' | 'scheduled' | 'unknown';
		requestId: string | null;
		maxAiReviews?: number;
		error: unknown;
	},
): Promise<boolean> {
	const config = await getWorkerRunSaveConfig(env);

	if (!config) {
		await logWarn(
			env,
			'worker.supabase.worker_run_failed_save_skipped',
			'Skipped saving failed Worker run because Supabase config is missing',
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

async function reviewArticleWithConfiguredProvider(env: Env, config: RuntimeConfig, article: RssArticle): Promise<ReviewedArticleResult> {
	try {
		const aiResult = await classifyAndSummarizeArticleWithConfiguredProvider(env, config, article);

		return {
			article,
			aiDecision: aiResult.aiDecision,
			usage: aiResult.usage,
			estimatedCostUsd: aiResult.estimatedCostUsd,
			aiProvider: aiResult.aiProvider,
			aiModel: aiResult.aiModel,
			reviewDurationMs: aiResult.durationMs,
		};
	} catch (error) {
		await logError(
			env,
			'worker.openai.article_review_exception',
			'AI article review failed unexpectedly and was converted to a safe rejection',
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
				decision: 'reject',
				category: 'Uplifting',
				positivity_score: 0,
				summary: '',
				reason: `AI review exception: ${getErrorMessage(error)}`,
			},
			usage: emptyOpenAiUsage(),
			estimatedCostUsd: 0,
			aiProvider: config.aiProvider,
			aiModel: config.aiProvider === 'local' ? config.localAiModel : OPENAI_MODEL,
			reviewDurationMs: 0,
		};
	}
}

function buildRowsFromReviewedArticles(reviewedArticles: ReviewedArticleResult[], config: RuntimeConfig) {
	const reviewRows: ArticleReviewInsert[] = [];
	const acceptedArticleRows: ArticleInsert[] = [];

	let acceptedCount = 0;
	let rejectedCount = 0;
	const acceptedArticleInitialStatus: ArticleStatus = shouldHoldAcceptedArticlesForTranslations(config) ? 'translation_pending' : 'published';

	for (const reviewedArticle of reviewedArticles) {
		const { article, aiDecision } = reviewedArticle;
		const aiProvider = reviewedArticle.aiProvider ?? 'openai';
		const aiModel = reviewedArticle.aiModel ?? (aiProvider === 'local' ? DEFAULT_LOCAL_AI_MODEL : OPENAI_MODEL);
		const reviewDurationMs = reviewedArticle.reviewDurationMs ?? 0;
		const hasThumbnail = hasUsableThumbnail(article);
		const requestedDecision = aiDecision.decision === 'accept' ? 'accept' : 'reject';
		const normalizedDecision: 'accept' | 'reject' = requestedDecision === 'accept' && hasThumbnail ? 'accept' : 'reject';
		const normalizedCategory = aiDecision.category || 'Uplifting';
		const normalizedScore = aiDecision.positivity_score ?? 0;
		const normalizedSummary = aiDecision.summary || article.excerpt || article.title;
		const normalizedReason =
			requestedDecision === 'accept' && !hasThumbnail
				? 'Rejected before publish because the RSS item and article page did not include a usable image thumbnail.'
				: aiDecision.reason || 'No reason provided';

		reviewRows.push({
			original_url: article.url,
			source: article.source,
			title: article.title,
			decision: normalizedDecision,
			category: normalizedCategory,
			positivity_score: normalizedScore,
			summary: normalizedSummary,
			reason: normalizedReason,
			ai_provider: aiProvider,
			ai_model: aiModel,
			review_duration_ms: reviewDurationMs,
			reviewed_at: new Date().toISOString(),
		});

		if (normalizedDecision === 'reject') {
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
			ai_provider: aiProvider,
			ai_model: aiModel,
			status: acceptedArticleInitialStatus,
		});
	}

	return {
		reviewRows,
		acceptedArticleRows,
		acceptedCount,
		rejectedCount,
	};
}

function getReviewRowsEligibleForKvProcessedCache(reviewRows: ArticleReviewInsert[]) {
	return reviewRows.filter((row) => row.ai_provider !== 'no_thumbnail' && !isNoThumbnailReview(row));
}

async function refreshArticles(env: Env, options: RefreshOptions = {}): Promise<RefreshResult> {
	const refreshStartedAt = Date.now();
	const config = await getRuntimeConfig(env);
	const maxAiReviews = clampAiReviewLimit(options.maxAiReviews);
	const shardIndex = getShardIndex(env);
	const feedsPerShard = getFeedsPerShard(env);

	await logInfo(env, 'worker.local_ai.diagnostics.config', 'Local AI diagnostic config snapshot for this Worker invocation', {
		shardIndex,
		feedsPerShard,
		maxAiReviews,
		runSource: options.runSource ?? 'unknown',
		requestId: options.requestId ?? null,
		aiProvider: config.aiProvider,
		aiProviderRaw: env.AI_PROVIDER ?? null,
		aiReviewProviderOrder: getAiReviewProviderOrder(config),
		translationProviderOrder: getSummaryTranslationProviderOrder(config),
		localAiEndpoint: describeLocalAiEndpoint(config.localAiUrl),
		hasLocalAiUrl: Boolean(config.localAiUrl),
		hasLocalAiApiKey: Boolean(config.localAiApiKey),
		localAiApiKeyHeaderUsable: Boolean(getSafeHeaderValue(config.localAiApiKey)),
		localAiReviewConfigured: hasLocalAiReviewConfig(config),
		localAiTranslationConfigured: hasLocalAiTranslationConfig(config),
		localAiModel: config.localAiModel,
		openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		aiReviewConcurrency: config.aiReviewConcurrency,
		enabledSummaryLanguages: config.enabledSummaryLanguages,
		summaryTranslationLimit: config.summaryTranslationLimit,
	});

	await logInfo(env, 'worker.refresh.started', 'NutsNews Worker refresh started', {
		shardIndex,
		feedsPerShard,
		maxAiReviews,
		runSource: options.runSource ?? 'unknown',
		requestId: options.requestId ?? null,
		aiProvider: config.aiProvider,
		aiReviewProviderOrder: getAiReviewProviderOrder(config),
		localAiConfigured: hasLocalAiReviewConfig(config),
		openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		localAiModel: config.localAiModel,
		aiReviewConcurrency: config.aiReviewConcurrency,
	});

	const shardFeeds = await getFeedsForShard(env, config);
	const requestedImageLookupLimit = clampArticlePageImageLookupLimit(options.imageLookupLimit, config.articlePageImageLookupLimit);
	const articlePageImageLookupLimit = getArticlePageImageLookupLimit(shardFeeds.length, maxAiReviews, requestedImageLookupLimit);

	const positiveSources = new Set(shardFeeds.filter((feed) => feed.is_positive_source).map((feed) => feed.source));

	const rssFetchResult = await fetchRssArticles(env, shardFeeds, positiveSources);
	const fetchedArticles = rssFetchResult.articles;
	const candidateArticles = fetchedArticles.slice(0, MAX_CANDIDATES_PER_RUN);
	const candidateUrls = candidateArticles.map((article) => article.url);

	await logInfo(env, 'worker.refresh.candidates_loaded', 'RSS candidates loaded', {
		shardIndex,
		fetchedCount: fetchedArticles.length,
		feedFetchSuccessCount: rssFetchResult.feedFetchSuccessCount,
		feedFetchFailureCount: rssFetchResult.feedFetchFailureCount,
		failedFeeds: rssFetchResult.failedFeeds,
		candidateCount: candidateArticles.length,
		rssThumbnailCandidateCount: candidateArticles.filter(hasUsableThumbnail).length,
		noRssThumbnailCandidateCount: candidateArticles.filter((article) => !hasUsableThumbnail(article)).length,
		requestedImageLookupLimit,
		articlePageImageLookupLimit,
		maxCandidatesPerRun: MAX_CANDIDATES_PER_RUN,
	});

	const kvProcessedUrlLookup = await getProcessedUrlsFromKv(env, shardIndex, candidateUrls);
	const candidateUrlsNeedingSupabaseLookup = candidateUrls.filter((url) => !kvProcessedUrlLookup.urls.has(url));
	const supabaseReviewedUrls = await getReviewedUrls(env, config, candidateUrlsNeedingSupabaseLookup);
	const reviewedUrls = new Set([...kvProcessedUrlLookup.urls, ...supabaseReviewedUrls]);

	const unreviewedArticlesBeforeImageHydration = candidateArticles.filter((article) => !reviewedUrls.has(article.url));

	const imageHydrationResult = await hydrateMissingArticleImages(env, unreviewedArticlesBeforeImageHydration, articlePageImageLookupLimit);

	const unreviewedArticles = imageHydrationResult.articles;
	const noThumbnailArticles = unreviewedArticles.filter((article) => !hasUsableThumbnail(article));
	const unreviewedArticlesWithThumbnails = unreviewedArticles.filter(hasUsableThumbnail);

	const localFilterResults = unreviewedArticlesWithThumbnails.map((article) => ({
		article,
		shouldSkip: shouldSkipBeforeAi(article, positiveSources),
	}));

	const locallyRejectedArticles = localFilterResults.filter((result) => result.shouldSkip).map((result) => result.article);

	const articlesEligibleForAi = localFilterResults.filter((result) => !result.shouldSkip).map((result) => result.article);

	const aiReviewLockResult = await claimArticlesForAiReviewWithRedis(
		env,
		articlesEligibleForAi,
		maxAiReviews,
		options.requestId ?? null,
	);
	const articlesForAi = aiReviewLockResult.articles;

	await logInfo(env, 'worker.refresh.filtering_completed', 'Local filtering completed', {
		shardIndex,
		alreadyReviewedCount: reviewedUrls.size,
		unreviewedCount: unreviewedArticles.length,
		imageHydrationLookupCount: imageHydrationResult.lookupCount,
		imageHydrationFoundCount: imageHydrationResult.foundCount,
		noThumbnailRejectedCount: noThumbnailArticles.length,
		locallyRejectedCount: locallyRejectedArticles.length,
		eligibleForAiCount: articlesEligibleForAi.length,
		aiReviewCount: articlesForAi.length,
		aiProvider: config.aiProvider,
		aiReviewConcurrency: config.aiReviewConcurrency,
		redisEnabled: aiReviewLockResult.enabled,
		redisAiReviewLockAcquiredCount: aiReviewLockResult.acquiredCount,
		redisAiReviewLockSkippedCount: aiReviewLockResult.skippedCount,
		kvEnabled: kvProcessedUrlLookup.cacheAvailable,
		kvProcessedUrlHitCount: kvProcessedUrlLookup.hitCount,
		candidateUrlsNeedingSupabaseLookup: candidateUrlsNeedingSupabaseLookup.length,
	});

	const noThumbnailRejectedResults = buildRejectedArticles(
		noThumbnailArticles,
		NO_THUMBNAIL_REJECT_DECISION,
		(article) => `Skipped before AI from ${article.source}: RSS item and article page did not include a usable image thumbnail.`,
		'no_thumbnail',
		'local-rule',
	);

	const locallyRejectedResults = buildRejectedArticles(
		locallyRejectedArticles,
		LOCAL_PREFILTER_REJECT_DECISION,
		(article) => `Skipped before AI from ${article.source}: obvious negative topic detected in title or excerpt.`,
		'prefilter',
		'local-rule',
	);

	const aiReviewedArticles = await mapWithConcurrency(articlesForAi, config.aiReviewConcurrency, (article) =>
		reviewArticleWithConfiguredProvider(env, config, article),
	);

	const reviewedArticles = [...noThumbnailRejectedResults, ...locallyRejectedResults, ...aiReviewedArticles];

	const { reviewRows, acceptedArticleRows, acceptedCount, rejectedCount } = buildRowsFromReviewedArticles(reviewedArticles, config);
	const feedOutcomeCounts = buildFeedOutcomeCounts(reviewedArticles);

	const articleSaveOk = await saveAcceptedArticlesBatch(env, config, acceptedArticleRows);
	const articleSummaryBuildResult = articleSaveOk
		? await buildArticleSummaryTranslations(env, config, acceptedArticleRows)
		: {
			summaries: [],
			attemptedTaskCount: 0,
			failedTaskCount: 0,
			failureSamples: [],
			skippedByLimitArticleCount: 0,
			skippedByLimitLanguageTaskCount: 0,
			recoveryCandidateCount: 0,
			recoveryAttemptedTaskCount: 0,
			localTranslationCount: 0,
			openAiTranslationCount: 0,
		};
	const articleSummaryRows = articleSummaryBuildResult.summaries;
	const articleSummarySaveResult = articleSaveOk
		? await saveArticleSummariesBatch(env, config, articleSummaryRows)
		: {
			ok: false,
			errorSamples: [
				{
					status: null,
					errorText: 'Skipped article summary save because accepted article save failed.',
					summaryCount: articleSummaryRows.length,
					languageCodes: Array.from(new Set(articleSummaryRows.map((summary) => summary.language_code))).slice(0, 10),
					sampleOriginalUrls: articleSummaryRows.map((summary) => summary.original_url).slice(0, 10),
					durationMs: 0,
				},
			],
		};
	const articleSummarySaveOk = articleSummarySaveResult.ok;
	const articleUrlsWithNewOrRecoveredTranslations = Array.from(
		new Set([
			...acceptedArticleRows.map((article) => article.original_url),
			...articleSummaryRows.map((summary) => summary.original_url),
		]),
	);
	const summaryLanguageCodesByUrlAfterSave = articleSummarySaveOk
		? await loadExistingSummaryLanguageCodes(env, config, articleUrlsWithNewOrRecoveredTranslations)
		: new Map<string, Set<SummaryLanguageCode>>();
	const fullyTranslatedArticleUrls = getFullyTranslatedOriginalUrls(
		articleUrlsWithNewOrRecoveredTranslations,
		summaryLanguageCodesByUrlAfterSave,
		config.enabledSummaryLanguages,
	);
	const articleSummaryPublishOk = articleSaveOk
		? await publishArticlesBatch(
			env,
			config,
			shouldHoldAcceptedArticlesForTranslations(config)
				? fullyTranslatedArticleUrls
				: acceptedArticleRows.map((article) => article.original_url),
		)
		: false;
	const articleSummaryPublishCount = shouldHoldAcceptedArticlesForTranslations(config)
		? fullyTranslatedArticleUrls.length
		: acceptedArticleRows.length;
	const publicFeedSnapshotRefreshOk = articleSaveOk ? await refreshPublicFeedSnapshot(env, config) : false;

	await logInfo(env, 'worker.translation.summary_completed', 'Article summary translation step completed', {
		shardIndex,
		enabledSummaryLanguages: config.enabledSummaryLanguages,
		summaryTranslationLimit: config.summaryTranslationLimit,
		acceptedArticleCount: acceptedArticleRows.length,
		articleSummaryTranslationCount: articleSummaryRows.length,
		articleSummaryTranslationTaskBudget: getSummaryTranslationTaskBudget(config),
		articleSummaryLocalTranslationCount: articleSummaryBuildResult.localTranslationCount,
		articleSummaryOpenAiTranslationCount: articleSummaryBuildResult.openAiTranslationCount,
		translationProviderOrder: getSummaryTranslationProviderOrder(config),
		articleSummaryAttemptedTaskCount: articleSummaryBuildResult.attemptedTaskCount,
		articleSummaryFailedTaskCount: articleSummaryBuildResult.failedTaskCount,
		articleSummaryFailureSamples: articleSummaryBuildResult.failureSamples,
		articleSummarySkippedByLimitArticleCount: articleSummaryBuildResult.skippedByLimitArticleCount,
		articleSummarySkippedByLimitLanguageTaskCount: articleSummaryBuildResult.skippedByLimitLanguageTaskCount,
		articleSummarySaveOk,
		articleSummarySaveErrorSamples: articleSummarySaveResult.errorSamples,
		articleSummaryRecoveryCandidateCount: articleSummaryBuildResult.recoveryCandidateCount,
		articleSummaryRecoveryAttemptedTaskCount: articleSummaryBuildResult.recoveryAttemptedTaskCount,
		articleSummaryPublishCount,
		articleSummaryPublishOk,
	});

	const previousFeedHealth = await getFeedHealthSnapshots(env, config);
	const feedHealthRows = buildFeedHealthRows(rssFetchResult.feedResults, feedOutcomeCounts, previousFeedHealth, new Date());
	const feedHealthSaveOk = await saveFeedHealthBatch(env, config, feedHealthRows);

	const reviewSaveOk = await saveArticleReviewsBatch(env, config, reviewRows);
	const reviewRowsEligibleForKvProcessedCache = getReviewRowsEligibleForKvProcessedCache(reviewRows);
	const kvProcessedUrlSaveOk = reviewSaveOk
		? await rememberProcessedUrlsInKv(
			env,
			shardIndex,
			reviewRowsEligibleForKvProcessedCache.map((row) => row.original_url),
		)
		: false;

	const openAiReviewedArticles = aiReviewedArticles.filter((reviewedArticle) => reviewedArticle.aiProvider === 'openai');
	const localAiReviewedArticles = aiReviewedArticles.filter((reviewedArticle) => reviewedArticle.aiProvider === 'local');
	const openAiUsage = sumOpenAiUsage(aiReviewedArticles);
	const localAiUsage = sumLocalAiUsage(aiReviewedArticles);
	const estimatedOpenAiCostUsd = estimateOpenAiCost(openAiUsage, config);
	const openAiAcceptedCount = openAiReviewedArticles.filter((reviewedArticle) => reviewedArticle.aiDecision.decision === 'accept').length;
	const openAiRejectedCount = openAiReviewedArticles.filter((reviewedArticle) => reviewedArticle.aiDecision.decision === 'reject').length;
	const localAiAcceptedCount = localAiReviewedArticles.filter((reviewedArticle) => reviewedArticle.aiDecision.decision === 'accept').length;
	const localAiRejectedCount = localAiReviewedArticles.filter((reviewedArticle) => reviewedArticle.aiDecision.decision === 'reject').length;
	const localAiDurationMs = sumReviewDuration(aiReviewedArticles, 'local');
	const costProtectionLimitReached = articlesEligibleForAi.length > articlesForAi.length;

	const runCompletedAt = new Date();
	const durationMs = Date.now() - refreshStartedAt;

	const aiUsageRunBase: AiUsageRunInsert = {
		run_started_at: new Date(refreshStartedAt).toISOString(),
		run_completed_at: runCompletedAt.toISOString(),
		run_source: options.runSource ?? 'unknown',
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
		ai_provider: config.aiProvider,
		local_ai_model: config.localAiModel,
		local_ai_call_count: localAiReviewedArticles.length,
		local_ai_prompt_tokens: localAiUsage.promptTokens,
		local_ai_completion_tokens: localAiUsage.completionTokens,
		local_ai_total_tokens: localAiUsage.totalTokens,
		local_ai_accepted_count: localAiAcceptedCount,
		local_ai_rejected_count: localAiRejectedCount,
		local_ai_duration_ms: localAiDurationMs,
		openai_model: OPENAI_MODEL,
		openai_call_count: openAiReviewedArticles.length,
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

	const spikeWarningTriggered = shouldTriggerOpenAiUsageWarning(aiUsageRunBase, config);

	const aiUsageRun: AiUsageRunInsert = {
		...aiUsageRunBase,
		spike_warning_triggered: spikeWarningTriggered,
	};

	if (spikeWarningTriggered) {
		await logWarn(env, 'worker.openai.usage_spike', 'OpenAI usage warning threshold reached', {
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
		});
	}

	const aiUsageSaveOk = await saveAiUsageRun(env, config, aiUsageRun);
	const redisEnabled = await isUpstashRedisEnabled(env);

	const resultWithoutWorkerRunSaveStatus: Omit<RefreshResult, 'workerRunSaveOk'> = {
		message: 'NutsNews refresh complete',
		shardIndex,
		feedsPerShard,
		maxAiReviews,
		articlePageImageLookupLimit,
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
		aiProvider: config.aiProvider,
		aiReviewProviderOrder: getAiReviewProviderOrder(config),
		localAiConfigured: hasLocalAiReviewConfig(config),
		openAiFallbackEnabled: config.aiProviderFallbackToOpenAi,
		localAiModel: config.localAiModel,
		localAiCallCount: localAiReviewedArticles.length,
		localAiPromptTokens: localAiUsage.promptTokens,
		localAiCompletionTokens: localAiUsage.completionTokens,
		localAiTotalTokens: localAiUsage.totalTokens,
		localAiAcceptedCount,
		localAiRejectedCount,
		localAiDurationMs,
		acceptedCount,
		rejectedCount,
		reviewSaveOk,
		articleSaveOk,
		articleSummaryTranslationCount: articleSummaryRows.length,
		articleSummaryTranslationTaskBudget: getSummaryTranslationTaskBudget(config),
		articleSummaryLocalTranslationCount: articleSummaryBuildResult.localTranslationCount,
		articleSummaryOpenAiTranslationCount: articleSummaryBuildResult.openAiTranslationCount,
		translationProviderOrder: getSummaryTranslationProviderOrder(config),
		articleSummaryAttemptedTaskCount: articleSummaryBuildResult.attemptedTaskCount,
		articleSummaryFailedTaskCount: articleSummaryBuildResult.failedTaskCount,
		articleSummaryFailureSamples: articleSummaryBuildResult.failureSamples,
		articleSummarySkippedByLimitArticleCount: articleSummaryBuildResult.skippedByLimitArticleCount,
		articleSummarySkippedByLimitLanguageTaskCount: articleSummaryBuildResult.skippedByLimitLanguageTaskCount,
		articleSummarySaveOk,
		articleSummarySaveErrorSamples: articleSummarySaveResult.errorSamples,
		articleSummaryRecoveryCandidateCount: articleSummaryBuildResult.recoveryCandidateCount,
		articleSummaryRecoveryAttemptedTaskCount: articleSummaryBuildResult.recoveryAttemptedTaskCount,
		articleSummaryPublishCount,
		articleSummaryPublishOk,
		publicFeedSnapshotRefreshOk,
		feedHealthSaveOk,
		aiUsageSaveOk,
		openAiModel: OPENAI_MODEL,
		openAiCallCount: openAiReviewedArticles.length,
		openAiPromptTokens: openAiUsage.promptTokens,
		openAiCompletionTokens: openAiUsage.completionTokens,
		openAiTotalTokens: openAiUsage.totalTokens,
		estimatedOpenAiCostUsd: aiUsageRun.estimated_openai_cost_usd,
		openAiAcceptedCount,
		openAiRejectedCount,
		costProtectionLimitReached,
		spikeWarningTriggered,
		kvEnabled: isKvEnabled(env),
		kvProcessedUrlHitCount: kvProcessedUrlLookup.hitCount,
		kvProcessedUrlSaveOk,
		kvRunStateSaveOk: false,
		redisEnabled,
		redisAiReviewLockAcquiredCount: aiReviewLockResult.acquiredCount,
		redisAiReviewLockSkippedCount: aiReviewLockResult.skippedCount,
		redisStatsSaveOk: false,
		durationMs,
	};

	const workerRunSaveOk = await saveWorkerRun(
		env,
		config,
		buildSuccessfulWorkerRun(resultWithoutWorkerRunSaveStatus, {
			runStartedAt: refreshStartedAt,
			runCompletedAt,
			runSource: options.runSource ?? 'unknown',
			requestId: options.requestId ?? null,
		}),
	);

	const resultBeforeKvRunStateSave: RefreshResult = {
		...resultWithoutWorkerRunSaveStatus,
		workerRunSaveOk,
	};

	const kvRunStateSaveOk = await saveRunStateToKv(env, resultBeforeKvRunStateSave, {
		runStartedAt: refreshStartedAt,
		runCompletedAt,
		runSource: options.runSource ?? 'unknown',
		requestId: options.requestId ?? null,
	});

	const resultBeforeRedisStatsSave: RefreshResult = {
		...resultBeforeKvRunStateSave,
		kvRunStateSaveOk,
	};

	const redisStatsSaveOk = await recordRedisWorkerStats(env, resultBeforeRedisStatsSave, options.runSource ?? 'unknown');

	const result: RefreshResult = {
		...resultBeforeRedisStatsSave,
		redisStatsSaveOk,
	};

	await logInfo(env, 'worker.refresh.completed', 'NutsNews Worker refresh completed', result);

	return result;
}


async function translateSummaryBacklog(
	env: Env,
	options: { runSource: 'manual' | 'scheduled' | 'unknown'; requestId?: string | null },
): Promise<TranslationBacklogResult> {
	const startedAt = Date.now();
	const config = await getRuntimeConfig(env);
	const shardIndex = getShardIndex(env);

	await logInfo(env, 'worker.translation.backlog_started', 'Worker translation backlog run started', {
		shardIndex,
		runSource: options.runSource,
		requestId: options.requestId ?? null,
		enabledSummaryLanguages: config.enabledSummaryLanguages,
		summaryTranslationLimit: config.summaryTranslationLimit,
		summaryTranslationTaskBudget: getSummaryTranslationTaskBudget(config),
		translationProviderOrder: getSummaryTranslationProviderOrder(config),
		holdArticlesForTranslations: shouldHoldAcceptedArticlesForTranslations(config),
	});

	const articleSummaryBuildResult = await buildArticleSummaryTranslations(env, config, []);
	const articleSummaryRows = articleSummaryBuildResult.summaries;
	const articleSummarySaveResult = await saveArticleSummariesBatch(env, config, articleSummaryRows);
	const articleSummarySaveOk = articleSummarySaveResult.ok;
	const articleUrlsWithNewOrRecoveredTranslations = Array.from(new Set(articleSummaryRows.map((summary) => summary.original_url)));
	const summaryLanguageCodesByUrlAfterSave = articleSummarySaveOk
		? await loadExistingSummaryLanguageCodes(env, config, articleUrlsWithNewOrRecoveredTranslations)
		: new Map<string, Set<SummaryLanguageCode>>();
	const fullyTranslatedArticleUrls = getFullyTranslatedOriginalUrls(
		articleUrlsWithNewOrRecoveredTranslations,
		summaryLanguageCodesByUrlAfterSave,
		config.enabledSummaryLanguages,
	);
	const articleSummaryPublishOk = articleSummarySaveOk ? await publishArticlesBatch(env, config, fullyTranslatedArticleUrls) : false;
	const publicFeedSnapshotRefreshOk = articleSummarySaveOk && fullyTranslatedArticleUrls.length > 0 ? await refreshPublicFeedSnapshot(env, config) : true;

	const result: TranslationBacklogResult = {
		message: 'NutsNews translation backlog run complete',
		shardIndex,
		enabledSummaryLanguages: config.enabledSummaryLanguages,
		summaryTranslationLimit: config.summaryTranslationLimit,
		articleSummaryTranslationTaskBudget: getSummaryTranslationTaskBudget(config),
		articleSummaryTranslationCount: articleSummaryRows.length,
		articleSummaryLocalTranslationCount: articleSummaryBuildResult.localTranslationCount,
		articleSummaryOpenAiTranslationCount: articleSummaryBuildResult.openAiTranslationCount,
		translationProviderOrder: getSummaryTranslationProviderOrder(config),
		articleSummaryAttemptedTaskCount: articleSummaryBuildResult.attemptedTaskCount,
		articleSummaryFailedTaskCount: articleSummaryBuildResult.failedTaskCount,
		articleSummaryFailureSamples: articleSummaryBuildResult.failureSamples,
		articleSummaryRecoveryCandidateCount: articleSummaryBuildResult.recoveryCandidateCount,
		articleSummaryRecoveryAttemptedTaskCount: articleSummaryBuildResult.recoveryAttemptedTaskCount,
		articleSummarySaveOk,
		articleSummarySaveErrorSamples: articleSummarySaveResult.errorSamples,
		articleSummaryPublishCount: fullyTranslatedArticleUrls.length,
		articleSummaryPublishOk,
		publicFeedSnapshotRefreshOk,
		durationMs: Date.now() - startedAt,
	};

	await logInfo(env, 'worker.translation.backlog_completed', 'Worker translation backlog run completed', result);

	return result;
}

function parseManualLimit(url: URL): number | undefined {
	const limitParam = url.searchParams.get('limit');

	if (!limitParam) {
		return undefined;
	}

	const limit = Number(limitParam);

	if (Number.isNaN(limit) || limit < 1) {
		return undefined;
	}

	return Math.floor(limit);
}

function parseManualImageLookupLimit(url: URL): number | undefined {
	const lookupParam = url.searchParams.get('imageLookups') ?? url.searchParams.get('imageLookupLimit');

	if (!lookupParam) {
		return undefined;
	}

	const lookupLimit = Number(lookupParam);

	if (Number.isNaN(lookupLimit) || lookupLimit < 0) {
		return undefined;
	}

	return Math.floor(lookupLimit);
}


function parseWorkerRequestMode(url: URL): WorkerRequestMode {
	const mode = (url.searchParams.get('mode') ?? '').trim().toLowerCase();

	if (url.pathname === '/translate-backlog' || mode === 'translate-backlog' || mode === 'translation-backlog') {
		return 'translate-backlog';
	}

	return 'refresh';
}

function createRequestId() {
	return crypto.randomUUID();
}

export default {
	async fetch(request: Request, env: Env) {
		const requestStartedAt = Date.now();
		const requestId = createRequestId();
		const url = new URL(request.url);

		if (url.pathname === '/favicon.ico') {
			return new Response(null, {
				status: 204,
			});
		}

		if (url.pathname === '/kv-status') {
			return Response.json(await readKvStatus(env));
		}

		if (url.pathname === '/redis-status') {
			return Response.json(await readRedisStatus(env));
		}

		if (url.pathname === '/log-test') {
			await logInfo(env, 'worker.log_test.completed', 'Worker Better Stack log test completed', {
				requestId,
				path: url.pathname,
				shardIndex: getShardIndex(env),
			});

			await flushBetterStackLogs(env, {
				requestId,
				runSource: 'manual',
				path: url.pathname,
				flushReason: 'log_test',
				durationMs: Date.now() - requestStartedAt,
			});

			return Response.json({
				ok: true,
				message: 'Worker Better Stack test log buffered and flushed once.',
				searchInBetterStackFor: {
					service: 'nutsnews-worker',
					event: 'worker.logs.flushed',
					level: 'info',
					shardIndex: getShardIndex(env),
				},
			});
		}

		if (url.pathname === '/sentry-test') {
			throw new Error('NutsNews Worker Sentry test error');
		}

		await logInfo(env, 'worker.request.started', 'Worker manual request started', {
			requestId,
			method: request.method,
			path: url.pathname,
			query: url.search,
			shardIndex: getShardIndex(env),
		});

		const requestMode = parseWorkerRequestMode(url);
		const maxAiReviews = requestMode === 'refresh' ? parseManualLimit(url) : undefined;
		const imageLookupLimit = requestMode === 'refresh' ? parseManualImageLookupLimit(url) : undefined;
		const rateLimit = await checkManualRefreshRateLimit(env, request);

		if (!rateLimit.allowed) {
			await logWarn(env, 'worker.redis.manual_rate_limit_blocked', 'Manual Worker refresh blocked by Upstash Redis rate limit', {
				requestId,
				shardIndex: getShardIndex(env),
				count: rateLimit.count,
				limit: rateLimit.limit,
				windowSeconds: rateLimit.windowSeconds,
			});

			await flushBetterStackLogs(env, {
				requestId,
				runSource: 'manual',
				path: url.pathname,
				flushReason: 'manual_rate_limited',
				durationMs: Date.now() - requestStartedAt,
			});

			return Response.json(
				{
					message: 'Manual NutsNews refresh rate limit reached. Try again later.',
					requestId,
					redisEnabled: rateLimit.enabled,
					count: rateLimit.count,
					limit: rateLimit.limit,
					windowSeconds: rateLimit.windowSeconds,
				},
				{ status: 429 },
			);
		}

		const workerLock = await acquireRedisWorkerRunLock(env, requestId);

		if (workerLock.enabled && !workerLock.acquired) {
			await logWarn(env, 'worker.redis.manual_refresh_lock_skipped', 'Manual Worker refresh skipped because shard lock is active', {
				requestId,
				shardIndex: getShardIndex(env),
				lockKey: workerLock.key,
			});

			await flushBetterStackLogs(env, {
				requestId,
				runSource: 'manual',
				path: url.pathname,
				flushReason: 'manual_lock_skipped',
				durationMs: Date.now() - requestStartedAt,
			});

			return Response.json({
				message: 'NutsNews Worker request skipped because this shard is already running.',
				requestId,
				mode: requestMode,
				skipped: true,
				redisEnabled: true,
				shardIndex: getShardIndex(env),
			});
		}

		try {
			const result =
				requestMode === 'translate-backlog'
					? await translateSummaryBacklog(env, {
						runSource: 'manual',
						requestId,
					})
					: await refreshArticles(env, {
						maxAiReviews,
						imageLookupLimit,
						runSource: 'manual',
						requestId,
					});

			await logInfo(env, 'worker.request.completed', 'Worker manual request completed', {
				requestId,
				status: 200,
				mode: requestMode,
				shardIndex: getShardIndex(env),
				durationMs: Date.now() - requestStartedAt,
				result,
			});

			return Response.json({
				...result,
				mode: requestMode,
				requestId,
			});
		} catch (error) {
			await recordRedisWorkerFailure(env, 'manual');
			await saveFailedWorkerRun(env, {
				runStartedAt: requestStartedAt,
				runSource: 'manual',
				requestId,
				maxAiReviews,
				error,
			});

			await logError(env, 'worker.request.failed', 'Worker manual request failed', error, {
				requestId,
				status: 500,
				mode: requestMode,
				shardIndex: getShardIndex(env),
				durationMs: Date.now() - requestStartedAt,
			});

			return Response.json(
				{
					message: 'NutsNews Worker request failed',
					requestId,
					mode: requestMode,
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
		} finally {
			await releaseRedisLock(env, workerLock);
			await flushBetterStackLogs(env, {
				requestId,
				runSource: 'manual',
				path: url.pathname,
				flushReason: 'manual_request_finished',
				durationMs: Date.now() - requestStartedAt,
			});
		}
	},

	async scheduled(_event: ScheduledEvent, env: Env) {
		const requestStartedAt = Date.now();
		const requestId = createRequestId();

		await logInfo(env, 'worker.scheduled.started', 'Worker scheduled refresh started', {
			requestId,
			shardIndex: getShardIndex(env),
		});

		const workerLock = await acquireRedisWorkerRunLock(env, requestId);

		if (workerLock.enabled && !workerLock.acquired) {
			await logWarn(env, 'worker.redis.scheduled_refresh_lock_skipped', 'Scheduled Worker refresh skipped because shard lock is active', {
				requestId,
				shardIndex: getShardIndex(env),
				lockKey: workerLock.key,
			});

			await flushBetterStackLogs(env, {
				requestId,
				runSource: 'scheduled',
				flushReason: 'scheduled_lock_skipped',
				durationMs: Date.now() - requestStartedAt,
			});

			return;
		}

		try {
			const result = await refreshArticles(env, {
				runSource: 'scheduled',
				requestId,
			});

			await logInfo(env, 'worker.scheduled.completed', 'Worker scheduled refresh completed', {
				requestId,
				shardIndex: getShardIndex(env),
				durationMs: Date.now() - requestStartedAt,
				result,
			});
		} catch (error) {
			await recordRedisWorkerFailure(env, 'scheduled');
			await saveFailedWorkerRun(env, {
				runStartedAt: requestStartedAt,
				runSource: 'scheduled',
				requestId,
				error,
			});

			await logError(env, 'worker.scheduled.failed', 'Worker scheduled refresh failed', error, {
				requestId,
				shardIndex: getShardIndex(env),
				durationMs: Date.now() - requestStartedAt,
			});

			throw error;
		} finally {
			await releaseRedisLock(env, workerLock);
			await flushBetterStackLogs(env, {
				requestId,
				runSource: 'scheduled',
				flushReason: 'scheduled_finished',
				durationMs: Date.now() - requestStartedAt,
			});
		}
	},
};
