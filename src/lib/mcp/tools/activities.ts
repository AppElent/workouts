import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { z } from "zod";
import {
	defineTool,
	isoDate,
	parseTimestamp,
	publicDoc,
	ToolInputError,
} from "./define";

const idempotencyKey = z
	.string()
	.min(8)
	.max(100)
	.describe(
		"Unique key for this write, such as a UUID. Reuse it only when retrying the same write.",
	);
const unit = z.enum(["kg", "lbs"]);
const enduranceFields = {
	title: z.string().max(100).optional(),
	notes: z.string().max(2000).optional(),
	environment: z.enum(["indoor", "outdoor"]).optional(),
	elevationGainMeters: z.number().min(0).max(20000).optional(),
	averageHeartRate: z.number().int().min(20).max(250).optional(),
	effort: z
		.number()
		.int()
		.min(1)
		.max(10)
		.optional()
		.describe("Perceived effort, 1–10"),
};

function requiredTimestamp(value: string, label: string) {
	const ms = parseTimestamp(value, label);
	if (ms === undefined) throw new ToolInputError(`${label} is required.`);
	return ms;
}

export const activityTools = [
	defineTool({
		name: "list_activities",
		title: "List activities",
		description:
			"List the user's Activities (Strength Sessions, Runs, and Rides), newest first. Pass the returned cursor to page further.",
		access: "read",
		input: {
			sport: z.enum(["strength", "running", "cycling"]).optional(),
			from: z.string().optional().describe("ISO 8601 start, inclusive"),
			to: z.string().optional().describe("ISO 8601 end, exclusive"),
			limit: z.number().int().min(1).max(50).default(20),
			cursor: z.string().optional(),
		},
		async run({ sport, from, to, limit, cursor }, { backend }) {
			const page = await backend.query(api.activities.list, {
				sport,
				from: parseTimestamp(from, "from"),
				to: parseTimestamp(to, "to"),
				limit,
				cursor: cursor ?? null,
			});
			return {
				activities: page.items.map((item) => ({
					...item,
					occurredAt: isoDate(item.occurredAt),
				})),
				cursor: page.isDone ? null : page.cursor,
			};
		},
	}),
	defineTool({
		name: "get_run_or_ride",
		title: "Get run or ride",
		description: "Return one Run or Ride with all of its details.",
		access: "read",
		input: { activityId: z.string().min(1) },
		async run({ activityId }, { backend }) {
			const activity = await backend.query(api.enduranceActivities.get, {
				id: activityId as Id<"activities">,
			});
			if (!activity) throw new ToolInputError("Run or Ride not found.");
			return {
				activity: { ...activity, occurredAt: isoDate(activity.occurredAt) },
			};
		},
	}),
	defineTool({
		name: "log_run_or_ride",
		title: "Log run or ride",
		description:
			"Record a completed Run (sport running) or Ride (sport cycling) with its distance and moving time.",
		access: "write",
		input: {
			idempotencyKey,
			sport: z.enum(["running", "cycling"]),
			occurredAt: z.string().describe("ISO 8601 start time"),
			durationSeconds: z
				.number()
				.int()
				.min(1)
				.max(86400 * 2),
			distanceMeters: z.number().min(0).max(1_000_000),
			...enduranceFields,
		},
		async run({ idempotencyKey, occurredAt, ...input }, { backend }) {
			const id = await backend.mutation(api.enduranceActivities.create, {
				...input,
				clientEntryId: `mcp:${idempotencyKey}`,
				occurredAt: requiredTimestamp(occurredAt, "occurredAt"),
			});
			return { activityId: id };
		},
	}),
	defineTool({
		name: "update_run_or_ride",
		title: "Update run or ride",
		description:
			"Correct a Run or Ride. Distance, moving time, and start time are required; optional fields set to null are cleared.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			activityId: z.string().min(1),
			occurredAt: z.string().describe("ISO 8601 start time"),
			durationSeconds: z
				.number()
				.int()
				.min(1)
				.max(86400 * 2),
			distanceMeters: z.number().min(0).max(1_000_000),
			title: enduranceFields.title.unwrap().nullable().optional(),
			notes: enduranceFields.notes.unwrap().nullable().optional(),
			environment: enduranceFields.environment.unwrap().nullable().optional(),
			elevationGainMeters: enduranceFields.elevationGainMeters
				.unwrap()
				.nullable()
				.optional(),
			averageHeartRate: enduranceFields.averageHeartRate
				.unwrap()
				.nullable()
				.optional(),
			effort: enduranceFields.effort.unwrap().nullable().optional(),
		},
		async run({ activityId, occurredAt, ...input }, { backend }) {
			await backend.mutation(api.enduranceActivities.update, {
				...input,
				id: activityId as Id<"activities">,
				occurredAt: requiredTimestamp(occurredAt, "occurredAt"),
			});
			return { activityId, updated: true };
		},
	}),
	defineTool({
		name: "list_body_metrics",
		title: "List body metrics",
		description:
			"List the user's body weight, body fat, and circumference entries, newest first.",
		access: "read",
		input: {},
		async run(_, { backend }) {
			const metrics = await backend.query(api.bodyMetrics.list, {});
			return {
				bodyMetrics: metrics.map((metric) => ({
					...(publicDoc(metric) as object),
					date: isoDate(metric.date),
				})),
			};
		},
	}),
	defineTool({
		name: "log_body_metrics",
		title: "Log body metrics",
		description:
			"Record body weight, body fat percentage, and/or circumferences (cm). At least one value is required.",
		access: "write",
		input: {
			idempotencyKey,
			date: z.string().optional().describe("ISO 8601 date; defaults to now"),
			weight: z.number().min(1).max(1000).optional(),
			unit: unit.describe("Unit of weight"),
			bodyFatPct: z.number().min(1).max(75).optional(),
			measurements: z
				.object({
					chest: z.number().min(1).max(300).optional(),
					waist: z.number().min(1).max(300).optional(),
					arms: z.number().min(1).max(150).optional(),
					thighs: z.number().min(1).max(200).optional(),
				})
				.optional(),
			notes: z.string().max(1000).optional(),
		},
		async run({ idempotencyKey, date, ...input }, { backend }) {
			const id = await backend.mutation(api.bodyMetrics.add, {
				...input,
				operationId: `mcp:${idempotencyKey}`,
				date: parseTimestamp(date, "date"),
			});
			return { bodyMetricId: id };
		},
	}),
	defineTool({
		name: "list_wods",
		title: "List WODs",
		description:
			"List shipped and personal WODs (benchmark workouts) with their format and movements.",
		access: "read",
		input: {},
		async run(_, { backend }) {
			return { wods: publicDoc(await backend.query(api.wods.list, {})) };
		},
	}),
	defineTool({
		name: "get_wod_results",
		title: "Get WOD results",
		description:
			"Return the user's scored results for one WOD, newest first, plus their best result.",
		access: "read",
		input: { wodId: z.string().min(1) },
		async run({ wodId }, { backend }) {
			const id = wodId as Id<"wods">;
			const [results, best] = await Promise.all([
				backend.query(api.wodResults.listForWod, { wodId: id }),
				backend.query(api.wodResults.getBest, { wodId: id }),
			]);
			return { results: publicDoc(results), best: publicDoc(best) };
		},
	}),
	defineTool({
		name: "log_wod_result",
		title: "Log WOD result",
		description:
			"Record a scored WOD performance: time in seconds for For Time, rounds and reps for AMRAP, or load for max-effort WODs.",
		access: "write",
		input: {
			idempotencyKey,
			wodId: z.string().min(1),
			sessionId: z
				.string()
				.optional()
				.describe("Strength Session it was done in, if any"),
			date: z.string().optional().describe("ISO 8601 date; defaults to now"),
			rxScaled: z.enum(["rx", "scaled"]),
			timeSeconds: z.number().min(0).max(86400).optional(),
			rounds: z.number().int().min(0).max(10000).optional(),
			reps: z.number().int().min(0).max(100000).optional(),
			timeCapped: z.boolean().optional(),
			load: z.number().min(0).max(2000).optional(),
			loadUnit: unit.optional(),
			notes: z.string().max(1000).optional(),
		},
		async run(
			{ idempotencyKey, wodId, sessionId, date, ...score },
			{ backend },
		) {
			const id = await backend.mutation(api.wodResults.log, {
				...score,
				operationId: `mcp:${idempotencyKey}`,
				wodId: wodId as Id<"wods">,
				sessionId: sessionId as Id<"workoutSessions"> | undefined,
				date: parseTimestamp(date, "date"),
			});
			return { wodResultId: id };
		},
	}),
];
