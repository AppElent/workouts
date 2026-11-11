const clerkIssuer = process.env.CLERK_JWT_ISSUER_DOMAIN?.replace(/\/$/, "");

/**
 * Clerk OAuth access tokens minted for the MCP endpoint (see docs/runbooks/mcp.md).
 * Each listed MCP resource URL is a token audience; tokens for other resources
 * or apps on the shared Clerk instance are rejected. Convex requires the
 * variable on every deployment, so a deployment without MCP sets `none`.
 */
const mcpResourceUrls = (process.env.MCP_RESOURCE_URLS ?? "")
	.split(",")
	.map((url) => url.trim())
	.filter((url) => /^https?:\/\/[^/]+\/mcp$/.test(url));

export default {
	providers: [
		{
			domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
			applicationID: "convex",
		},
		...(clerkIssuer
			? mcpResourceUrls.map((resource) => ({
					type: "customJwt" as const,
					issuer: clerkIssuer,
					jwks: `${clerkIssuer}/.well-known/jwks.json`,
					algorithm: "RS256" as const,
					applicationID: resource,
				}))
			: []),
	],
};
