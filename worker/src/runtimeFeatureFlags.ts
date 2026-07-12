export const RUNTIME_FEATURE_FLAGS = {
	reader_archive_search: {
		defaultValue: true,
	},
	worker_public_feed_edge_snapshot_publish: {
		defaultValue: true,
	},
} as const;

export type RuntimeFeatureFlagKey = keyof typeof RUNTIME_FEATURE_FLAGS;

type RuntimeFeatureFlagStorageConfig = {
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
};

type RuntimeFeatureFlagRow = {
	enabled?: unknown;
};

export function isRuntimeFeatureFlagKey(value: string): value is RuntimeFeatureFlagKey {
	return Object.hasOwn(RUNTIME_FEATURE_FLAGS, value);
}

export async function isRuntimeFeatureFlagEnabled(
	key: string,
	config: RuntimeFeatureFlagStorageConfig,
	request: typeof fetch = fetch,
): Promise<boolean> {
	if (!isRuntimeFeatureFlagKey(key)) {
		return false;
	}

	const defaultValue = RUNTIME_FEATURE_FLAGS[key].defaultValue;

	try {
		const url = new URL('/rest/v1/runtime_feature_flags', config.supabaseUrl);
		url.searchParams.set('select', 'enabled');
		url.searchParams.set('key', `eq.${key}`);
		url.searchParams.set('limit', '1');

		const response = await request(url.toString(), {
			headers: {
				apikey: config.supabaseServiceRoleKey,
				Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
			},
		});

		if (!response.ok) {
			return defaultValue;
		}

		const rows = (await response.json()) as RuntimeFeatureFlagRow[];
		return Array.isArray(rows) && typeof rows[0]?.enabled === 'boolean'
			? rows[0].enabled
			: defaultValue;
	} catch {
		return defaultValue;
	}
}
