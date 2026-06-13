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

const SERVICE_NAME = "nutsnews-worker";
const DEFAULT_ENVIRONMENT = "production";

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

	if (trimmedHost.startsWith("http://") || trimmedHost.startsWith("https://")) {
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

async function sendToBetterStack(env: LoggerEnv, payload: LogFields) {
	const sourceToken = await resolveValue(env.BETTER_STACK_SOURCE_TOKEN);
	const ingestingHost = await resolveValue(env.BETTER_STACK_INGESTING_HOST);

	if (!sourceToken || !ingestingHost) {
		return;
	}

	const endpoint = normalizeIngestingHost(ingestingHost);

	try {
		await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${sourceToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
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
