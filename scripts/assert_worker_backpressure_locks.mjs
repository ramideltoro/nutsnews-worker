#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const workerSourcePath = path.join(repoRoot, 'worker', 'src', 'index.ts');
const workerSource = fs.readFileSync(workerSourcePath, 'utf8');

function assert(condition, message, details = undefined) {
	if (!condition) {
		const error = new Error(message);
		if (details !== undefined) {
			error.details = details;
		}
		throw error;
	}
}

function assertIncludes(needle, message) {
	assert(workerSource.includes(needle), message, { needle });
}

try {
	console.log('▶ Checking worker shard locks use holder-only lease extension');
	assertIncludes('function getUpstashRedisWorkerLockTtlSeconds', 'Worker lock TTL helper is missing.');
	assertIncludes('async function extendRedisLock', 'Redis lock extension helper is missing.');
	assertIncludes("redis.call('GET', KEYS[1]) == ARGV[1]", 'Redis lock extension/release must verify the current lock token.');
	assertIncludes("redis.call('EXPIRE', KEYS[1], ARGV[2])", 'Redis lock extension must refresh the lease TTL.');
	assertIncludes('worker.redis.worker_lock_extend_failed', 'Worker refresh must warn when shard lock lease extension fails.');
	assertIncludes('worker.redis.translation_lock_extend_failed', 'Translation backlog must warn when shard lock lease extension fails.');
	console.log('✓ Worker lock extension is token checked and visible');

	console.log('▶ Checking ingestion backpressure runs before expensive work');
	const backpressureIndex = workerSource.indexOf('buildBackpressureDecision(env, unreviewedArticlesBeforeImageHydration.length, backpressureDbCounts)');
	const deferredIndex = workerSource.indexOf('worker.backpressure.expensive_work_deferred');
	const imageHydrationIndex = workerSource.indexOf('hydrateMissingArticleImages(env, unreviewedArticlesBeforeImageHydration');
	const aiClaimIndex = workerSource.indexOf('const aiReviewLockResult = await claimArticlesForAiReviewWithRedis(', imageHydrationIndex);
	assert(backpressureIndex >= 0, 'Backpressure decision is missing.');
	assert(deferredIndex > backpressureIndex, 'Backpressure deferral log must happen after decision.');
	assert(imageHydrationIndex > deferredIndex, 'Image hydration must remain after backpressure deferral.');
	assert(aiClaimIndex > imageHydrationIndex, 'AI article claims must remain after image hydration.');
	assertIncludes('INGESTION_BACKPRESSURE_QUEUE_LIMIT', 'Queue backpressure env var is missing.');
	assertIncludes('INGESTION_BACKPRESSURE_DB_ARTICLE_LIMIT', 'DB-size backpressure env var is missing.');
	assertIncludes('loadBackpressureDbCounts', 'DB count backpressure probe is missing.');
	console.log('✓ Backpressure gates expensive work');

	console.log('▶ Checking worker reports queue, deferred, retried, locked, and processed counts');
	for (const field of [
		'queuedCount',
		'queuedBySource',
		'deferredCount',
		'deferredReasons',
		'retriedCount',
		'processedCount',
		'redisAiReviewLockSkippedCount',
		'lockedCount: 1',
	]) {
		assertIncludes(field, `Worker report is missing ${field}.`);
	}
	assertIncludes('buildQueueVisibilityBySource', 'Queue visibility by source/shard is missing.');
	assertIncludes('retryableNoThumbnailReviewCount', 'Retryable no-thumbnail reviews must be reported.');
	console.log('✓ Worker report counters are present');

	console.log('\n✅ Worker backpressure and lock regression passed.');
} catch (error) {
	console.error('\n❌ Worker backpressure and lock regression failed.');
	console.error(error?.stack || error?.message || error);
	if (error?.details !== undefined) {
		console.error(JSON.stringify(error.details, null, 2));
	}
	process.exitCode = 1;
}
