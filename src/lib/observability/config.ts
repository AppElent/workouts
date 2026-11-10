import {
	SENTRY_DSN,
	sanitizeBreadcrumb,
	sanitizeEvent,
	sentryTracesSampleRate,
} from "@foundry/core";

const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT;

/** Options the Worker and the browser SDK share; each adds its own on top. */
export function sentryOptions() {
	return {
		dsn: import.meta.env.VITE_SENTRY_DSN || SENTRY_DSN,
		enabled: !import.meta.env.DEV,
		environment,
		release: import.meta.env.VITE_SENTRY_RELEASE,
		dataCollection: {
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
		},
		tracesSampleRate: sentryTracesSampleRate(environment),
		traceLifecycle: "static" as const,
		beforeSend: sanitizeEvent,
		beforeSendTransaction: sanitizeEvent,
		beforeBreadcrumb: sanitizeBreadcrumb,
	};
}

export function withoutConsole<T extends { name: string }>(
	integrations: T[],
): T[] {
	return integrations.filter((integration) => integration.name !== "Console");
}

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
