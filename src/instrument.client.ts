import * as Sentry from "@sentry/react";
import {
	DEFAULT_SENTRY_DSN,
	isLocalSentryUrl,
	SENTRY_DATA_COLLECTION,
} from "./lib/observability/config";
import {
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeText,
} from "./lib/observability/privacy";

const environment =
	import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;

Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN || DEFAULT_SENTRY_DSN,
	enabled: !import.meta.env.DEV && !isLocalSentryUrl(window.location.href),
	environment,
	release: import.meta.env.VITE_SENTRY_RELEASE,
	dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
	tracesSampleRate: environment === "production" ? 0.2 : 1,
	tracePropagationTargets: [
		new RegExp(
			`^${window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`,
		),
		/^\/(?!\/)/,
	],
	replaysSessionSampleRate: 0.05,
	replaysOnErrorSampleRate: 1,
	traceLifecycle: "static",
	beforeSend: sanitizeEvent,
	beforeSendTransaction: sanitizeEvent,
	beforeBreadcrumb: sanitizeBreadcrumb,
	beforeSendLog: (log) => ({ ...log, message: sanitizeText(log.message) }),
	integrations: (defaults) => [
		...defaults.filter((integration) => integration.name !== "Console"),
		Sentry.replayIntegration({
			maskAllText: true,
			blockAllMedia: true,
			maskAllInputs: true,
		}),
		Sentry.feedbackIntegration({
			autoInject: false,
			useSentryUser: { name: "", email: "" },
		}),
	],
});

Sentry.setTag("app", "foundry-web");
