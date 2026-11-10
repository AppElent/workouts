import * as Sentry from "@sentry/cloudflare";
import handler from "@tanstack/react-start/server-entry";
import {
	isLocalSentryUrl,
	sentryOptions,
	withoutConsole,
} from "./lib/observability/config";

type SentryEnv = { SENTRY_DSN?: string };

const instrumentedHandler = Sentry.withSentry(
	(env: SentryEnv) => ({
		...sentryOptions(env.SENTRY_DSN),
		integrations: withoutConsole,
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
