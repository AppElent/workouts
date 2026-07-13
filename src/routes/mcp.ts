import { createFileRoute } from "@tanstack/react-router";
import { handleWorkoutsMcpRequest } from "#/lib/mcp/handler";

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			GET: async ({ request }) => handleWorkoutsMcpRequest(request),
			POST: async ({ request }) => handleWorkoutsMcpRequest(request),
			DELETE: async ({ request }) => handleWorkoutsMcpRequest(request),
		},
	},
});
