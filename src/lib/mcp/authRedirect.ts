export type McpAuthRequest =
	| { ok: true; redirectUri: string; state: string }
	| { ok: false; message: string };

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** Reads the MCP client's loopback callback from the login page URL. */
export function parseMcpAuthRequest(requestUrl: string): McpAuthRequest {
	const params = new URL(requestUrl).searchParams;
	const redirectUri = params.get("redirect_uri");
	const state = params.get("state");
	if (!redirectUri || !state) {
		return {
			ok: false,
			message: "MCP login request is missing redirect_uri or state.",
		};
	}
	if (!URL.canParse(redirectUri)) {
		return { ok: false, message: "MCP callback URL is invalid." };
	}
	const callback = new URL(redirectUri);
	if (callback.protocol !== "http:" || !LOOPBACK_HOSTS.has(callback.hostname)) {
		return {
			ok: false,
			message:
				"MCP callback URL must be a local http://127.0.0.1 or http://localhost URL.",
		};
	}
	return { ok: true, redirectUri: callback.toString(), state };
}

/** The callback URL carrying `params` and the client's original state. */
export function mcpCallbackUrl(
	request: { redirectUri: string; state: string },
	params: Record<string, string>,
): string {
	const url = new URL(request.redirectUri);
	url.searchParams.set("state", request.state);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
}
