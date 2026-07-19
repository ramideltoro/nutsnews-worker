#!/usr/bin/env node

const smokeToken = process.env.NUTSNEWS_SHADOW_SMOKE_TOKEN;
const configuredUrl = process.env.NUTSNEWS_SHADOW_SMOKE_URL || process.env.NUTSNEWS_SHADOW_SMOKE_WORKER_URL;
const timeoutMs = Number(process.env.NUTSNEWS_SHADOW_SMOKE_TIMEOUT_MS ?? '15000');

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

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 15000);

try {
	const response = await fetch(smokeUrl, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${smokeToken}`,
			Accept: 'application/json',
			'Cache-Control': 'no-store',
		},
		signal: controller.signal,
	});
	const text = await response.text();
	let json;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		fail(`Shadow smoke endpoint did not return JSON. HTTP ${response.status}`, text.slice(0, 1000));
	}

	if (!response.ok) {
		fail(`Shadow smoke endpoint failed. HTTP ${response.status}`, json);
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
	}, null, 2));
} catch (error) {
	fail(`Shadow smoke request failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
	clearTimeout(timeout);
}
