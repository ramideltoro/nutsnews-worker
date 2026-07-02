export type SummaryLanguageCode = 'fr' | 'ja' | 'de-CH' | 'de' | 'el';

export type TranslationQualityIssue = {
	code: string;
	severity: 'warning' | 'critical';
	message: string;
	field?: 'title' | 'summary' | 'language_code';
};

export type TranslationQualityCandidate = {
	language_code?: string | null;
	title?: string | null;
	summary?: string | null;
	sourceTitle?: string | null;
	sourceSummary?: string | null;
};

export type TranslationQualityResult = {
	ok: boolean;
	issues: TranslationQualityIssue[];
};

const TITLE_MIN_CHARS = 6;
const TITLE_MAX_CHARS = 220;
const SUMMARY_MIN_CHARS = 80;
const SUMMARY_CRITICAL_MIN_CHARS = 40;
const SUMMARY_MAX_CHARS = 420;
const JAPANESE_SCRIPT_RE = /[\u3040-\u30ff\u3400-\u9fff]/;
const GREEK_SCRIPT_RE = /[\u0370-\u03ff]/;

const ENGLISH_MARKERS = new Set([
	'a',
	'about',
	'after',
	'and',
	'are',
	'as',
	'at',
	'be',
	'by',
	'community',
	'for',
	'from',
	'good',
	'has',
	'have',
	'help',
	'in',
	'is',
	'it',
	'new',
	'news',
	'of',
	'on',
	'people',
	'story',
	'that',
	'the',
	'their',
	'this',
	'to',
	'with',
]);

const TARGET_MARKERS: Record<SummaryLanguageCode, Set<string>> = {
	fr: new Set(['au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en', 'est', 'et', 'la', 'le', 'les', 'leur', 'leurs', 'mais', 'par', 'pour', 'que', 'qui', 'sur', 'une']),
	ja: new Set(),
	'de-CH': new Set(['auf', 'aus', 'das', 'dem', 'den', 'der', 'des', 'die', 'ein', 'eine', 'einen', 'einer', 'für', 'im', 'ist', 'mit', 'und', 'von', 'zu', 'über']),
	de: new Set(['auf', 'aus', 'das', 'dem', 'den', 'der', 'des', 'die', 'ein', 'eine', 'einen', 'einer', 'für', 'im', 'ist', 'mit', 'und', 'von', 'zu', 'über']),
	el: new Set(),
};

