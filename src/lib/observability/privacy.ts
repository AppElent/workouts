import type { Breadcrumb, Event } from "@sentry/react";

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

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
	// Convex server console output can contain entire mutation payloads.
	if (breadcrumb.category === "console") return null;
	return {
		...breadcrumb,
		message: breadcrumb.message ? sanitizeText(breadcrumb.message) : undefined,
		// Retain only structural network/navigation fields, never bodies/params.
		data: breadcrumb.data
			? Object.fromEntries(
					Object.entries(breadcrumb.data)
						.filter(([key]) =>
							["url", "method", "status_code", "from", "to", "state"].includes(
								key,
							),
						)
						.map(([key, value]) => [
							key,
							typeof value === "string"
								? sanitizeText(value.split("?")[0])
								: value,
						]),
				)
			: undefined,
	};
}

export function sanitizeEvent<T extends Event>(event: T): T {
	if (event.user)
		event.user = event.user.id ? { id: event.user.id } : undefined;
	if (event.request) {
		event.request = {
			method: event.request.method,
			url: event.request.url
				? sanitizeText(event.request.url.split("?")[0])
				: undefined,
		};
	}
	// No caller-supplied payloads, locals, or attachments are needed to debug.
	delete event.extra;
	if (event.message) event.message = sanitizeText(event.message);
	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = sanitizeText(exception.value);
		for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
	}
	return event;
}
