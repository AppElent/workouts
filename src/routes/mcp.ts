import { createFileRoute } from "@tanstack/react-router";
import { handleFoundryMcpRequest } from "#/lib/mcp/handler";

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			GET: async ({ request }) => handleFoundryMcpRequest(request),
			POST: async ({ request }) => handleFoundryMcpRequest(request),
			DELETE: async ({ request }) => handleFoundryMcpRequest(request),
			OPTIONS: async ({ request }) => handleFoundryMcpRequest(request),
		},
	},
});
