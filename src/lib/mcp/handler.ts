import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
	createConvexWorkoutsMcpDataClient,
	type WorkoutsMcpDataClient,
} from "./dataClient";
import { createWorkoutsMcpServer } from "./server";

export async function handleWorkoutsMcpRequest(
	request: Request,
): Promise<Response> {
	const url = import.meta.env.VITE_CONVEX_URL;
	if (!url) throw new Error("missing env var VITE_CONVEX_URL");
	return serveWorkoutsMcp(
		request,
		createConvexWorkoutsMcpDataClient({
			convexUrl: url,
			token: bearerToken(request.headers.get("authorization")),
		}),
	);
}

/** Answers one stateless MCP request with tools backed by `dataClient`. */
export async function serveWorkoutsMcp(
	request: Request,
	dataClient: WorkoutsMcpDataClient,
): Promise<Response> {
	const server = createWorkoutsMcpServer({ dataClient });
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}

function bearerToken(header: string | null): string | undefined {
	const [scheme, token] = header?.split(" ") ?? [];
	return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}
