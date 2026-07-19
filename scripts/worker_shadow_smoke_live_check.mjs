#!/usr/bin/env node

const smokeToken = process.env.NUTSNEWS_SHADOW_SMOKE_TOKEN;
const configuredUrl = process.env.NUTSNEWS_SHADOW_SMOKE_URL || process.env.NUTSNEWS_SHADOW_SMOKE_WORKER_URL;
const timeoutMs = Number(process.env.NUTSNEWS_SHADOW_SMOKE_TIMEOUT_MS ?? '15000');
const attemptCount = Math.max(1, Math.floor(Number(process.env.NUTSNEWS_SHADOW_SMOKE_ATTEMPTS ?? '8')));
const retryDelayMs = Math.max(0, Math.floor(Number(process.env.NUTSNEWS_SHADOW_SMOKE_RETRY_DELAY_MS ?? '5000')));

function fail(message, details = undefined) {
	console.error(message);
	if (details !== undefined) {
		console.error(JSON.stringify(details, null, 2));
	}
	process.exit(1);
}

function buildSmokeUrl(value) {
	if (!value) {
		return null;
	}

	const url = new URL(value);
	if (url.pathname === '/' || url.pathname === '') {
		url.pathname = '/backend-shadow-smoke';
	} else if (!url.pathname.endsWith('/backend-shadow-smoke')) {
		url.pathname = `${url.pathname.replace(/\/+$/, '')}/backend-shadow-smoke`;
	}
	url.search = '';
	url.hash = '';
	return url.toString();
}

if (!smokeToken) {
	fail('Missing NUTSNEWS_SHADOW_SMOKE_TOKEN.');
}

let smokeUrl;
try {
	smokeUrl = buildSmokeUrl(configuredUrl);
} catch (error) {
	fail(`Invalid NUTSNEWS_SHADOW_SMOKE_URL/NUTSNEWS_SHADOW_SMOKE_WORKER_URL: ${error instanceof Error ? error.message : String(error)}`);
}

if (!smokeUrl) {
	fail('Missing NUTSNEWS_SHADOW_SMOKE_URL or NUTSNEWS_SHADOW_SMOKE_WORKER_URL.');
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSmokeFailure(response, json) {
	if (response.status >= 500) {
		return true;
	}

	return (
		response.status === 404 &&
		json &&
		typeof json === 'object' &&
		(json.error_code === 1042 || json.error_name === 'workers_dev_script_not_found')
	);
}

async function requestSmokeOnce() {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 15000);
	const response = await fetch(smokeUrl, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${smokeToken}`,
			Accept: 'application/json',
			'Cache-Control': 'no-store',
		},
		signal: controller.signal,
	});
	clearTimeout(timeout);

	const text = await response.text();
	try {
		return {
			response,
			json: text ? JSON.parse(text) : null,
		};
	} catch {
		throw new Error(`Shadow smoke endpoint did not return JSON. HTTP ${response.status}: ${text.slice(0, 1000)}`);
	}
}

let lastFailure = null;
let json = null;
let passedAttempt = 0;

for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
	try {
		const result = await requestSmokeOnce();
		json = result.json;

		if (result.response.ok) {
			passedAttempt = attempt;
			break;
		}

		lastFailure = {
			status: result.response.status,
			json,
		};

		if (!isRetryableSmokeFailure(result.response, json) || attempt === attemptCount) {
			break;
		}
	} catch (error) {
		lastFailure = {
			error: error instanceof Error ? error.message : String(error),
		};

		if (attempt === attemptCount) {
			break;
		}
	}

	await sleep(retryDelayMs);
}

try {
	if (!passedAttempt) {
		fail('Shadow smoke endpoint failed.', lastFailure);
	}

	if (json?.ok !== true || json.databaseProviderMode !== 'backend_postgres_shadow' || json.databaseProvider !== 'backend_postgres') {
		fail('Shadow smoke endpoint returned unexpected provider evidence.', json);
	}

	if (json.supabaseBindingsPresent !== false) {
		fail('Shadow smoke target unexpectedly has Supabase bindings present.', json);
	}

	if (json.backendRead?.operation !== 'loadBackpressureArticleCount') {
		fail('Shadow smoke endpoint did not exercise the expected bounded backend read.', json);
	}

	console.log(JSON.stringify({
		ok: true,
		smokeUrl,
		requestId: json.requestId,
		databaseProviderMode: json.databaseProviderMode,
		databaseProvider: json.databaseProvider,
		supabaseBindingsPresent: json.supabaseBindingsPresent,
		backendRead: json.backendRead,
		durationMs: json.durationMs,
		attempt: passedAttempt,
	}, null, 2));
} catch (error) {
	fail(`Shadow smoke request failed: ${error instanceof Error ? error.message : String(error)}`);
}
