#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const WORKER_DIR = resolve(REPO_ROOT, 'worker');

const BACKEND_API_TOKEN = 'shadow-smoke-route-backend-api-token';
const SHADOW_SMOKE_TOKEN = 'shadow-smoke-route-token';
const WORKER_PORT = 8827;
const BACKEND_API_PORT = 8927;
const WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`;
const BACKEND_API_URL = `http://127.0.0.1:${BACKEND_API_PORT}`;
const CONFIG_PATH = resolve(WORKER_DIR, 'wrangler.shadow-smoke-route.generated.jsonc');
const SERVER_CLOSE_TIMEOUT_MS = 1500;
const WORKER_FETCH_TIMEOUT_MS = 5000;

function assert(condition, message, details = undefined) {
	if (!condition) {
		const error = new Error(message);
		if (details !== undefined) {
			error.details = details;
		}
		throw error;
	}
}

function jsonResponse(response, status, payload) {
	response.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store',
	});
	response.end(JSON.stringify(payload));
}

async function readBody(request) {
	const chunks = [];
	for await (const chunk of request) {
		chunks.push(Buffer.from(chunk));
	}
	const raw = Buffer.concat(chunks).toString('utf8');
	return raw ? JSON.parse(raw) : null;
}

function sleep(ms) {
	return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function startServer(server, port, name) {
	return new Promise((resolvePromise, rejectPromise) => {
		server.once('error', rejectPromise);
		server.listen(port, '127.0.0.1', () => {
			server.off('error', rejectPromise);
			console.log(`✓ ${name} listening on http://127.0.0.1:${port}`);
			resolvePromise(server);
		});
	});
}

function closeServer(server) {
	if (!server) {
		return Promise.resolve();
	}

	return new Promise((resolvePromise) => {
		let resolved = false;
		const finish = () => {
			if (resolved) {
				return;
			}
			resolved = true;
			clearTimeout(timeout);
			resolvePromise();
		};
		const timeout = setTimeout(finish, SERVER_CLOSE_TIMEOUT_MS);
		timeout.unref?.();

		try {
			server.close(finish);
			server.closeIdleConnections?.();
			server.closeAllConnections?.();
		} catch {
			finish();
		}
	});
}

function startMockBackendApiServer(requestLog) {
	const writeOperations = new Set([
		'save-article-summaries-batch',
		'save-feed-health-batch',
		'save-article-reviews-batch',
		'save-accepted-articles-batch',
		'publish-articles-batch',
		'refresh-public-feed-snapshot',
		'save-ai-usage-run',
		'save-worker-run',
	]);

	const server = http.createServer(async (request, response) => {
		const url = new URL(request.url ?? '/', BACKEND_API_URL);
		const operation = url.pathname.replace(/^\/api\/worker\/db\/?/, '');

		if (!url.pathname.startsWith('/api/worker/db/')) {
			jsonResponse(response, 404, { error: `Unhandled path: ${url.pathname}` });
			return;
		}

		if (request.method !== 'POST') {
			jsonResponse(response, 405, { error: 'Expected POST.' });
			return;
		}

		if (request.headers.authorization !== `Bearer ${BACKEND_API_TOKEN}`) {
			jsonResponse(response, 401, { error: 'Invalid backend API token.' });
			return;
		}

		const body = await readBody(request);
		requestLog.push({
			operation,
			isWrite: writeOperations.has(operation),
			body,
		});

		if (operation === 'load-article-count-for-backpressure') {
			jsonResponse(response, 200, { articleCount: 42, error: null });
			return;
		}

		jsonResponse(response, 404, { error: `Unhandled backend operation: ${operation}` });
	});

	return startServer(server, BACKEND_API_PORT, 'Mock backend-compatible API');
}

function writeGeneratedWranglerConfig() {
	const config = {
		$schema: 'node_modules/wrangler/config-schema.json',
		name: 'nutsnews-worker-shadow-smoke-route-test',
		main: 'src/index.ts',
		compatibility_date: '2026-06-27',
		observability: { enabled: false },
		vars: {
			NUTSNEWS_DATABASE_PROVIDER_MODE: 'backend_postgres_shadow',
			ENABLE_BACKEND_SHADOW_SMOKE: 'true',
			NUTSNEWS_BACKEND_API_URL: BACKEND_API_URL,
			NUTSNEWS_BACKEND_API_TOKEN: BACKEND_API_TOKEN,
			NUTSNEWS_SHADOW_SMOKE_TOKEN: SHADOW_SMOKE_TOKEN,
			FEED_SHARD_INDEX: '0',
			FEEDS_PER_SHARD: '1',
			UPSTASH_REDIS_ENABLED: 'false',
		},
	};

	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
	return CONFIG_PATH;
}

function startWranglerDev() {
	const configPath = writeGeneratedWranglerConfig();
	const child = spawn('npx', ['wrangler', 'dev', '-c', configPath, '--port', String(WORKER_PORT), '--ip', '127.0.0.1'], {
		cwd: WORKER_DIR,
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: process.platform !== 'win32',
		env: {
			...process.env,
			WRANGLER_SEND_METRICS: 'false',
			NO_UPDATE_NOTIFIER: 'true',
		},
	});

	let output = '';
	const verbose = process.env.NUTSNEWS_SHADOW_SMOKE_VERBOSE === '1';
	child.stdout.on('data', (chunk) => {
		const text = chunk.toString();
		output += text;
		if (verbose) {
			process.stdout.write(text);
		}
	});
	child.stderr.on('data', (chunk) => {
		const text = chunk.toString();
		output += text;
		if (verbose) {
			process.stderr.write(text);
		}
	});

	return { child, getOutput: () => output };
}

async function fetchJson(url, init = {}) {
	const response = await fetchWithTimeout(url, init);
	const text = await response.text();
	let json;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		throw new Error(`${init.method ?? 'GET'} ${url} did not return JSON: ${text.slice(0, 1000)}`);
	}

	return { response, json };
}

