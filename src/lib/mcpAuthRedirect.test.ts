import { describe, expect, it } from "vitest";
import {
	buildMcpAuthErrorRedirect,
	buildMcpAuthTokenRedirect,
	parseMcpAuthRequest,
} from "./mcpAuthRedirect";

describe("MCP auth redirect helpers", () => {
	it("accepts loopback callback URLs with state", () => {
		const request = parseMcpAuthRequest(
			"http://localhost:3000/mcp/auth?redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=abc",
		);

		expect(request).toEqual({
			ok: true,
			redirectUri: "http://127.0.0.1:54321/callback",
			state: "abc",
		});
	});

	it("rejects non-loopback callback URLs with MCP-specific copy", () => {
		const request = parseMcpAuthRequest(
			"http://localhost:3000/mcp/auth?redirect_uri=https%3A%2F%2Fevil.example%2Fcallback&state=abc",
		);

		expect(request).toEqual({
			ok: false,
			message:
				"MCP callback URL must be a local http://127.0.0.1 or http://localhost URL.",
		});
	});

	it("builds token and error callback URLs with the original state", () => {
		expect(
			buildMcpAuthTokenRedirect({
				redirectUri: "http://127.0.0.1:54321/callback",
				state: "abc",
				token: "token",
			}),
		).toBe("http://127.0.0.1:54321/callback?state=abc&token=token");

		expect(
			buildMcpAuthErrorRedirect({
				redirectUri: "http://127.0.0.1:54321/callback",
				state: "abc",
				error: "token_unavailable",
				description: "Could not create an MCP token.",
			}),
		).toBe(
			"http://127.0.0.1:54321/callback?state=abc&error=token_unavailable&error_description=Could+not+create+an+MCP+token.",
		);
	});
});
