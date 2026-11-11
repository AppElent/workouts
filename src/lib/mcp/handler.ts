import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ConvexHttpClient } from "convex/browser";
import {
	authChallenge,
	clerkIssuer,
	createClerkTokenVerifier,
	MCP_SCOPES,
	type McpAccess,
	type McpTokenVerifier,
	mcpResourceUrl,
	parseBearerToken,
} from "./auth";
import { createFoundryMcpServer } from "./server";
import type { FoundryBackend } from "./tools/define";

export type FoundryMcpOptions = {
	issuer?: string;
	verifyToken?: McpTokenVerifier;
	createBackend?: (token: string) => FoundryBackend;
	fetchUserInfo?: (
		access: McpAccess,
	) => Promise<Record<string, unknown> | undefined>;
	now?: () => Date;
};

/** Browser origins allowed to call the endpoint; server-side clients send none. */
const ALLOWED_ORIGINS = new Set([
	"https://claude.ai",
	"https://claude.com",
	"https://chatgpt.com",
]);

export function isAllowedOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	const self = new URL(request.url);
	if (origin === self.origin || ALLOWED_ORIGINS.has(origin)) return true;
	let parsed: URL;
	try {
		parsed = new URL(origin);
	} catch {
		return false;
	}
	const local = (host: string) => host === "localhost" || host === "127.0.0.1";
	// Local browser tools (MCP Inspector) may reach a local dev server only.
	return local(self.hostname) && local(parsed.hostname);
}

export function corsHeaders(request: Request): Headers {
	const headers = new Headers({ Vary: "Origin" });
	const origin = request.headers.get("origin");
	if (origin && isAllowedOrigin(request)) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		headers.set(
			"Access-Control-Allow-Headers",
			"Authorization, Content-Type, Accept, Mcp-Protocol-Version",
		);
		headers.set(
			"Access-Control-Expose-Headers",
			"WWW-Authenticate, Mcp-Protocol-Version",
		);
	}
	return headers;
}

function withHeaders(response: Response, extra: Headers): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of extra) headers.set(key, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function jsonError(
	request: Request,
	status: number,
	error: string,
	description: string,
	headers: Record<string, string> = {},
) {
	const response = Response.json(
		{ error, error_description: description },
		{ status, headers },
	);
	return withHeaders(response, corsHeaders(request));
}

function convexUrl(): string {
	const url = import.meta.env.VITE_CONVEX_URL;
	if (!url) throw new Error("missing env var VITE_CONVEX_URL");
	return url;
}

export async function handleFoundryMcpRequest(
	request: Request,
	options: FoundryMcpOptions = {},
): Promise<Response> {
	if (!isAllowedOrigin(request)) {
		return jsonError(request, 403, "forbidden", "Origin not allowed.");
	}
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders(request) });
	}
	if (request.method !== "POST") {
		// Stateless server: no standalone SSE stream and no sessions to delete.
		return jsonError(
			request,
			405,
			"method_not_allowed",
			"Use POST for MCP requests.",
			{ Allow: "POST, OPTIONS" },
		);
	}

	const token = parseBearerToken(request.headers.get("authorization"));
	const issuer = options.issuer ?? clerkIssuer();
	const verify = options.verifyToken ?? createClerkTokenVerifier(issuer);
	const access = token
		? await verify(token, mcpResourceUrl(request))
		: undefined;
	if (!access) {
		return jsonError(
			request,
			401,
			token ? "invalid_token" : "unauthorized",
			"Sign in to Foundry to use this MCP server.",
			{
				"WWW-Authenticate": authChallenge(
					request,
					token ? "invalid_token" : undefined,
				),
			},
		);
	}
	if (
		!access.scopes.has(MCP_SCOPES.read) &&
		!access.scopes.has(MCP_SCOPES.write)
	) {
		return jsonError(
			request,
			403,
			"insufficient_scope",
			`Grant ${MCP_SCOPES.read} or ${MCP_SCOPES.write} to use Foundry.`,
			{ "WWW-Authenticate": authChallenge(request, "insufficient_scope") },
		);
	}

	const backend =
		options.createBackend?.(access.token) ?? convexBackend(access.token);
	const server = createFoundryMcpServer({
		backend,
		access,
		now: options.now ?? (() => new Date()),
		userInfo: () =>
			(options.fetchUserInfo ?? ((a) => fetchUserInfo(issuer, a)))(access),
	});
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	const response = await transport.handleRequest(request);
	return withHeaders(response, corsHeaders(request));
}

function convexBackend(token: string): FoundryBackend {
	const client = new ConvexHttpClient(convexUrl());
	client.setAuth(token);
	return client;
}

async function fetchUserInfo(issuer: string, access: McpAccess) {
	const response = await fetch(new URL("/oauth/userinfo", issuer), {
		headers: { Authorization: `Bearer ${access.token}` },
	});
	if (!response.ok) return undefined;
	return (await response.json()) as Record<string, unknown>;
}
