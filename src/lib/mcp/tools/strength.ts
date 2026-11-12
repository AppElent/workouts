import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Exercise } from "@foundry/core/exercises";
import { mergeExerciseCatalog } from "@foundry/core/exercises";
import { z } from "zod";
import {
	defineTool,
	type FoundryBackend,
	isoDate,
	parseTimestamp,
	publicDoc,
	ToolInputError,
} from "./define";

const unit = z.enum(["kg", "lbs"]).describe("Load unit");
const setType = z
	.enum(["warmup", "working", "drop", "failure"])
	.describe("Set classification; use working unless the user says otherwise");
const idempotencyKey = z
	.string()
	.min(8)
	.max(100)
	.describe(
		"Unique key for this write, such as a UUID. Reuse it only when retrying the same write.",
	);
const sessionId = z.string().min(1).describe("Strength Session ID");
const exerciseId = z
	.string()
	.min(1)
	.describe("Exercise ID from list_exercises");

export async function allExercises(backend: FoundryBackend) {
	const personal: Exercise[] = [];
	let cursor: string | null = null;
	for (let pages = 0; pages < 20; pages++) {
		const page: { page: Exercise[]; isDone: boolean; continueCursor: string } =
			await backend.query(api.exercises.listPersonal, {
				paginationOpts: { numItems: 100, cursor },
			});
		personal.push(...page.page);
		if (page.isDone) break;
		cursor = page.continueCursor;
	}
	return mergeExerciseCatalog(personal);
}

function sessionSummary(session: {
	_id: string;
	name?: string;
	status: string;
	startTime: number;
	endTime?: number;
	exercises?: unknown;
}) {
	return {
		id: session._id,
		name: session.name,
		status: session.status,
		startedAt: isoDate(session.startTime),
		endedAt: isoDate(session.endTime),
		exercises: session.exercises,
	};
}

/** The app finishes regardless; an agent confirms leaving planned Sets first. */
async function hasUnloggedTargets(
	backend: FoundryBackend,
	id: Id<"workoutSessions">,
) {
	const session = await backend.query(api.workoutSessions.getById, { id });
	if (!session) throw new ToolInputError("Strength Session not found.");
	const sets = await backend.query(api.sets.listForSession, { sessionId: id });
	return (session.exercises ?? []).some(
		(exercise) =>
			sets.filter((set) => set.exerciseId === exercise.exerciseId).length <
			exercise.plannedSets.length,
	);
}

async function sessionWithSets(backend: FoundryBackend, id: string) {
	const session = await backend.query(api.workoutSessions.getById, {
		id: id as Id<"workoutSessions">,
	});
	if (!session) throw new ToolInputError("Strength Session not found.");
	const sets = await backend.query(api.sets.listForSession, {
		sessionId: session._id,
	});
	return {
		...sessionSummary(session),
		sets: sets.map((set) => ({
			id: set._id,
			exerciseId: set.exerciseId,
			setNumber: set.setNumber,
			reps: set.reps,
			weight: set.weight,
			unit: set.unit,
			rpe: set.rpe,
			setType: set.setType,
			loggedAt: isoDate(set.loggedAt),
		})),
	};
}

