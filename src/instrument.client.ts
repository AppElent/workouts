import { sanitizeFeedbackEvent, sanitizeText } from "@foundry/core";
import * as Sentry from "@sentry/react";
import {
	isLocalSentryUrl,
	sentryOptions,
	withoutConsole,
} from "./lib/observability/config";

const options = sentryOptions();

Sentry.init({
	...options,
	enabled: options.enabled && !isLocalSentryUrl(window.location.href),
	tracePropagationTargets: [
		new RegExp(
			`^${window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`,
		),
		/^\/(?!\/)/,
	],
	replaysSessionSampleRate: 0.05,
	replaysOnErrorSampleRate: 1,
	beforeSendLog: (log) => ({ ...log, message: sanitizeText(log.message) }),
	integrations: (defaults) => [
		...withoutConsole(defaults),
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

// Feedback events skip beforeSend.
Sentry.addEventProcessor(sanitizeFeedbackEvent);
Sentry.setTag("app", "foundry-web");
