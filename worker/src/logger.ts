type LogLevel = "debug" | "info" | "warn" | "error";

type SecretBinding = {
	get: () => Promise<string>;
};

type MaybeSecretBinding = string | SecretBinding | undefined;

type LoggerEnv = {
	BETTER_STACK_SOURCE_TOKEN?: MaybeSecretBinding;
	BETTER_STACK_INGESTING_HOST?: MaybeSecretBinding;
	FEED_SHARD_INDEX?: string;
};

type LogFields = Record<string, unknown>;

type BetterStackConfig = {
	sourceToken: string;
	endpoint: string;
};

const SERVICE_NAME = "nutsnews-worker";
const DEFAULT_ENVIRONMENT = "production";
const MAX_BUFFERED_BETTER_STACK_EVENTS = 250;

const BETTER_STACK_DELIVERY_EVENTS = new Set([
	"worker.openai.review_attempting",
	"worker.supabase.public_feed_snapshot_refresh_exception",
	"worker.supabase.public_feed_snapshot_refresh_failed",
	"worker.supabase.article_publish_batch_exception",
	"worker.supabase.article_publish_batch_failed",
	"worker.supabase.article_summary_lookup_parse_failed",
	"worker.supabase.article_summary_lookup_exception",
	"worker.supabase.article_summary_lookup_failed",
	"worker.translation.openai.attempting",
	"worker.translation.local.skipped_missing_config",
	"worker.translation.local.attempting",
	"worker.local_ai.fallback_to_openai",
	"worker.local_ai.invalid_json",
	"worker.local_ai.empty_response",
	"worker.local_ai.response_json_failed",
	"worker.local_ai.request_failed",
	"worker.local_ai.request_exception",
	"worker.local_ai.invalid_api_key_header",
	"worker.local_ai.review_skipped_missing_config",
	"worker.local_ai.review_attempting",
	"worker.local_ai.diagnostics.config",
	"worker.local_ai.diagnostics.review_provider_selected",
	"worker.local_ai.diagnostics.review_skipped_missing_config",
	"worker.local_ai.diagnostics.review_start",
	"worker.local_ai.diagnostics.review_fetch_start",
	"worker.local_ai.diagnostics.review_fetch_response",
	"worker.local_ai.diagnostics.review_fetch_exception",
	"worker.local_ai.diagnostics.review_fetch_failed_status",
	"worker.local_ai.diagnostics.review_response_json_failed",
	"worker.local_ai.diagnostics.review_success",
	"worker.local_ai.diagnostics.review_fallback_to_openai",
	"worker.local_ai.diagnostics.review_failed_no_fallback",
	"worker.local_ai.diagnostics.review_invalid_api_key",
	"worker.local_ai.diagnostics.translation_provider_selected",
	"worker.local_ai.diagnostics.translation_start",
	"worker.local_ai.diagnostics.translation_fetch_start",
	"worker.local_ai.diagnostics.translation_fetch_response",
	"worker.local_ai.diagnostics.translation_fetch_exception",
	"worker.local_ai.diagnostics.translation_fetch_failed_status",
	"worker.local_ai.diagnostics.translation_response_json_failed",
	"worker.local_ai.diagnostics.translation_invalid_payload",
	"worker.local_ai.diagnostics.translation_success",
	"worker.local_ai.diagnostics.translation_fallback_to_openai",
	"worker.local_ai.diagnostics.translation_skipped_missing_config",
	"worker.local_ai.diagnostics.translation_invalid_api_key",
	"worker.logs.flushed",
	"worker.log_test.completed",
	"worker.refresh.completed",
	"worker.request.completed",
	"worker.request.failed",
	"worker.scheduled.completed",
	"worker.scheduled.failed",
	"worker.feeds.load_failed",
	"worker.openai.request_failed",
	"worker.openai.request_exception",
	"worker.openai.response_json_failed",
	"worker.openai.empty_response",
	"worker.openai.invalid_json",
	"worker.openai.article_review_exception",
	"worker.translation.local.request_exception",
	"worker.translation.local.request_failed",
	"worker.translation.local.response_json_failed",
	"worker.translation.local.invalid_payload",
	"worker.translation.fallback_to_openai",
	"worker.translation.skipped_by_limit",
	"worker.translation.summary_completed",
	"worker.translation.openai.request_exception",
	"worker.translation.openai.request_failed",
	"worker.translation.openai.response_json_failed",
	"worker.translation.openai.empty_response",
	"worker.translation.openai.invalid_json",
	"worker.supabase.review_lookup_failed",
	"worker.supabase.review_lookup_exception",
	"worker.supabase.review_lookup_parse_failed",
	"worker.supabase.published_url_lookup_failed",
	"worker.supabase.published_url_lookup_exception",
	"worker.supabase.published_url_lookup_parse_failed",
	"worker.supabase.review_batch_save_failed",
	"worker.supabase.review_batch_save_exception",
	"worker.supabase.article_batch_save_failed",
	"worker.supabase.article_batch_save_exception",
	"worker.supabase.article_summary_batch_save_failed",
	"worker.supabase.article_summary_batch_save_exception",
	"worker.supabase.feed_health_lookup_failed",
	"worker.supabase.feed_health_lookup_exception",
	"worker.supabase.feed_health_lookup_parse_failed",
	"worker.supabase.feed_health_batch_save_failed",
	"worker.supabase.feed_health_batch_save_exception",
	"worker.supabase.ai_usage_run_save_failed",
	"worker.supabase.ai_usage_run_save_exception",
	"worker.supabase.worker_run_save_failed",
	"worker.supabase.worker_run_save_exception",
]);

