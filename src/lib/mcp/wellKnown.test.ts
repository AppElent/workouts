import { describe, expect, it } from "vitest";
import { handleWellKnownRequest } from "./wellKnown";

const issuer = "https://clerk.example";

describe("MCP OAuth discovery", () => {
	it("serves protected resource metadata for the MCP endpoint", async () => {
		const response = await handleWellKnownRequest(
			new Request(
				"https://foundry.example/.well-known/oauth-protected-resource/mcp",
			),
			{ issuer },
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			resource: "https://foundry.example/mcp",
			authorization_servers: [issuer],
			scopes_supported: expect.arrayContaining([
				"foundry:read",
				"foundry:write",
			]),
		});
	});

	it("relays Clerk's authorization server metadata", async () => {
		const response = await handleWellKnownRequest(
			new Request(
				"https://foundry.example/.well-known/oauth-authorization-server",
			),
			{
				issuer,
				fetch: async (url) => {
					expect(String(url)).toBe(
						`${issuer}/.well-known/oauth-authorization-server`,
					);
					return Response.json({
						issuer,
						registration_endpoint: `${issuer}/oauth/register`,
					});
				},
			},
		);
		expect(await response.json()).toMatchObject({ issuer });
	});

	it("returns 404 for other well-known paths", async () => {
		const response = await handleWellKnownRequest(
			new Request("https://foundry.example/.well-known/unknown"),
			{ issuer },
		);
		expect(response.status).toBe(404);
	});
});
