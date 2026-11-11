import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { accountTools } from "./tools/account";
import { activityTools } from "./tools/activities";
import {
	type AnyToolDefinition,
	registerTools,
	type ToolContext,
} from "./tools/define";
import { nutritionTools } from "./tools/nutrition";
import { strengthTools } from "./tools/strength";

export const FOUNDRY_MCP_TOOLS: readonly AnyToolDefinition[] = [
	...accountTools,
	...activityTools,
	...strengthTools,
	...nutritionTools,
];

const INSTRUCTIONS = `Foundry is the user's personal training and nutrition tracker.
- Activities are Strength Sessions, Runs, and Rides; list_activities spans all of them.
- IDs come from list and search tools; never invent them.
- Dates for nutrition are the user's local calendar day (YYYY-MM-DD). Times are ISO 8601.
- Every create tool takes an idempotencyKey: generate a fresh UUID per intended write and reuse it only to retry that same write.
- Confirm with the user before logging anything they did not clearly ask for. Agents cannot delete data; deletions happen in the app.`;

export function createFoundryMcpServer(context: ToolContext): McpServer {
	const server = new McpServer(
		{ name: "foundry", title: "Foundry", version: "1.0.0" },
		{ instructions: INSTRUCTIONS },
	);
	registerTools(server, FOUNDRY_MCP_TOOLS, context);
	return server;
}
