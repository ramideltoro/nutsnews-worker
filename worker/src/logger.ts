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

const BETTER_STACK_DELIVERY_EVENTS = new Set([
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

	await sendToBetterStack(env, payload);
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
