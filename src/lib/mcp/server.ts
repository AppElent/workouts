import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpAuthRequiredError, type WorkoutsMcpDataClient } from "./dataClient";
import { errorText, jsonText } from "./toolResults";

export function createWorkoutsMcpServer({
	dataClient,
}: {
	dataClient: WorkoutsMcpDataClient;
}): McpServer {
	const server = new McpServer({
		name: "workouts",
		version: "0.1.0",
	});

	registerReadOnlyTools(server, dataClient);

	return server;
}

function registerReadOnlyTools(
	server: McpServer,
	dataClient: WorkoutsMcpDataClient,
) {
	server.registerTool(
		"list_exercises",
		{
			title: "List exercises",
			description:
				"List default exercises plus custom exercises visible to the authenticated Workouts user.",
			inputSchema: {},
		},
		async () => withToolErrors(() => dataClient.listExercises()),
	);

	server.registerTool(
		"list_recent_workouts",
		{
			title: "List recent workouts",
			description:
				"List recent workout sessions for the authenticated Workouts user. The limit is capped by Convex.",
			inputSchema: {
				limit: z.number().int().min(1).max(50).optional(),
			},
		},
		async ({ limit }) =>
			withToolErrors(() => dataClient.listRecentWorkouts({ limit })),
	);

	server.registerTool(
		"get_workout_sets",
		{
			title: "Get workout sets",
			description:
				"Return sets for one workout session owned by the authenticated Workouts user.",
			inputSchema: {
				sessionId: z.string().min(1),
			},
		},
		async ({ sessionId }) =>
			withToolErrors(() => dataClient.getWorkoutSets({ sessionId })),
	);

	server.registerTool(
		"list_personal_records",
		{
			title: "List personal records",
			description:
				"List current one-rep max records for the authenticated Workouts user.",
			inputSchema: {},
		},
		async () => withToolErrors(() => dataClient.listPersonalRecords()),
	);

	server.registerTool(
		"get_exercise_volume",
		{
			title: "Get exercise volume",
			description:
				"Return weekly training volume for one exercise visible to the authenticated Workouts user.",
			inputSchema: {
				exerciseId: z.string().min(1),
			},
		},
		async ({ exerciseId }) =>
			withToolErrors(() => dataClient.getExerciseVolume({ exerciseId })),
	);
}

async function withToolErrors(load: () => Promise<unknown>) {
	try {
		return jsonText(await load());
	} catch (error) {
		if (error instanceof McpAuthRequiredError) {
			return errorText("Authentication is required. Start at /mcp/auth.");
		}
		return errorText("The Workouts MCP tool failed.");
	}
}
