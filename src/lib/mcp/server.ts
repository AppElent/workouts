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
import { viewTools } from "./tools/views";
import { registerViewResources } from "./views/resources";

export const FOUNDRY_MCP_TOOLS: readonly AnyToolDefinition[] = [
	...accountTools,
	...activityTools,
	...strengthTools,
	...nutritionTools,
	...viewTools,
];

const INSTRUCTIONS = `Foundry is the user's personal training and nutrition tracker.
- Activities are Strength Sessions, Runs, and Rides; list_activities spans all of them.
- IDs come from list and search tools; never invent them.
- Dates for nutrition are the user's local calendar day (YYYY-MM-DD). Times are ISO 8601.
- Create tools that take an idempotencyKey need a fresh UUID per intended write; reuse it only to retry that same write. create_exercise needs none: it returns the user's existing Personal Exercise with the same name.
- To save a reusable training plan, create_routine with Exercise IDs from list_exercises or create_exercise.
- To set up a training, start_strength_session, then add_exercise_to_session with plannedSets per Exercise (load in kg or as a percentage of the 1RM); the user confirms each Set in the app. To log a past training, pass startedAt, loggedAt per Set, and endedAt when finishing.
- When the user has not given exact foods and servings, show review_food_log with IDs from search_foods before calling log_food, so they can check and log from the view.
- open_foundry, show_week_overview, review_food_log, and show_exercise_progress show interactive views where the client supports them. An open view may offer its own tools that change what it shows (for example go_to_week, set_range, add_item); use them for the open view instead of opening a new one.
- Confirm with the user before logging anything they did not clearly ask for. Agents cannot delete data; deletions happen in the app.`;

export function createFoundryMcpServer(context: ToolContext): McpServer {
	const server = new McpServer(
		{ name: "foundry", title: "Foundry", version: "1.0.0" },
		{ instructions: INSTRUCTIONS },
	);
	registerTools(server, FOUNDRY_MCP_TOOLS, context);
	registerViewResources(server, context);
	return server;
}
