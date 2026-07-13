import { describe, expect, it, vi } from "vitest";
import type { WorkoutsMcpDataClient } from "./dataClient";
import { createWorkoutsMcpServer } from "./server";

function createFakeDataClient(): WorkoutsMcpDataClient {
	return {
		listExercises: vi.fn<WorkoutsMcpDataClient["listExercises"]>(async () => [
			{
				id: "exercise1",
				name: "Back Squat",
				muscleGroups: ["quads", "glutes"],
				category: "compound",
				equipment: "barbell",
				isDefault: true,
			},
		]),
		listRecentWorkouts: vi.fn<WorkoutsMcpDataClient["listRecentWorkouts"]>(
			async () => [
				{
					id: "session1",
					name: "Leg Day",
					date: 1_700_000_000_000,
					status: "completed",
					startTime: 1_700_000_000_000,
					endTime: 1_700_003_600_000,
				},
			],
		),
		getWorkoutSets: vi.fn<WorkoutsMcpDataClient["getWorkoutSets"]>(async () => [
			{
				id: "set1",
				exerciseId: "exercise1",
				setNumber: 1,
				reps: 5,
				weight: 100,
				unit: "kg",
				setType: "working",
				loggedAt: 1_700_000_100_000,
			},
		]),
		listPersonalRecords: vi.fn<WorkoutsMcpDataClient["listPersonalRecords"]>(
			async () => [
				{
					id: "orm1",
					exerciseId: "exercise1",
					value: 140,
					unit: "kg",
					date: 1_700_000_000_000,
					source: "actual",
				},
			],
		),
		getExerciseVolume: vi.fn<WorkoutsMcpDataClient["getExerciseVolume"]>(
			async () => [
				{
					week: "2026-W01",
					volume: 2400,
				},
			],
		),
	};
}

describe("createWorkoutsMcpServer", () => {
	it("creates a connected-capable MCP server with registered tools", () => {
		const server = createWorkoutsMcpServer({
			dataClient: createFakeDataClient(),
		});

		expect(server).toBeDefined();
		expect(server.isConnected()).toBe(false);
	});
});
