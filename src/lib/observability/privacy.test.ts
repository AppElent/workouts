import type { Event } from "@sentry/react";
import { sanitizeBreadcrumb, sanitizeEvent, sanitizeText } from "./privacy";

it("redacts credentials and email addresses while retaining useful error text", () => {
	expect(
		sanitizeText(
			"Request failed for test@example.com: Bearer abc123 https://api.test?token=secret",
		),
	).toBe(
		"Request failed for [Filtered]: Bearer [Filtered] https://api.test?token=[Filtered]",
	);
});

it("strips request bodies, headers, user PII, extras, and local variables", () => {
	const event: Event = {
		user: {
			id: "user_123",
			email: "test@example.com",
			ip_address: "127.0.0.1",
		},
		request: {
			url: "https://api.test/save?password=secret",
			headers: { Authorization: "secret" },
			data: { weight: 80 },
		},
		extra: { nutrition: { food: "private" } },
		exception: {
			values: [
				{
					value: "Failed test@example.com",
					stacktrace: {
						frames: [
							{
								filename: "screen.ts",
								lineno: 12,
								vars: { password: "secret" },
							},
						],
					},
				},
			],
		},
	};
	const result = sanitizeEvent(event);
	expect(result.user).toEqual({ id: "user_123" });
	expect(result.request).toEqual({
		url: "https://api.test/save",
		method: undefined,
	});
	expect(result.extra).toBeUndefined();
	expect(result.exception?.values?.[0].value).toBe("Failed [Filtered]");
	expect(result.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
		filename: "screen.ts",
		lineno: 12,
	});
});

it("drops console output and network payloads from breadcrumbs", () => {
	expect(
		sanitizeBreadcrumb({ category: "console", message: "private payload" }),
	).toBeNull();
	expect(
		sanitizeBreadcrumb({
			category: "http",
			data: {
				url: "https://api.test?token=secret",
				status_code: 500,
				body: "private",
			},
		})?.data,
	).toEqual({ url: "https://api.test", status_code: 500 });
});
