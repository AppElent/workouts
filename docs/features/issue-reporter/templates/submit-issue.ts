import { validateIssueRequest } from "./issue-reporter";

export async function submitIssueToGitHub(
	input: unknown,
	authenticatedUserId: string | null,
) {
	if (!authenticatedUserId)
		return { ok: false as const, error: "Authentication required" };
	const token = process.env.GITHUB_ISSUES_TOKEN;
	const repository = process.env.GITHUB_ISSUES_REPOSITORY;
	if (
		!token ||
		!repository ||
		!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
	) {
		return { ok: false as const, error: "Issue reporter is not configured" };
	}
	const validated = validateIssueRequest(input);
	if (!validated.ok) return validated;
	try {
		const response = await fetch(
			`https://api.github.com/repos/${repository}/issues`,
			{
				method: "POST",
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: `[${validated.value.type}] ${validated.value.text.slice(0, 80)}`,
					body: `${validated.value.text}\n\nPage: ${validated.value.url}`,
				}),
			},
		);
		if (!response.ok)
			return { ok: false as const, error: "GitHub rejected the report" };
		return { ok: true as const };
	} catch {
		return { ok: false as const, error: "GitHub could not be reached" };
	}
}