let cachedBetterStackConfigPromise: Promise<BetterStackConfig | null> | null = null;
let pendingBetterStackLogs: LogFields[] = [];
let pendingBetterStackDroppedCount = 0;

async function resolveValue(value: MaybeSecretBinding) {
	if (!value) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	return value.get();
}

function normalizeIngestingHost(host: string) {
	const trimmedHost = host.trim().replace(/\/+$/, "");

	if (
		trimmedHost.startsWith("http://") ||
		trimmedHost.startsWith("https://")
	) {
		return trimmedHost;
	}

	return `https://${trimmedHost}`;
}

function serializeError(error: unknown) {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}

	return {
		message: String(error),
	};
}

function writeLocalConsole(level: LogLevel, payload: LogFields) {
	const line = JSON.stringify(payload);

	if (level === "error") {
		console.error(line);
		return;
	}

	if (level === "warn") {
		console.warn(line);
		return;
	}

	console.log(line);
}

function shouldSendToBetterStack(event: string) {
	return BETTER_STACK_DELIVERY_EVENTS.has(event);
}

function bufferBetterStackPayload(payload: LogFields) {
	if (pendingBetterStackLogs.length >= MAX_BUFFERED_BETTER_STACK_EVENTS) {
		pendingBetterStackDroppedCount += 1;
		return;
	}

	pendingBetterStackLogs.push(payload);
}

async function getBetterStackConfig(
	env: LoggerEnv,
): Promise<BetterStackConfig | null> {
	if (!cachedBetterStackConfigPromise) {
		cachedBetterStackConfigPromise = (async () => {
			const sourceToken = await resolveValue(env.BETTER_STACK_SOURCE_TOKEN);
			const ingestingHost = await resolveValue(env.BETTER_STACK_INGESTING_HOST);

			if (!sourceToken || !ingestingHost) {
				return null;
			}

			return {
				sourceToken,
				endpoint: normalizeIngestingHost(ingestingHost),
			};
		})();
	}

	return cachedBetterStackConfigPromise;
}

async function sendToBetterStack(env: LoggerEnv, payload: LogFields) {
	const event = String(payload.event ?? "");

	if (!shouldSendToBetterStack(event)) {
		return;
	}

	try {
		const config = await getBetterStackConfig(env);

		if (!config) {
			return;
		}

		const response = await fetch(config.endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${config.sourceToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			console.warn(
				JSON.stringify({
					dt: new Date().toISOString(),
					level: "warn",
					service: SERVICE_NAME,
					environment: DEFAULT_ENVIRONMENT,
					event: "better_stack.delivery_failed_status",
					message: "Better Stack log delivery returned a non-OK status",
					status: response.status,
				}),
			);
		}
	} catch (error) {
		console.warn(
			JSON.stringify({
				dt: new Date().toISOString(),
				level: "warn",
				service: SERVICE_NAME,
				environment: DEFAULT_ENVIRONMENT,
				event: "better_stack.delivery_failed",
				message: "Failed to deliver Worker log to Better Stack",
				error: serializeError(error),
			}),
		);
	}
}

export async function flushBetterStackLogs(
	env: LoggerEnv,
	fields: LogFields = {},
) {
	if (pendingBetterStackLogs.length === 0 && pendingBetterStackDroppedCount === 0) {
		return;
	}

	const entries = pendingBetterStackLogs;
	const droppedEntryCount = pendingBetterStackDroppedCount;
	pendingBetterStackLogs = [];
	pendingBetterStackDroppedCount = 0;

	const payload = {
		dt: new Date().toISOString(),
		level: "info",
		service: SERVICE_NAME,
		environment: DEFAULT_ENVIRONMENT,
		event: "worker.logs.flushed",
		message: "Buffered Worker logs flushed to Better Stack in one request",
		shardIndex: env.FEED_SHARD_INDEX ?? "0",
		entryCount: entries.length,
		droppedEntryCount,
		bufferedEventNames: entries.map((entry) => entry.event).slice(0, 80),
		...fields,
		entries,
	};

	writeLocalConsole("info", {
		...payload,
		entries: `[${entries.length} buffered entries omitted from console flush line]`,
	});

	await sendToBetterStack(env, payload);
}

export async function logEvent(
	env: LoggerEnv,
	level: LogLevel,
	event: string,
	message: string,
	fields: LogFields = {},
) {
	const payload = {
		dt: new Date().toISOString(),
		level,
		service: SERVICE_NAME,
		environment: DEFAULT_ENVIRONMENT,
		event,
		message,
		shardIndex: env.FEED_SHARD_INDEX ?? "0",
		...fields,
	};

	writeLocalConsole(level, payload);

	if (shouldSendToBetterStack(event)) {
		bufferBetterStackPayload(payload);
	}
}

export async function logInfo(
	env: LoggerEnv,
	event: string,
	message: string,
	fields: LogFields = {},
) {
	await logEvent(env, "info", event, message, fields);
}

export async function logWarn(
	env: LoggerEnv,
	event: string,
	message: string,
	fields: LogFields = {},
) {
	await logEvent(env, "warn", event, message, fields);
}

export async function logError(
	env: LoggerEnv,
	event: string,
	message: string,
	error: unknown,
	fields: LogFields = {},
) {
	await logEvent(env, "error", event, message, {
		...fields,
		error: serializeError(error),
	});
}
