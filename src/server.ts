import * as Sentry from "@sentry/cloudflare";
import handler from "@tanstack/react-start/server-entry";
import {
	DEFAULT_SENTRY_DSN,
	isLocalSentryUrl,
	SENTRY_DATA_COLLECTION,
} from "./lib/observability/config";
import { sanitizeBreadcrumb, sanitizeEvent } from "./lib/observability/privacy";

type SentryEnv = {
	SENTRY_DSN?: string;
	environment_name?: string;
};

const instrumentedHandler = Sentry.withSentry(
	(env: SentryEnv) => ({
		dsn:
			env.SENTRY_DSN || import.meta.env.VITE_SENTRY_DSN || DEFAULT_SENTRY_DSN,
		enabled: !import.meta.env.DEV,
		environment: env.environment_name || import.meta.env.MODE,
		release: import.meta.env.VITE_SENTRY_RELEASE,
		dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
		tracesSampleRate: env.environment_name === "production" ? 0.2 : 1,
		traceLifecycle: "static",
		integrations: (defaults) =>
			defaults.filter((integration) => integration.name !== "Console"),
		beforeSend: sanitizeEvent,
		beforeSendTransaction: sanitizeEvent,
		beforeBreadcrumb: sanitizeBreadcrumb,
	}),
	{
		async fetch(request: Request, _env: SentryEnv, _ctx: ExecutionContext) {
			Sentry.setTag("app", "foundry-web-server");
			const response = await handler.fetch(request);
			// Start may turn a handled SSR error into a response instead of throwing.
			if (response.status >= 500) {
				Sentry.captureMessage("TanStack Start returned a server error", {
					level: "error",
					tags: { status: response.status },
				});
			}
			return response;
		},
	},
);

export default {
	fetch(request: Request, env: SentryEnv, ctx: ExecutionContext) {
		// Wrangler inherits production bindings even when serving localhost.
		// Bypass instrumentation before it creates any spans or captures errors.
		if (isLocalSentryUrl(request.url)) return handler.fetch(request);
		return instrumentedHandler.fetch(request, env, ctx);
	},
};
