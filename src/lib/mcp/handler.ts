import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
	createConvexWorkoutsMcpDataClient,
	type WorkoutsMcpDataClient,
} from "./dataClient";
import { createWorkoutsMcpServer } from "./server";

export type WorkoutsMcpRequestOptions = {
	convexUrl?: string;
	createDataClient?: (args: {
		convexUrl: string;
		token?: string;
	}) => WorkoutsMcpDataClient;
};

export async function handleWorkoutsMcpRequest(
	request: Request,
	options: WorkoutsMcpRequestOptions = {},
): Promise<Response> {
	const token = parseBearerToken(request.headers.get("authorization"));
	const createDataClient =
		options.createDataClient ?? createConvexWorkoutsMcpDataClient;
	const convexUrl =
		options.convexUrl ?? (options.createDataClient ? "" : getConvexUrl());
	const dataClient = createDataClient({ convexUrl, token });
	const server = createWorkoutsMcpServer({ dataClient });
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	await server.connect(transport);
	return transport.handleRequest(request);
}

export function parseBearerToken(header: string | null): string | undefined {
	if (!header) return undefined;
	const [scheme, token] = header.split(" ");
	if (scheme.toLowerCase() !== "bearer" || !token) return undefined;
	return token;
}

function getConvexUrl(): string {
	const url = import.meta.env.VITE_CONVEX_URL;
	if (!url) throw new Error("missing env var VITE_CONVEX_URL");
	return url;
}