async function fetchWithTimeout(url, init = {}, timeoutMs = WORKER_FETCH_TIMEOUT_MS) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(url, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

async function waitForWorker(workerProcess) {
	const deadline = Date.now() + 60000;
	let lastError = null;

	while (Date.now() < deadline) {
		if (workerProcess.child.exitCode !== null) {
			throw new Error(`wrangler dev exited early with code ${workerProcess.child.exitCode}.\n${workerProcess.getOutput()}`);
		}

		try {
			const { response } = await fetchJson(`${WORKER_URL}/kv-status`);
			if (response.ok) {
				return;
			}
		} catch (error) {
			lastError = error;
		}

		await sleep(750);
	}

	throw new Error(`Timed out waiting for Worker. Last error: ${lastError?.message ?? 'none'}\n${workerProcess.getOutput()}`);
}

async function stopWranglerDev(workerProcess) {
	if (!workerProcess?.child || workerProcess.child.exitCode !== null) {
		return;
	}

	if (process.platform === 'win32') {
		workerProcess.child.kill('SIGTERM');
	} else {
		try {
			process.kill(-workerProcess.child.pid, 'SIGTERM');
		} catch {
			workerProcess.child.kill('SIGTERM');
		}
	}

	await Promise.race([
		new Promise((resolvePromise) => workerProcess.child.once('exit', resolvePromise)),
		sleep(5000).then(() => {
			if (workerProcess.child.exitCode === null) {
				if (process.platform === 'win32') {
					workerProcess.child.kill('SIGKILL');
				} else {
					try {
						process.kill(-workerProcess.child.pid, 'SIGKILL');
					} catch {
						workerProcess.child.kill('SIGKILL');
					}
				}
			}
		}),
	]);
}

async function main() {
	const backendRequests = [];
	let backendServer;
	let workerProcess;

	try {
		console.log('▶ Running backend shadow smoke route regression');
		backendServer = await startMockBackendApiServer(backendRequests);
		workerProcess = startWranglerDev();
		await waitForWorker(workerProcess);

		const unauthorized = await fetchWithTimeout(`${WORKER_URL}/backend-shadow-smoke`);
		assert(unauthorized.status === 401, 'Shadow smoke route should reject missing bearer tokens.', unauthorized.status);

		const methodRejected = await fetchWithTimeout(`${WORKER_URL}/backend-shadow-smoke`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${SHADOW_SMOKE_TOKEN}`,
			},
		});
		assert(methodRejected.status === 405, 'Shadow smoke route should reject non-GET methods.', methodRejected.status);

		const { response, json } = await fetchJson(`${WORKER_URL}/backend-shadow-smoke`, {
			headers: {
				Authorization: `Bearer ${SHADOW_SMOKE_TOKEN}`,
			},
		});

		assert(response.status === 200, 'Shadow smoke route returned a non-OK status.', { status: response.status, json });
		assert(json.ok === true, 'Shadow smoke response should be ok.', json);
		assert(json.databaseProviderMode === 'backend_postgres_shadow', 'Shadow smoke response reported the wrong provider mode.', json);
		assert(json.databaseProvider === 'backend_postgres', 'Shadow smoke response should report backend_postgres as the exercised provider.', json);
		assert(json.supabaseBindingsPresent === false, 'Shadow smoke route should run without Supabase bindings.', json);
		assert(json.backendRead?.operation === 'loadBackpressureArticleCount', 'Shadow smoke route should exercise the bounded backend read.', json);
		assert(json.backendRead?.articleCount === 42, 'Shadow smoke route should return the mock backend article count.', json);

		assert(backendRequests.length === 1, 'Shadow smoke route should make exactly one backend request.', backendRequests);
		assert(backendRequests[0].operation === 'load-article-count-for-backpressure', 'Shadow smoke route called the wrong backend operation.', backendRequests);
		assert(backendRequests[0].isWrite === false, 'Shadow smoke route must not call backend write operations.', backendRequests);
		assert(backendRequests[0].body?.providerMode === 'backend_postgres_shadow', 'Backend smoke request should preserve provider mode.', backendRequests);
		assert(backendRequests[0].body?.contract === 'backend-api-compatibility-contract', 'Backend smoke request should include the compatibility contract marker.', backendRequests);

		console.log('✓ Backend shadow smoke route regression passed.');
	} catch (error) {
		console.error('Backend shadow smoke route regression failed.');
		console.error(error?.stack || error?.message || error);
		if (error?.details !== undefined) {
			console.error(JSON.stringify(error.details, null, 2));
		}
		process.exitCode = 1;
	} finally {
		await stopWranglerDev(workerProcess);
		await closeServer(backendServer);
		if (existsSync(CONFIG_PATH)) {
			unlinkSync(CONFIG_PATH);
		}
	}
}

main();