export const strengthTools = [
	defineTool({
		name: "list_exercises",
		title: "List exercises",
		description:
			"List the shipped Exercise catalog plus the user's Personal Exercises. Filter by name or muscle group to keep results small.",
		access: "read",
		input: {
			query: z
				.string()
				.max(100)
				.optional()
				.describe("Case-insensitive match on name or muscle group"),
		},
		async run({ query }, { backend }) {
			const needle = query?.trim().toLowerCase();
			const exercises = (await allExercises(backend))
				.filter(
					(exercise) =>
						!needle ||
						exercise.name.toLowerCase().includes(needle) ||
						exercise.muscleGroups.some((group) =>
							group.toLowerCase().includes(needle),
						),
				)
				.map((exercise) => ({
					id: exercise._id,
					name: exercise.name,
					muscleGroups: exercise.muscleGroups,
					category: exercise.category,
					equipment: exercise.equipment,
					personal: !exercise.isDefault,
				}));
			return { exercises };
		},
	}),
	defineTool({
		name: "get_exercise_history",
		title: "Get exercise history",
		description:
			"Return the user's recorded Sets for one Exercise, grouped by Strength Session.",
		access: "read",
		input: { exerciseId },
		async run({ exerciseId }, { backend }) {
			return {
				history: publicDoc(
					await backend.query(api.exercises.getHistory, { exerciseId }),
				),
			};
		},
	}),
	defineTool({
		name: "get_exercise_volume",
		title: "Get exercise volume",
		description:
			"Return weekly work volume (reps × load in kg, warm-ups excluded, ISO weeks in UTC) for one Exercise.",
		access: "read",
		input: { exerciseId },
		async run({ exerciseId }, { backend }) {
			return {
				weeks: await backend.query(api.progress.weeklyVolume, {
					exerciseId,
					utcOffsetMinutes: 0,
				}),
			};
		},
	}),
	defineTool({
		name: "list_one_rep_maxes",
		title: "List one-rep maxes",
		description:
			"List the user's current one-rep max per Exercise, with its source (manual, calculated, or actual).",
		access: "read",
		input: {},
		async run(_, { backend }) {
			const records = await backend.query(
				api.oneRepMaxes.listCurrentForUser,
				{},
			);
			return {
				oneRepMaxes: records.map((record) => ({
					id: record._id,
					exerciseId: record.exerciseId,
					value: record.value,
					unit: record.unit,
					date: isoDate(record.date),
					source: record.source,
					formula: record.formula,
				})),
			};
		},
	}),
	defineTool({
		name: "list_routines",
		title: "List routines",
		description:
			"List the user's Routines with their Exercises and suggested sets, reps, and loads.",
		access: "read",
		input: {},
		async run(_, { backend }) {
			return {
				routines: publicDoc(await backend.query(api.routines.list, {})),
			};
		},
	}),
	defineTool({
		name: "get_active_strength_session",
		title: "Get active strength session",
		description:
			"Return the user's active Strength Session with its Sets, or null when none is running.",
		access: "read",
		input: {},
		async run(_, { backend }) {
			const active = await backend.query(api.workoutSessions.getActive, {});
			return {
				session: active ? await sessionWithSets(backend, active._id) : null,
			};
		},
	}),
	defineTool({
		name: "get_strength_session",
		title: "Get strength session",
		description: "Return one Strength Session with all of its Sets.",
		access: "read",
		input: { sessionId },
		async run({ sessionId }, { backend }) {
			return { session: await sessionWithSets(backend, sessionId) };
		},
	}),
	defineTool({
		name: "start_strength_session",
		title: "Start strength session",
		description:
			"Start a Strength Session, free-form or from a Routine. Only one session can be active; if one already is, it is returned with alreadyActive true instead of starting another.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			name: z.string().max(100).optional().describe("Free-form session name"),
			routineId: z
				.string()
				.optional()
				.describe("Routine ID from list_routines; its Exercises are added"),
		},
		async run({ name, routineId }, { backend }) {
			const active = await backend.query(api.workoutSessions.getActive, {});
			if (active) {
				return {
					alreadyActive: true,
					session: await sessionWithSets(backend, active._id),
				};
			}
			const id = routineId
				? await backend.mutation(api.routines.startSession, {
						routineId: routineId as Id<"routines">,
					})
				: await backend.mutation(api.workoutSessions.create, { name });
			return {
				alreadyActive: false,
				session: await sessionWithSets(backend, id),
			};
		},
	}),
	defineTool({
		name: "add_exercise_to_session",
		title: "Add exercise to session",
		description:
			"Add an Exercise to an active Strength Session. Adding one that is already there changes nothing.",
		access: "write",
		annotations: { idempotentHint: true },
		input: { sessionId, exerciseId },
		async run({ sessionId, exerciseId }, { backend }) {
			await backend.mutation(api.workoutSessions.addExercise, {
				sessionId: sessionId as Id<"workoutSessions">,
				exerciseId,
			});
			return { session: await sessionWithSets(backend, sessionId) };
		},
	}),
	defineTool({
		name: "log_set",
		title: "Log set",
		description:
			"Record one performed Set in a Strength Session. The Exercise is added to the session when needed. Set numbers count per Exercise from 1.",
		access: "write",
		input: {
			idempotencyKey,
			sessionId,
			exerciseId,
			setNumber: z.number().int().min(1).max(10000),
			reps: z.number().int().min(0).max(1000),
			weight: z.number().min(0).max(2000).describe("Load; 0 for bodyweight"),
			unit,
			rpe: z.number().min(1).max(10).optional(),
			setType: setType.default("working"),
		},
		async run({ idempotencyKey, ...set }, { backend }) {
			const id = await backend.mutation(api.sets.add, {
				...set,
				sessionId: set.sessionId as Id<"workoutSessions">,
				operationId: `mcp:${idempotencyKey}`,
			});
			return { setId: id };
		},
	}),
	defineTool({
		name: "update_set",
		title: "Update set",
		description: "Correct the reps, load, RPE, or classification of a Set.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			setId: z.string().min(1),
			reps: z.number().int().min(0).max(1000).optional(),
			weight: z.number().min(0).max(2000).optional(),
			unit: unit.optional(),
			rpe: z.number().min(1).max(10).nullable().optional(),
			setType: setType.optional(),
		},
		async run({ setId, ...changes }, { backend }) {
			await backend.mutation(api.sets.update, {
				id: setId as Id<"sets">,
				...changes,
			});
			return { setId, updated: true };
		},
	}),
	defineTool({
		name: "finish_strength_session",
		title: "Finish strength session",
		description:
			"Finish an active Strength Session. While planned Sets are still unlogged it refuses unless discardUnfinished is true.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			sessionId,
			discardUnfinished: z.boolean().optional(),
		},
		async run({ sessionId, discardUnfinished }, { backend }) {
			const id = sessionId as Id<"workoutSessions">;
			if (!discardUnfinished && (await hasUnloggedTargets(backend, id)))
				throw new ToolInputError(
					"Some planned Sets are not logged yet. Confirm with the user, then finish with discardUnfinished: true.",
				);
			await backend.mutation(api.workoutSessions.finish, { id });
			return { session: await sessionWithSets(backend, sessionId) };
		},
	}),
	defineTool({
		name: "record_one_rep_max",
		title: "Record one-rep max",
		description:
			"Record a manually known one-rep max for an Exercise, for example from a test day.",
		access: "write",
		input: {
			idempotencyKey,
			exerciseId,
			value: z.number().positive().max(2000),
			unit,
			date: z
				.string()
				.optional()
				.describe("ISO 8601 date it was achieved; defaults to now"),
		},
		async run({ idempotencyKey, exerciseId, value, unit, date }, { backend }) {
			const id = await backend.mutation(api.oneRepMaxes.addManual, {
				operationId: `mcp:${idempotencyKey}`,
				exerciseId,
				value,
				unit,
				date: parseTimestamp(date, "date"),
			});
			return { oneRepMaxId: id };
		},
	}),
];
