import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";

export type ExerciseSummary = {
	id: string;
	name: string;
	muscleGroups: string[];
	category: "compound" | "isolation";
	equipment:
		| "barbell"
		| "dumbbell"
		| "cable"
		| "bodyweight"
		| "machine"
		| "kettlebell"
		| "band"
		| "other";
	isDefault: boolean;
	notes?: string;
};

export type WorkoutSummary = {
	id: string;
	name?: string;
	date: number;
	status: "active" | "completed" | "cancelled";
	startTime: number;
	endTime?: number;
};

export type WorkoutSetSummary = {
	id: string;
	exerciseId: string;
	setNumber: number;
	reps: number;
	weight: number;
	unit: "kg" | "lbs";
	rpe?: number;
	setType: "warmup" | "working" | "drop" | "failure";
	loggedAt: number;
};

export type PersonalRecordSummary = {
	id: string;
	exerciseId: string;
	value: number;
	unit: "kg" | "lbs";
	date: number;
	source: "manual" | "calculated" | "actual";
	formula?: string;
};

export type WeeklyVolumeSummary = {
	week: string;
	volume: number;
};

export type WorkoutsMcpDataClient = {
	listExercises(): Promise<ExerciseSummary[]>;
	listRecentWorkouts(args: { limit?: number }): Promise<WorkoutSummary[]>;
	getWorkoutSets(args: { sessionId: string }): Promise<WorkoutSetSummary[]>;
	listPersonalRecords(): Promise<PersonalRecordSummary[]>;
	getExerciseVolume(args: {
		exerciseId: string;
	}): Promise<WeeklyVolumeSummary[]>;
};

export class McpAuthRequiredError extends Error {
	constructor() {
		super("Authentication is required for Workouts MCP tools.");
		this.name = "McpAuthRequiredError";
		Object.setPrototypeOf(this, McpAuthRequiredError.prototype);
	}
}

export function createConvexWorkoutsMcpDataClient({
	convexUrl,
	token,
}: {
	convexUrl: string;
	token?: string;
}): WorkoutsMcpDataClient {
	const client = new ConvexHttpClient(convexUrl);
	if (token) {
		client.setAuth(token);
	}

	function requireAuth() {
		if (!token) throw new McpAuthRequiredError();
	}

	return {
		async listExercises() {
			requireAuth();
			const exercises = await client.query(api.exercises.list, {});
			return exercises.map((exercise) => ({
				id: exercise._id,
				name: exercise.name,
				muscleGroups: exercise.muscleGroups,
				category: exercise.category,
				equipment: exercise.equipment,
				isDefault: exercise.isDefault,
				notes: exercise.notes,
			}));
		},
		async listRecentWorkouts({ limit }) {
			requireAuth();
			const sessions = await client.query(api.workoutSessions.listRecent, {
				limit,
			});
			return sessions.map((session) => ({
				id: session._id,
				name: session.name,
				date: session.date,
				status: session.status,
				startTime: session.startTime,
				endTime: session.endTime,
			}));
		},
		async getWorkoutSets({ sessionId }) {
			requireAuth();
			const sets = await client.query(api.sets.listForSession, {
				sessionId: sessionId as Id<"workoutSessions">,
			});
			return sets.map((set) => ({
				id: set._id,
				exerciseId: set.exerciseId,
				setNumber: set.setNumber,
				reps: set.reps,
				weight: set.weight,
				unit: set.unit,
				rpe: set.rpe,
				setType: set.setType,
				loggedAt: set.loggedAt,
			}));
		},
		async listPersonalRecords() {
			requireAuth();
			const records = await client.query(
				api.oneRepMaxes.listCurrentForUser,
				{},
			);
			return records.map((record) => ({
				id: record._id,
				exerciseId: record.exerciseId,
				value: record.value,
				unit: record.unit,
				date: record.date,
				source: record.source,
				formula: record.formula,
			}));
		},
		async getExerciseVolume({ exerciseId }) {
			requireAuth();
			return client.query(api.progress.weeklyVolume, {
				exerciseId: exerciseId as Id<"exercises">,
			});
		},
	};
}
