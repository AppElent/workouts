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

function mcpRequest(body: unknown) {
	return new Request("http://localhost:3000/mcp", {
		method: "POST",
		headers: {
			accept: "application/json, text/event-stream",
			"content-type": "application/json",
			authorization: "Bearer test-token",
		},
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
		).toEqual(
			expect.arrayContaining(["list_exercises", "list_recent_workouts"]),
		);
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
});
