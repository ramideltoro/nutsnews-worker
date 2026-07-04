#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerSourcePath = path.join(repoRoot, "worker/src/index.ts");
const workerPackagePath = path.join(repoRoot, "worker/package.json");
const workerSource = fs.readFileSync(workerSourcePath, "utf8");

const fixtures = [
	{
		id: "medical-hardship-community-care",
		edgeCase: "medical hardship",
		expected: "accept",
		article: {
			source: "Positive News",
			title: "Neighbors turn cancer recovery meals into a lasting community care network",
			excerpt:
				"After one family's treatment year, volunteers built a cheerful meal train that now supports hundreds of recovering neighbors.",
		},
		localAiOutput: {
			decision: "accept",
			reason: "The hardship is framed around recovery, kindness, and sustained community support.",
		},
		fallbackOutput: {
			decision: "accept",
			reason: "This is a hopeful human-interest story about neighbors helping families recover.",
		},
	},
	{
		id: "disaster-recovery-rebuild",
		edgeCase: "disaster recovery",
		expected: "accept",
		article: {
			source: "Good Good Good",
			title: "Flood-hit library reopens as volunteers restore books, gardens, and after-school clubs",
			excerpt:
				"A town celebrates restoration work after volunteers salvaged shelves, replanted the courtyard, and brought children's programs back.",
		},
		localAiOutput: {
			decision: "accept",
			reason: "The story focuses on recovery, restoration, volunteers, and children returning to a positive community space.",
		},
		fallbackOutput: {
			decision: "accept",
			reason: "The disaster context is secondary to the uplifting recovery and volunteer restoration effort.",
		},
	},
	{
		id: "politics-adjacent-campaign",
		edgeCase: "politics-adjacent",
		expected: "reject",
		article: {
			source: "Reuters",
			title: "Mayor praises school gardens during election campaign stop",
			excerpt:
				"The president of the local party joined voters and campaign staff as candidates debated government funding.",
		},
		localAiOutput: {
			decision: "reject",
			reason: "The article is campaign, election, voters, and government focused despite a positive school-garden detail.",
		},
		fallbackOutput: {
			decision: "reject",
			reason: "The article is election and government focused despite a positive school-garden detail.",
		},
	},
	{
		id: "celebrity-kindness",
		edgeCase: "celebrity",
		expected: "accept",
		article: {
			source: "People",
			title: "Actor quietly funds music lessons for 500 students after visiting hometown school",
			excerpt:
				"The award-winning performer celebrated young musicians and donated instruments to expand a beloved arts program.",
		},
		localAiOutput: {
			decision: "accept",
			reason: "Celebrity involvement supports a concrete, uplifting donation for students and music education.",
		},
		fallbackOutput: {
			decision: "accept",
			reason: "This is a positive arts and education story with a clear community benefit.",
		},
	},
	{
		id: "finance-heavy-market",
		edgeCase: "finance",
		expected: "reject",
		article: {
			source: "CNBC",
			title: "Stocks rally as bank earnings beat forecasts and markets cheer profit growth",
			excerpt:
				"Investors watched inflation data, business forecasts, and money flows after a volatile week for the economy.",
		},
		localAiOutput: {
			decision: "reject",
			reason: "The story is dominated by markets, bank earnings, profit, inflation, business, and money.",
		},
		fallbackOutput: {
			decision: "reject",
			reason: "Money-heavy market coverage is outside NutsNews content safety criteria.",
		},
	},
	{
		id: "animal-rescue",
		edgeCase: "animal rescue",
		expected: "accept",
		article: {
			source: "The Dodo",
			title: "Rescued senior dog becomes a reading buddy for shy elementary students",
			excerpt:
				"Teachers say the gentle animal helps children practice aloud, celebrate progress, and build confidence after school.",
		},
		localAiOutput: {
			decision: "accept",
			reason: "This is a warm animal rescue and student confidence story.",
		},
		fallbackOutput: {
			decision: "accept",
			reason: "The story combines animal rescue, school support, and confidence-building in an uplifting way.",
		},
	},
	{
		id: "crime-tragedy",
		edgeCase: "crime and tragedy",
		expected: "reject",
		article: {
			source: "BBC Stories",
			title: "Community mourns after violent shooting leaves three dead",
			excerpt:
				"Police opened a murder investigation as families described grief after the tragic attack.",
		},
		localAiOutput: {
			decision: "reject",
			reason: "The article is about violence, shooting, death, murder, and grief.",
		},
		fallbackOutput: {
			decision: "reject",
			reason: "Crime and tragedy coverage is not appropriate for NutsNews.",
		},
	},
	{
		id: "war-relief",
		edgeCase: "war",
		expected: "reject",
		article: {
			source: "NPR",
			title: "Volunteers deliver art kits to children displaced by war after missile attacks",
			excerpt:
				"The effort brought moments of comfort, but the article centers on military conflict, attacks, and displacement.",
		},
		localAiOutput: {
			decision: "reject",
			reason: "The article is centered on war, missile attacks, military conflict, and displacement.",
		},
		fallbackOutput: {
			decision: "reject",
			reason: "The primary topic is war and missile attacks, so it should not enter the peaceful feed.",
		},
	},
];

function extractStringArrayConst(name) {
	const pattern = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`);
	const match = workerSource.match(pattern);
	assert(match, `Missing ${name} in worker/src/index.ts.`);
	return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function extractSetConst(name) {
	const pattern = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`);
	const match = workerSource.match(pattern);
	assert(match, `Missing ${name} in worker/src/index.ts.`);
	return new Set([...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]));
}