function normalizeWhitespace(value: string | null | undefined) {
	return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value: string | null | undefined) {
	return normalizeWhitespace(value)
		.toLocaleLowerCase('en-US')
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

function wordTokens(value: string) {
	return normalizeComparable(value).split(/\s+/).filter(Boolean);
}

function ratioForMarkers(tokens: string[], markers: Set<string>) {
	if (tokens.length === 0) {
		return 0;
	}

	return tokens.filter((token) => markers.has(token)).length / tokens.length;
}

function isSameText(left: string | null | undefined, right: string | null | undefined) {
	const normalizedLeft = normalizeComparable(left);
	const normalizedRight = normalizeComparable(right);

	return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function looksLikeEnglish(value: string, languageCode: SummaryLanguageCode) {
	if (languageCode === 'ja' || languageCode === 'el') {
		return false;
	}

	const tokens = wordTokens(value);

	if (tokens.length < 6) {
		return false;
	}

	const englishRatio = ratioForMarkers(tokens, ENGLISH_MARKERS);
	const targetRatio = ratioForMarkers(tokens, TARGET_MARKERS[languageCode]);

	return englishRatio >= 0.18 && targetRatio <= 0.05;
}

function pushIssue(issues: TranslationQualityIssue[], issue: TranslationQualityIssue) {
	issues.push(issue);
}

export function validateLocalizedSummaryCandidate(
	candidate: TranslationQualityCandidate,
	requestedLanguageCode: SummaryLanguageCode,
): TranslationQualityResult {
	const issues: TranslationQualityIssue[] = [];
	const rowLanguageCode = normalizeWhitespace(candidate.language_code);
	const title = normalizeWhitespace(candidate.title);
	const summary = normalizeWhitespace(candidate.summary);

	if (!rowLanguageCode) {
		pushIssue(issues, {
			code: 'missing_language_code',
			severity: 'critical',
			field: 'language_code',
			message: 'Translation row is missing language_code.',
		});
	} else if (rowLanguageCode !== requestedLanguageCode) {
		pushIssue(issues, {
			code: 'language_code_mismatch',
			severity: 'critical',
			field: 'language_code',
			message: `Translation row language_code is ${rowLanguageCode}, expected ${requestedLanguageCode}.`,
		});
	}

	if (!title) {
		pushIssue(issues, {
			code: 'missing_title',
			severity: 'critical',
			field: 'title',
			message: 'Translated title is missing.',
		});
	} else if (title.length < TITLE_MIN_CHARS) {
		pushIssue(issues, {
			code: 'short_title',
			severity: 'warning',
			field: 'title',
			message: `Translated title is short (${title.length} chars).`,
		});
	} else if (title.length > TITLE_MAX_CHARS) {
		pushIssue(issues, {
			code: 'long_title',
			severity: 'warning',
			field: 'title',
			message: `Translated title is long (${title.length} chars).`,
		});
	}

	if (!summary) {
		pushIssue(issues, {
			code: 'missing_summary',
			severity: 'critical',
			field: 'summary',
			message: 'Translated summary is missing.',
		});
	} else if (summary.length < SUMMARY_CRITICAL_MIN_CHARS) {
		pushIssue(issues, {
			code: 'summary_too_short',
			severity: 'critical',
			field: 'summary',
			message: `Translated summary is too short (${summary.length} chars).`,
		});
	} else if (summary.length < SUMMARY_MIN_CHARS) {
		pushIssue(issues, {
			code: 'short_summary',
			severity: 'warning',
			field: 'summary',
			message: `Translated summary is shorter than the preferred range (${summary.length} chars).`,
		});
	} else if (summary.length > SUMMARY_MAX_CHARS) {
		pushIssue(issues, {
			code: 'long_summary',
			severity: 'warning',
			field: 'summary',
			message: `Translated summary is longer than the preferred range (${summary.length} chars).`,
		});
	}

	if (title && isSameText(title, candidate.sourceTitle)) {
		pushIssue(issues, {
			code: 'title_matches_english_source',
			severity: 'critical',
			field: 'title',
			message: 'Translated title matches the English source title.',
		});
	}

	if (summary && isSameText(summary, candidate.sourceSummary)) {
		pushIssue(issues, {
			code: 'summary_matches_english_source',
			severity: 'critical',
			field: 'summary',
			message: 'Translated summary matches the English source summary.',
		});
	}

	if (summary && requestedLanguageCode === 'ja' && !JAPANESE_SCRIPT_RE.test(`${title} ${summary}`)) {
		pushIssue(issues, {
			code: 'missing_japanese_script',
			severity: 'critical',
			field: 'summary',
			message: 'Japanese translation does not contain Japanese script.',
		});
	}

	if (summary && requestedLanguageCode === 'el' && !GREEK_SCRIPT_RE.test(`${title} ${summary}`)) {
		pushIssue(issues, {
			code: 'missing_greek_script',
			severity: 'critical',
			field: 'summary',
			message: 'Greek translation does not contain Greek script.',
		});
	}

	if (summary && looksLikeEnglish(`${title} ${summary}`, requestedLanguageCode)) {
		pushIssue(issues, {
			code: 'looks_like_english',
			severity: 'warning',
			field: 'summary',
			message: `Translation looks like English text stored under ${requestedLanguageCode}.`,
		});
	}

	return {
		ok: !issues.some((issue) => issue.severity === 'critical'),
		issues,
	};
}
