import { describe, expect, it } from "vitest";
import type { WorkoutsMcpDataClient } from "./dataClient";
import { handleWorkoutsMcpRequest } from "./handler";

function fakeDataClient(): WorkoutsMcpDataClient {
	return {
		listExercises: async () => [
			{
				id: "exercise1",
				name: "Back Squat",
				muscleGroups: ["quads"],
				category: "compound",
				equipment: "barbell",
				isDefault: true,
			},
		],
		listRecentWorkouts: async () => [],
		getWorkoutSets: async () => [],
		listPersonalRecords: async () => [],
		getExerciseVolume: async () => [],
	};
}

function mcpRequest(
	body: unknown,
	{
		authorization = "Bearer test-token",
	}: { authorization?: string | null } = {},
) {
	const headers = new Headers({
		accept: "application/json, text/event-stream",
		"content-type": "application/json",
	});
	if (authorization !== null) {
		headers.set("authorization", authorization);
	}

	return new Request("http://localhost:3000/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
}

describe("handleWorkoutsMcpRequest", () => {
	it("handles MCP initialize", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: {
						name: "vitest",
						version: "1.0.0",
					},
				},
			}),
			{
				createDataClient: () => fakeDataClient(),
			},
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as {
			result: { serverInfo: { name: string } };
		};
		expect(json.result.serverInfo.name).toBe("workouts");
	});

	it("handles MCP initialize without authentication", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest(
				{
					jsonrpc: "2.0",
					id: 10,
					method: "initialize",
					params: {
						protocolVersion: "2025-06-18",
						capabilities: {},
						clientInfo: {
							name: "vitest",
							version: "1.0.0",
						},
					},
				},
				{ authorization: null },
			),
			{
				convexUrl: "https://example.convex.cloud",
			},
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as {
			result: { serverInfo: { name: string } };
		};
		expect(json.result.serverInfo.name).toBe("workouts");
	});

	it("lists registered tools", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list",
			}),
			{
				createDataClient: () => fakeDataClient(),
			},
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as {
			result: { tools: { name: string }[] };
		};
		expect(
			json.result.tools.map((tool: { name: string }) => tool.name),
		).toEqual([
			"list_exercises",
			"list_recent_workouts",
			"get_workout_sets",
			"list_personal_records",
			"get_exercise_volume",
		]);
	});

	it("lists tools without authentication", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest(
				{
					jsonrpc: "2.0",
					id: 20,
					method: "tools/list",
				},
				{ authorization: null },
			),
			{
				convexUrl: "https://example.convex.cloud",
			},
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as {
			result: { tools: { name: string }[] };
		};
		expect(json.result.tools.map((tool) => tool.name)).toEqual([
			"list_exercises",
			"list_recent_workouts",
			"get_workout_sets",
			"list_personal_records",
			"get_exercise_volume",
		]);
	});

	it("calls a read-only tool", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "list_exercises",
					arguments: {},
				},
			}),
			{
				createDataClient: () => fakeDataClient(),
			},
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as {
			result: { content: { text: string }[] };
		};
		expect(json.result.content[0].text).toContain("Back Squat");
	});

	it("returns an MCP tool error when personal data is requested without authentication", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest(
				{
					jsonrpc: "2.0",
					id: 30,
					method: "tools/call",
					params: {
						name: "list_exercises",
						arguments: {},
					},
				},
				{ authorization: null },
			),
			{
				convexUrl: "https://example.convex.cloud",
			},
		);

		expect(response.status).toBe(200);
		const json = (await response.json()) as {
			result: { isError: boolean; content: { text: string }[] };
		};
		expect(json.result.isError).toBe(true);
		expect(json.result.content[0].text).toBe(
			"Authentication is required. Start at /mcp/auth.",
		);
	});
});
