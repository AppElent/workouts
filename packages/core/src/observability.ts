/**
 * Privacy passes for error reports. The Sentry shapes are structural so core
 * stays SDK-free; `@sentry/react` and `@sentry/react-native` events fit them.
 */
export type ReportBreadcrumb = {
	category?: string;
	message?: string;
	data?: { [key: string]: unknown };
};

export type ReportEvent = {
	type?: string;
	message?: string;
	user?: { id?: string | number };
	request?: { method?: string; url?: string };
	extra?: unknown;
	contexts?: { [key: string]: unknown };
	exception?: {
		values?: {
			value?: string;
			stacktrace?: { frames?: { vars?: unknown }[] };
		}[];
	};
};

const BREADCRUMB_DATA_KEYS = [
	"url",
	"method",
	"status_code",
	"from",
	"to",
	"state",
];

/**
 * The Foundry Sentry project's DSN. It is public client configuration, not a
 * credential; each build may override it with `sentryDsn` from the env
 * manifest (e.g. a separate test project).
 */
export const SENTRY_DSN =
	"https://43d3de8058924d6c718b133785d811c8@o4504753234051072.ingest.us.sentry.io/4512164168663040";

/** Production samples a fifth of traces; every other environment keeps all. */
export function sentryTracesSampleRate(
	environment: string | undefined,
): number {
	return environment === "production" ? 0.2 : 1;
}

/** Redact common credentials and identifiers even with default PII disabled. */
export function sanitizeText(value: string): string {
	return value
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [Filtered]")
		.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[Filtered]")
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Filtered]")
		.replace(
			/([?&](?:token|key|password|secret|email|code|authorization)=)[^&#\s]*/gi,
			"$1[Filtered]",
		);
}

function sanitizeUrl(url: string): string {
	return sanitizeText(url.split("?")[0]);
}

export function sanitizeBreadcrumb<T extends ReportBreadcrumb>(
	breadcrumb: T,
): T | null {
	// Convex server console output can contain entire mutation payloads.
	if (breadcrumb.category === "console") return null;
	return {
		...breadcrumb,
		message: breadcrumb.message ? sanitizeText(breadcrumb.message) : undefined,
		// Structural network/navigation fields only, never bodies or params.
		data: breadcrumb.data
			? Object.fromEntries(
					Object.entries(breadcrumb.data)
						.filter(([key]) => BREADCRUMB_DATA_KEYS.includes(key))
						.map(([key, value]) => [
							key,
							typeof value === "string" ? sanitizeUrl(value) : value,
						]),
				)
			: undefined,
	};
}

export function sanitizeEvent<T extends ReportEvent>(event: T): T {
	const report: ReportEvent = event;
	if (report.user)
		report.user = report.user.id ? { id: report.user.id } : undefined;
	if (report.request) {
		report.request = {
			method: report.request.method,
			url: report.request.url ? sanitizeUrl(report.request.url) : undefined,
		};
	}
	delete report.extra;
	if (report.message) report.message = sanitizeText(report.message);
	for (const exception of report.exception?.values ?? []) {
		if (exception.value) exception.value = sanitizeText(exception.value);
		for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
	}
	return event;
}

/**
 * Feedback events skip Sentry's `beforeSend`, so the text a person typed
 * needs its own pass. Register it as a global event processor.
 */
export function sanitizeFeedbackEvent<T extends ReportEvent>(event: T): T {
	if (event.type !== "feedback") return event;
	const feedback = event.contexts?.feedback as
		| { message?: string; url?: string; contact_email?: string; name?: string }
		| undefined;
	if (feedback) {
		if (feedback.message) feedback.message = sanitizeText(feedback.message);
		if (feedback.url) feedback.url = sanitizeUrl(feedback.url);
		delete feedback.contact_email;
		delete feedback.name;
	}
	return sanitizeEvent(event);
}
