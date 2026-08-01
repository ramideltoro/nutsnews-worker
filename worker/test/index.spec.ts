import { afterEach, describe, it, expect, vi } from "vitest";
import { __test } from "../src/index";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

class MemoryKv {
	readonly store = new Map<string, string>();
	readonly putOptions = new Map<string, unknown>();

	async get<T>(key: string, type?: "json"): Promise<T | string | null> {
		const value = this.store.get(key);

		if (value === undefined) {
			return null;
		}

		return type === "json" ? JSON.parse(value) as T : value;
	}

	async put(key: string, value: string, options?: unknown): Promise<void> {
		this.store.set(key, value);
		this.putOptions.set(key, options);
	}
}

const baseArticles = [
	{
		id: "localized-edge-1",
		source: "NutsNews Test",
		title: "Neighbors restore a garden",
		original_url: "https://example.test/garden",
		image_url: "https://example.test/garden.jpg",
		published_at: "2026-07-20T12:00:00.000Z",
		published_on_site_at: "2026-07-20T12:00:00.000Z",
		ai_summary: "Neighbors restore a shared garden for families and students.",
		category: "Community | Uplifting",
		positivity_score: 9,
	},
	{
		id: "localized-edge-2",
		source: "NutsNews Test",
		title: "Students build library shelves",
		original_url: "https://example.test/library",
		image_url: "https://example.test/library.jpg",
		published_at: "2026-07-20T11:00:00.000Z",
		published_on_site_at: "2026-07-20T11:00:00.000Z",
		ai_summary: "Students build library shelves for a neighborhood reading room.",
		category: "Education | Uplifting",
		positivity_score: 8,
	},
];

function rowsForLanguage(languageCode: "en" | "fr" | "ja" | "de-CH" | "de" | "el") {
	if (languageCode === "fr") {
		return [
			{
				...baseArticles[0],
				title: "Des voisins restaurent un jardin",
				ai_summary: "Des voisins restaurent un jardin commun pour les familles et les etudiants.",
				language_code: "fr",
				requested_language_code: "fr",
				translation_available: true,
			},
			{
				...baseArticles[1],
				language_code: "en",
				requested_language_code: "fr",
				translation_available: false,
			},
		];
	}

	return baseArticles.map((article) => ({
		...article,
		language_code: "en",
		requested_language_code: languageCode,
		translation_available: languageCode === "en",
	}));
}

describe("localized public feed edge snapshots", () => {
	it("publishes one KV snapshot per supported language and serves the requested language", async () => {
		const kv = new MemoryKv();
		const requestedLanguages: string[] = [];
		const testEnv = {
			NUTSNEWS_KV: kv,
			FEED_SHARD_INDEX: "0",
			PUBLIC_FEED_EDGE_SNAPSHOT_LIMIT: "10",
		};
		const config = {
			databaseProviderMode: "backend_postgres_primary",
			database: {
				provider: "backend_postgres",
				async loadPublicFeedSnapshotRowsForEdge(_limit: number, languageCode: "en" | "fr" | "ja" | "de-CH" | "de" | "el") {
					requestedLanguages.push(languageCode);
					return rowsForLanguage(languageCode);
				},
			},
		};

		const result = await __test.publishPublicFeedEdgeSnapshotToKv(testEnv as any, config as any, "2026-07-20T12:30:00.000Z");

		expect(result).toEqual({ ok: true, articleCount: 2 });
		expect(requestedLanguages).toEqual(["en", "fr", "ja", "de-CH", "de", "el"]);
		expect(kv.store.has(__test.getPublicFeedEdgeSnapshotKvKey("en"))).toBe(true);
		expect(kv.store.has(__test.getPublicFeedEdgeSnapshotKvKey("fr"))).toBe(true);
		expect(kv.putOptions.get(__test.getPublicFeedEdgeSnapshotKvKey("en"))).toBeUndefined();
		expect(kv.putOptions.get(__test.getPublicFeedEdgeSnapshotKvKey("fr"))).toBeUndefined();

		const response = await __test.servePublicFeedEdgeSnapshot(
			testEnv as any,
			new URL("https://worker.example.test/public-feed-snapshot?lang=fr&pageSize=2"),
		);
		const payload = await response.json() as any;

		expect(response.status).toBe(200);
		expect(response.headers.get("X-NutsNews-Edge-Snapshot-Language")).toBe("fr");
		expect(payload.languageCode).toBe("fr");
		expect(payload.articles[0].title).toBe("Des voisins restaurent un jardin");
		expect(payload.articles[0].language_code).toBe("fr");
		expect(payload.articles[0].requested_language_code).toBe("fr");
		expect(payload.articles[0].translation_available).toBe(true);
		expect(payload.articles[1].title).toBe("Students build library shelves");
		expect(payload.articles[1].language_code).toBe("en");
		expect(payload.articles[1].requested_language_code).toBe("fr");
		expect(payload.articles[1].translation_available).toBe(false);
	});

	it("returns a language-specific miss when the requested KV snapshot is absent", async () => {
		const response = await __test.servePublicFeedEdgeSnapshot(
			{ NUTSNEWS_KV: new MemoryKv() } as any,
			new URL("https://worker.example.test/public-feed-snapshot?lang=fr"),
		);
		const payload = await response.json() as any;

		expect(response.status).toBe(404);
		expect(payload.languageCode).toBe("fr");
		expect(payload.articles).toEqual([]);
		expect(payload.error).toContain("fr public feed edge snapshot");
	});
});

