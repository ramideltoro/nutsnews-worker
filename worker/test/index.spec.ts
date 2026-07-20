import { describe, it, expect } from "vitest";
import { __test } from "../src/index";

class MemoryKv {
	readonly store = new Map<string, string>();

	async get<T>(key: string, type?: "json"): Promise<T | string | null> {
		const value = this.store.get(key);

		if (value === undefined) {
			return null;
		}

		return type === "json" ? JSON.parse(value) as T : value;
	}

	async put(key: string, value: string): Promise<void> {
		this.store.set(key, value);
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
			PUBLIC_FEED_EDGE_SNAPSHOT_TTL_SECONDS: "3600",
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

describe("article translation publish guard", () => {
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
