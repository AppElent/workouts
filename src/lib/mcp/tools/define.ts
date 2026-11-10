import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type {
	FunctionArgs,
	FunctionReference,
	FunctionReturnType,
} from "convex/server";
import type { z } from "zod";
import { getConvexErrorMessage } from "#/lib/convexError";
import { MCP_SCOPES, type McpAccess } from "../auth";

/** The Convex calls tools make, as the signed-in user. ConvexHttpClient fits. */
export type FoundryBackend = {
	query<Query extends FunctionReference<"query">>(
		query: Query,
		args: FunctionArgs<Query>,
	): Promise<FunctionReturnType<Query>>;
	mutation<Mutation extends FunctionReference<"mutation">>(
		mutation: Mutation,
		args: FunctionArgs<Mutation>,
	): Promise<FunctionReturnType<Mutation>>;
};

export type ToolContext = {
	backend: FoundryBackend;
	access: McpAccess;
	/** Fetches the OAuth userinfo document for the caller's token. */
	userInfo: () => Promise<Record<string, unknown> | undefined>;
	now: () => Date;
};

type Shape = Record<string, z.ZodType>;

type ToolDefinition<Input extends Shape> = {
	name: string;
	title: string;
	description: string;
	input: Input;
	/** Read tools need foundry:read; write tools need foundry:write. */
	access: "read" | "write";
	annotations?: Omit<ToolAnnotations, "title" | "readOnlyHint">;
	run: (
		args: z.infer<z.ZodObject<Input>>,
		context: ToolContext,
	) => Promise<unknown>;
};

export type AnyToolDefinition = ToolDefinition<Shape>;

export function defineTool<Input extends Shape>(
	definition: ToolDefinition<Input>,
): AnyToolDefinition {
	return definition as unknown as AnyToolDefinition;
}

/** Registers only the tools the token's scopes allow. */
export function registerTools(
	server: McpServer,
	tools: readonly AnyToolDefinition[],
	context: ToolContext,
) {
	for (const tool of tools) {
		const scope = tool.access === "read" ? MCP_SCOPES.read : MCP_SCOPES.write;
		if (!context.access.scopes.has(scope)) continue;
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.input,
				annotations: {
					title: tool.title,
					readOnlyHint: tool.access === "read",
					openWorldHint: false,
					...(tool.access === "write"
						? { destructiveHint: false, idempotentHint: false }
						: {}),
					...tool.annotations,
				},
			},
			async (args: unknown) => {
				try {
					const value = await tool.run(args as never, context);
					return toolResult(value);
				} catch (error) {
					return toolError(error);
				}
			},
		);
	}
}

/** Errors a tool raises on purpose; their message is safe to show. */
export class ToolInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ToolInputError";
	}
}

export function toolResult(value: unknown) {
	const structured =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: { result: value };
	return {
		content: [{ type: "text" as const, text: JSON.stringify(structured) }],
		structuredContent: structured,
	};
}

export function toolError(error: unknown) {
	const message =
		error instanceof ToolInputError
			? error.message
			: getConvexErrorMessage(error, "The Foundry tool failed.");
	return {
		isError: true,
		content: [{ type: "text" as const, text: message }],
	};
}

/**
 * Public shape for a Convex document: `_id` becomes `id`; owner and system
 * bookkeeping fields are dropped. Applied recursively.
 */
export function publicDoc<T>(value: T): unknown {
	if (Array.isArray(value)) return value.map(publicDoc);
	if (!value || typeof value !== "object") return value;
	const out: Record<string, unknown> = {};
	for (const [key, field] of Object.entries(value)) {
		if (key === "userId" || key === "_creationTime" || key === "subject")
			continue;
		out[key === "_id" ? "id" : key] = publicDoc(field);
	}
	return out;
}

export function isoDate(ms: number | undefined): string | undefined {
	return typeof ms === "number" ? new Date(ms).toISOString() : undefined;
}

/** `YYYY-MM-DD` in UTC; tools accept explicit dates for local days. */
export function today(now: Date): string {
	return now.toISOString().slice(0, 10);
}

export function parseTimestamp(value: string | undefined, label: string) {
	if (value === undefined) return undefined;
	const ms = Date.parse(value);
	if (Number.isNaN(ms))
		throw new ToolInputError(`${label} must be an ISO 8601 date or time.`);
	return ms;
}
