import {
	clerkIssuer,
	MCP_PATH,
	PROTECTED_RESOURCE_PATH,
	protectedResourceMetadata,
} from "./auth";
import { corsHeaders } from "./handler";

const AUTHORIZATION_SERVER_PATH = "/.well-known/oauth-authorization-server";

function json(request: Request, body: unknown, status = 200) {
	const headers = corsHeaders(request);
	headers.set("Content-Type", "application/json");
	headers.set("Cache-Control", "public, max-age=300");
	return new Response(JSON.stringify(body), { status, headers });
}

/**
 * OAuth discovery for the MCP endpoint. Protected resource metadata (RFC 9728)
 * names Clerk as the authorization server; the authorization server document
 * is relayed from Clerk for clients that still look for it on this origin.
 */
export async function handleWellKnownRequest(
	request: Request,
	options: { issuer?: string; fetch?: typeof fetch } = {},
): Promise<Response> {
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders(request) });
	}
	const issuer = options.issuer ?? clerkIssuer();
	const { pathname } = new URL(request.url);
	if (
		pathname === PROTECTED_RESOURCE_PATH ||
		pathname === `${PROTECTED_RESOURCE_PATH}${MCP_PATH}`
	) {
		return json(request, protectedResourceMetadata(request, issuer));
	}
	if (
		pathname === AUTHORIZATION_SERVER_PATH ||
		pathname === `${AUTHORIZATION_SERVER_PATH}${MCP_PATH}`
	) {
		const upstream = await (options.fetch ?? fetch)(
			new URL(AUTHORIZATION_SERVER_PATH, issuer),
		);
		if (!upstream.ok) {
			return json(request, { error: "authorization_server_unavailable" }, 502);
		}
		return json(request, await upstream.json());
	}
	return json(request, { error: "not_found" }, 404);
}
