export const ISSUE_TYPES = ["bug", "feedback", "support"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueRequest = { type: IssueType; text: string; url: string };

export function validateIssueRequest(
	value: unknown,
): { ok: true; value: IssueRequest } | { ok: false; error: string } {
	if (!value || typeof value !== "object")
		return { ok: false, error: "Invalid request" };
	const body = value as Record<string, unknown>;
	if (!ISSUE_TYPES.includes(body.type as IssueType))
		return { ok: false, error: "Invalid type" };
	if (
		typeof body.text !== "string" ||
		body.text.trim().length < 3 ||
		body.text.length > 5000
	) {
		return {
			ok: false,
			error: "Report text must be between 3 and 5000 characters",
		};
	}
	if (typeof body.url !== "string" || body.url.length > 2048)
		return { ok: false, error: "Invalid page URL" };
	let pageUrl: string;
	try {
		const url = new URL(body.url);
		if (url.protocol !== "http:" && url.protocol !== "https:")
			return { ok: false, error: "Invalid page URL" };
		url.username = "";
		url.password = "";
		url.search = "";
		url.hash = "";
		pageUrl = url.toString();
	} catch {
		return { ok: false, error: "Invalid page URL" };
	}
	return {
		ok: true,
		value: {
			type: body.type as IssueType,
			text: body.text.trim(),
			url: pageUrl,
		},
	};
}
