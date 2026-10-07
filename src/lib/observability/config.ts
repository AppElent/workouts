export const DEFAULT_SENTRY_DSN =
	"https://43d3de8058924d6c718b133785d811c8@o4504753234051072.ingest.us.sentry.io/4512164168663040";

export const SENTRY_DATA_COLLECTION = {
	userInfo: false,
	cookies: false,
	httpHeaders: false,
	httpBodies: [],
	urlQueryParams: false,
	stackFrameVariables: false,
	databaseQueryData: false,
	queues: false,
	graphQL: { document: false, variables: false },
	genAI: { inputs: false, outputs: false },
} as const;

/** Production bundles also run in local Wrangler previews. */
export function isLocalSentryUrl(url: string): boolean {
	const hostname = new URL(url).hostname.toLowerCase();
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname === "[::1]" ||
		hostname === "0.0.0.0" ||
		/^127\.\d+\.\d+\.\d+$/.test(hostname)
	);
}