describe("post-publication cache invalidation", () => {
	const testRevalidationSecret = ["cache", "fixture", "signing", "value", "only"].join("-");

	it("signs the same canonical request payload as the Next.js endpoint", async () => {
		await expect(__test.signPublicCacheRevalidation(
			testRevalidationSecret,
			"1753920000",
			"feed-test",
			["public-feed"],
		)).resolves.toBe("41cff9c6274482ca2810f5ca3b17b0fb1636e185ca5c73db7e22fd90b8c42e5b");
	});

	it("retries a signed Next.js public-feed revalidation with a stable idempotency key", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response("temporary", { status: 503 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ revalidated: true }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await __test.invalidateNextPublicFeedCaches({
			NUTSNEWS_CACHE_REVALIDATION_URLS: "https://www.nutsnews.com/api/internal/cache/revalidate,ftp://invalid.example.test/revalidate",
			NUTSNEWS_CACHE_REVALIDATION_SECRET: testRevalidationSecret,
		} as any, "feed-idempotent-request");

		expect(result).toEqual({ ok: true, configured: true, targetCount: 1 });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [target, init] = fetchMock.mock.calls[1] as [string, RequestInit];
		expect(target).toBe("https://www.nutsnews.com/api/internal/cache/revalidate");
		expect(init.method).toBe("POST");
		expect(init.body).toBe(JSON.stringify({ tags: ["public-feed"] }));
		const headers = new Headers(init.headers);
		expect(headers.get("X-NutsNews-Request-Id")).toBe("feed-idempotent-request");
		expect(headers.get("X-NutsNews-Timestamp")).toMatch(/^\d{10}$/);
		expect(headers.get("X-NutsNews-Signature")).toMatch(/^sha256=[a-f0-9]{64}$/);
	});

	it("purges only the Cloudflare public-feed tag with a zone-scoped endpoint", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await __test.purgeCloudflarePublicFeedCache({
			CLOUDFLARE_ZONE_ID: "0123456789abcdef0123456789abcdef",
			CLOUDFLARE_CACHE_PURGE_API_TOKEN: "zone-scoped-test-token",
		} as any, "feed-cloudflare-request");

		expect(result).toEqual({ ok: true, configured: true, targetCount: 1 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(target).toBe("https://api.cloudflare.com/client/v4/zones/0123456789abcdef0123456789abcdef/purge_cache");
		expect(init.body).toBe(JSON.stringify({ tags: ["public-feed"] }));
		expect(new Headers(init.headers).get("Authorization")).toBe("Bearer zone-scoped-test-token");
	});
});

describe("article translation publish guard", () => {
	const readyUrl = "https://example.test/ready";
	const partialUrl = "https://example.test/partial";

	it("holds accepted articles when translations are enabled even if this run has zero translation budget", () => {
		expect(__test.shouldHoldAcceptedArticlesForTranslations({
			holdArticlesForTranslations: true,
			enabledSummaryLanguages: ["fr", "ja"],
			summaryTranslationLimit: 0,
		} as any)).toBe(true);
	});

	it("does not hold accepted articles when translation holding is disabled or no languages are enabled", () => {
		expect(__test.shouldHoldAcceptedArticlesForTranslations({
			holdArticlesForTranslations: false,
			enabledSummaryLanguages: ["fr"],
			summaryTranslationLimit: 5,
		} as any)).toBe(false);
		expect(__test.shouldHoldAcceptedArticlesForTranslations({
			holdArticlesForTranslations: true,
			enabledSummaryLanguages: [],
			summaryTranslationLimit: 5,
		} as any)).toBe(false);
	});

	it("identifies publishable and blocked URLs from existing summary rows", () => {
		const readiness = __test.getArticlePublishTranslationReadiness(
			[readyUrl, partialUrl],
			["fr", "ja"],
			[
				{ original_url: readyUrl, language_code: "fr" },
				{ original_url: readyUrl, language_code: "ja" },
				{ original_url: partialUrl, language_code: "fr" },
			],
		);

		expect(readiness).toEqual({
			publishableOriginalUrls: [readyUrl],
			blockedCount: 1,
			missingTranslations: [
				{
					original_url: partialUrl,
					language_code: "ja",
				},
			],
		});
	});

	it("direct Supabase mode publishes only URLs with every required summary row", async () => {
		const patchUrls: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const requestUrl = String(input);

			if (requestUrl.includes("/rest/v1/article_summaries")) {
				return Response.json([
					{ original_url: readyUrl, language_code: "fr" },
					{ original_url: readyUrl, language_code: "ja" },
					{ original_url: partialUrl, language_code: "fr" },
				]);
			}

			if (requestUrl.includes("/rest/v1/articles")) {
				patchUrls.push(requestUrl);
				expect(init?.method).toBe("PATCH");
				expect(init?.body).toBe(JSON.stringify({ status: "published" }));
				return new Response(null, { status: 204 });
			}

			throw new Error(`Unexpected fetch URL ${requestUrl}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const client = new __test.SupabaseWorkerDatabaseClient(
			"supabase_primary",
			"https://supabase.example.test",
			"service-role-key",
		);
		const result = await client.publishArticlesBatch({
			originalUrls: [readyUrl, partialUrl],
			languageCodes: ["fr", "ja"],
		});

		expect(result).toEqual({
			ok: false,
			requestedCount: 2,
			publishedCount: 1,
			blockedCount: 1,
			missingTranslations: [
				{
					original_url: partialUrl,
					language_code: "ja",
				},
			],
		});
		expect(patchUrls).toHaveLength(1);
		expect(decodeURIComponent(patchUrls[0])).toContain(readyUrl);
		expect(decodeURIComponent(patchUrls[0])).not.toContain(partialUrl);
	});
});

describe("refresh subrequest budget", () => {
	const localFirstTranslationConfig = {
		enabledSummaryLanguages: ["fr", "ja", "de-CH", "de", "el"],
		summaryTranslationLimit: 5,
		localAiUrl: "https://local-ai.example.test",
		localAiApiKey: "test-key",
		aiProvider: "local",
		aiProviderFallbackToOpenAi: true,
	} as any;

	it("defers summary translation work for a live-shaped long refresh", () => {
		const budget = __test.createSubrequestBudget({
			WORKER_SUBREQUEST_SOFT_LIMIT: "45",
			WORKER_SUBREQUEST_RESERVE: "3",
		} as any);

		__test.recordEstimatedSubrequests(budget, __test.estimateRefreshSubrequestsBeforeSummary({
			feedCount: 20,
			kvProcessedUrlLookupRead: true,
			candidateUrlsNeedingDatabaseLookupCount: 196,
			imageHydrationLookupCount: 3,
			aiReviewAttemptCount: 6,
			acceptedArticleCount: 3,
			redisWorkerLockExtended: false,
			redisAiReviewLockEnabled: false,
		}));

		expect(__test.getSummaryTranslationTaskBudgetForSubrequests(
			budget,
			localFirstTranslationConfig,
			{ reserveAfterTranslation: 3 },
		)).toBe(0);
		expect(__test.trySpendSubrequestBudget(budget, "article_summary_translation_build", 8)).toBe(false);

		const snapshot = __test.snapshotSubrequestBudget(budget);
		expect(snapshot.deferredPhases).toContain("article_summary_translation_build");
		expect(snapshot.estimatedRemaining).toBe(7);
	});

	it("records optional persistence as deferred instead of spending past reserve", () => {
		const budget = __test.createSubrequestBudget({
			WORKER_SUBREQUEST_SOFT_LIMIT: "12",
			WORKER_SUBREQUEST_RESERVE: "2",
		} as any);

		__test.recordEstimatedSubrequests(budget, 8);

		expect(__test.trySpendSubrequestBudget(budget, "article_review_save", 1)).toBe(true);
		expect(__test.trySpendSubrequestBudget(budget, "public_feed_snapshot_refresh", 3)).toBe(false);

		const snapshot = __test.snapshotSubrequestBudget(budget);
		expect(snapshot.estimatedUsed).toBe(9);
		expect(snapshot.estimatedRemaining).toBe(1);
		expect(snapshot.deferredPhases).toEqual(["public_feed_snapshot_refresh"]);
	});
});