const hardNegativeKeywords = extractStringArrayConst("HARD_NEGATIVE_KEYWORDS");
const hardPositiveEscapeKeywords = extractStringArrayConst("HARD_POSITIVE_ESCAPE_KEYWORDS");
const strictLocalPrefilterSources = extractSetConst("STRICT_LOCAL_PREFILTER_SOURCES");

function countKeywordMatches(text, keywords) {
	return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

function shouldSkipBeforeAi(article, positiveSources = new Set()) {
	const text = `${article.source} ${article.title} ${article.excerpt}`.toLowerCase();
	const hardNegativeMatchCount = countKeywordMatches(text, hardNegativeKeywords);

	if (hardNegativeMatchCount === 0) {
		return false;
	}

	const positiveEscapeMatchCount = countKeywordMatches(text, hardPositiveEscapeKeywords);

	if (positiveSources.has(article.source)) {
		return hardNegativeMatchCount >= 3 && positiveEscapeMatchCount === 0;
	}

	if (strictLocalPrefilterSources.has(article.source)) {
		return hardNegativeMatchCount >= 1 && positiveEscapeMatchCount === 0;
	}

	return hardNegativeMatchCount >= 2 && positiveEscapeMatchCount === 0;
}

function normalizeDecision(output) {
	return output?.decision === "accept" ? "accept" : "reject";
}

function evaluateProvider(provider, fixture) {
	if (shouldSkipBeforeAi(fixture.article)) {
		return {
			provider,
			actual: "reject",
			reason: "Skipped before AI because the article matched hard negative local filters.",
		};
	}

	const output = provider === "local" ? fixture.localAiOutput : fixture.fallbackOutput;
	return {
		provider,
		actual: normalizeDecision(output),
		reason: output.reason || "No reason provided by fixture output.",
	};
}

function calculateMetrics(results) {
	const truePositive = results.filter((result) => result.expected === "accept" && result.actual === "accept").length;
	const falsePositive = results.filter((result) => result.expected === "reject" && result.actual === "accept").length;
	const falseNegative = results.filter((result) => result.expected === "accept" && result.actual === "reject").length;
	const trueNegative = results.filter((result) => result.expected === "reject" && result.actual === "reject").length;

	return {
		truePositive,
		falsePositive,
		falseNegative,
		trueNegative,
		precision: truePositive + falsePositive === 0 ? 1 : truePositive / (truePositive + falsePositive),
		recall: truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative),
	};
}

function formatPercent(value) {
	return `${(value * 100).toFixed(1)}%`;
}

assert.match(
	workerSource,
	/Reject politics, war, money, crime, tragedy, fear, conflict, elections, government, markets, inflation, business, stocks, military, and violence\./,
	"OpenAI fallback prompt must keep explicit stressful-topic rejection guidance.",
);
assert.match(
	workerSource,
	/Accept positive, uplifting, inspiring, human-interest, wellness, lifestyle, science, culture, animals, travel, community, nature, space, creativity, and remarkable achievement stories\./,
	"OpenAI fallback prompt must keep explicit uplifting-topic acceptance guidance.",
);
assert.match(workerSource, /function shouldSkipBeforeAi/, "Worker must keep the local hard-negative prefilter.");

const packageJson = JSON.parse(fs.readFileSync(workerPackagePath, "utf8"));
assert.equal(
	packageJson.scripts["test:ai-safety"],
	"node ../scripts/ai_content_safety_eval.mjs",
	"worker/package.json must expose the AI safety eval script.",
);

const results = fixtures.flatMap((fixture) => {
	return ["local", "fallback"].map((provider) => {
		const evaluated = evaluateProvider(provider, fixture);
		return {
			id: fixture.id,
			edgeCase: fixture.edgeCase,
			title: fixture.article.title,
			provider,
			expected: fixture.expected,
			actual: evaluated.actual,
			reason: evaluated.reason,
		};
	});
});

const failures = results.filter((result) => result.expected !== result.actual);
const metricsByProvider = new Map();
for (const provider of ["local", "fallback"]) {
	metricsByProvider.set(
		provider,
		calculateMetrics(results.filter((result) => result.provider === provider)),
	);
}
const overallMetrics = calculateMetrics(results);

console.log("NutsNews AI content safety eval");
console.log(`Fixtures: ${fixtures.length}`);
for (const [provider, metrics] of metricsByProvider) {
	console.log(
		`${provider}: precision=${formatPercent(metrics.precision)} recall=${formatPercent(metrics.recall)} ` +
			`tp=${metrics.truePositive} fp=${metrics.falsePositive} fn=${metrics.falseNegative} tn=${metrics.trueNegative}`,
	);
}
console.log(
	`overall: precision=${formatPercent(overallMetrics.precision)} recall=${formatPercent(overallMetrics.recall)} ` +
		`tp=${overallMetrics.truePositive} fp=${overallMetrics.falsePositive} fn=${overallMetrics.falseNegative} tn=${overallMetrics.trueNegative}`,
);

if (failures.length > 0) {
	console.error("\nAI content safety eval failures:");
	for (const failure of failures) {
		console.error(`- [${failure.provider}] ${failure.title}`);
		console.error(`  expected: ${failure.expected}`);
		console.error(`  actual: ${failure.actual}`);
		console.error(`  reason: ${failure.reason}`);
	}
	process.exit(1);
}

console.log("AI content safety eval passed.");
