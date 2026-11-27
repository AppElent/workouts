import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
	EQUIPMENT,
	EXERCISE_CATEGORIES,
	EXERCISE_MEASURES,
	exerciseMeasure,
	SET_LIMITS,
	SET_NOTE_LENGTH,
	validateRecordedTime,
} from "@foundry/core";
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

/** A session that started longer ago than this is being logged afterwards. */
const PAST_SESSION_AFTER_MS = 6 * 60 * 60_000;

/**
 * A recorded time the agent passed: ISO 8601, not in the future, and not
 * before `notBefore` (the session's start), each beyond clock skew.
 */
function recordedTime(
	value: string | undefined,
	label: string,
	now: Date,
	notBefore?: number,
) {
	const at = parseTimestamp(value, label);
	if (at === undefined) return undefined;
	const result = validateRecordedTime(label, at, now.getTime(), notBefore);
	if (result.ok) return at;
	throw new ToolInputError(
		result.errors[0]?.code === "tooSmall"
			? `${label} is before the Strength Session started (${isoDate(notBefore)}).`
			: `${label} is in the future. Use the time it actually happened.`,
	);
}

function pastTime(description: string) {
	return z
		.string()
		.max(40)
		.optional()
		.describe(
			`${description} ISO 8601 with the user's UTC offset, such as 2026-11-16T18:30:00+01:00. Defaults to now; future times are refused.`,
		);
}

async function requireSession(backend: FoundryBackend, id: string) {
	const session = await backend.query(api.workoutSessions.getById, {
		id: id as Id<"workoutSessions">,
	});
	if (!session) throw new ToolInputError("Strength Session not found.");
	return session;
}

/** Refuses a default "now" for a session that started long ago. */
function requireTimeForPastSession(
	session: { startTime: number },
	value: string | undefined,
	label: string,
	now: Date,
) {
	if (value !== undefined) return;
	if (now.getTime() - session.startTime <= PAST_SESSION_AFTER_MS) return;
	throw new ToolInputError(
		`This Strength Session started at ${isoDate(session.startTime)}. For a session logged afterwards, pass ${label} so it lands on that day.`,
	);
}

function isConvexCode(error: unknown, code: string, field?: string) {
	const data = (error as { data?: { code?: unknown; field?: unknown } })?.data;
	return data?.code === code && (field === undefined || data?.field === field);
}

const plannedTarget = z.object({
	reps: z
		.number()
		.int()
		.min(0)
		.max(1000)
		.describe(
			"Target reps, or seconds held when list_exercises gives the Exercise measure seconds",
		),
	weight: z
		.number()
		.min(0)
		.max(2000)
		.optional()
		.describe(
			"Target load in unit; 0 for bodyweight. Give this or percentOfOneRepMax.",
		),
	percentOfOneRepMax: z
		.number()
		.gt(0)
		.max(SET_LIMITS.percentOfOneRepMax.max)
		.optional()
		.describe(
			"Target load as a percentage of the user's 1RM for this Exercise, such as 75. Foundry resolves it from the stored 1RM and rounds to the Exercise's weight step.",
		),
});

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
	session: {
		_id: Id<"workoutSessions">;
		exercises?: { exerciseId: string; plannedSets: unknown[] }[];
	},
) {
	const sets = await backend.query(api.sets.listForSession, {
		sessionId: session._id,
	});
	return (session.exercises ?? []).some(
		(exercise) =>
			sets.filter((set) => set.exerciseId === exercise.exerciseId).length <
			exercise.plannedSets.length,
	);
}

async function sessionWithSets(backend: FoundryBackend, id: string) {
	const session = await requireSession(backend, id);
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
			notes: set.notes,
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
					// A Set's `reps` holds seconds on a timed hold such as Plank.
					measure: exerciseMeasure(exercise),
					personal: !exercise.isDefault,
				}));
			return { exercises };
		},
	}),
	defineTool({
		name: "create_exercise",
		title: "Create exercise",
		description:
			"Create a Personal Exercise for a movement the catalog lacks; it appears in the user's Exercise catalog in the app and only for them. Check list_exercises first and use a catalog Exercise when one fits. When the user already has a Personal Exercise with this name (ignoring case), that one is returned with created false instead of a duplicate, so a retry is safe.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			name: z.string().trim().min(1).max(100),
			muscleGroups: z
				.array(z.string().trim().min(1).max(40))
				.max(12)
				.describe(
					"Muscles worked, such as chest, back, lats, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core",
				),
			equipment: z.enum(EQUIPMENT),
			category: z
				.enum(EXERCISE_CATEGORIES)
				.describe(
					"compound for multi-joint movements, isolation for one joint",
				),
			weightIncrement: z
				.number()
				.positive()
				.max(100)
				.optional()
				.describe(
					"Smallest load step in kg, when it differs from the equipment's default",
				),
			measure: z
				.enum(EXERCISE_MEASURES)
				.optional()
				.describe(
					"seconds for a held time, such as a side plank; default reps",
				),
			notes: z.string().trim().max(500).optional(),
		},
		async run(input, { backend }) {
			const { id, created } = await backend.mutation(
				api.exercises.ensurePersonal,
				input,
			);
			const exercise = await backend.query(api.exercises.getById, { id });
			return {
				created,
				exercise: exercise && {
					id: exercise._id,
					name: exercise.name,
					muscleGroups: exercise.muscleGroups,
					category: exercise.category,
					equipment: exercise.equipment,
					weightIncrement: exercise.weightIncrement,
					measure: exerciseMeasure(exercise),
					personal: true,
				},
			};
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
		name: "create_routine",
		title: "Create routine",
		description:
			"Save a reusable Routine: a named list of Exercises in order, each with suggested sets, reps, and an optional load in kg. It appears in the user's Routines in the app; start_strength_session can start from it. Check list_routines first to avoid a near-duplicate. Name each Exercise once, as in the app. Returns the Routine as saved, in the shape list_routines uses; a retry returns the same result even if the user has changed or deleted the Routine since.",
		access: "write",
		input: {
			idempotencyKey,
			name: z.string().trim().min(1).max(100).describe("Routine name"),
			exercises: z
				.array(
					z.object({
						exerciseId: z
							.string()
							.min(1)
							.describe("Exercise ID from list_exercises or create_exercise"),
						defaultSets: z
							.number()
							.int()
							.min(1)
							.max(SET_LIMITS.plannedSets.max)
							.describe("Suggested number of sets"),
						defaultReps: z
							.number()
							.int()
							.min(1)
							.max(SET_LIMITS.plannedReps.max)
							.describe(
								"Suggested reps per set, or seconds held when list_exercises gives the Exercise measure seconds",
							),
						defaultWeight: z
							.number()
							.min(0)
							.max(SET_LIMITS.plannedWeight.max)
							.optional()
							.describe("Suggested load in kg; omit for bodyweight"),
					}),
				)
				.min(1)
				.max(SET_LIMITS.exercisesPerPrescription.max)
				.describe("Exercises in training order"),
		},
		async run({ idempotencyKey, name, exercises }, { backend }) {
			// Both apps' Routine editors key rows by Exercise, so a repeat breaks them.
			const ids = exercises.map((exercise) => exercise.exerciseId);
			const repeated = ids.find((id, index) => ids.indexOf(id) !== index);
			if (repeated !== undefined)
				throw new ToolInputError(
					`Exercise ${repeated} is listed more than once. List each Exercise once per Routine.`,
				);
			let id: Id<"routines">;
			try {
				id = await backend.mutation(api.routines.create, {
					operationId: `mcp:${idempotencyKey}`,
					name,
					exercises,
				});
			} catch (error) {
				if (isConvexCode(error, "notFound", "exerciseId"))
					throw new ToolInputError(
						"An exerciseId is not one of the user's Exercises. Use IDs from list_exercises, or add the movement with create_exercise.",
					);
				throw error;
			}
			// The receipt accepts only this input for this key, so a retry replays the
			// first result even when the Routine changed since.
			const names = new Map<string, string>(
				(await allExercises(backend)).map((exercise) => [
					exercise._id,
					exercise.name,
				]),
			);
			return {
				routine: {
					id,
					name,
					exercises: exercises.map((exercise) => ({
						...exercise,
						exerciseName: names.get(exercise.exerciseId) ?? "Unknown",
					})),
				},
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
			"Start a Strength Session, free-form or from a Routine. Only one session can be active; if one already is, it is returned with alreadyActive true instead of starting another. To log a training afterwards, pass startedAt; the session then counts on that day everywhere (activities, week overview, history). Repeating the same startedAt returns the session it made, even once finished. Logging a past session while another is active is refused: finish that one first.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			name: z.string().max(100).optional().describe("Free-form session name"),
			routineId: z
				.string()
				.optional()
				.describe("Routine ID from list_routines; its Exercises are added"),
			startedAt: pastTime(
				"When the session started, for one logged afterwards.",
			),
		},
		async run({ name, routineId, startedAt }, { backend, now }) {
			const startTime = recordedTime(startedAt, "startedAt", now());
			const active = await backend.query(api.workoutSessions.getActive, {});
			// The same backdated start again is a retry of the first.
			if (active && (startTime === undefined || active.startTime === startTime))
				return {
					alreadyActive: true,
					session: await sessionWithSets(backend, active._id),
				};
			let id: Id<"workoutSessions">;
			try {
				// Foundry returns a finished session with this past start instead of a second one.
				id = routineId
					? await backend.mutation(api.routines.startSession, {
							routineId: routineId as Id<"routines">,
							startTime,
						})
					: await backend.mutation(api.workoutSessions.create, {
							name,
							startTime,
						});
			} catch (error) {
				if (active && isConvexCode(error, "activeSessionExists"))
					throw new ToolInputError(
						`Another Strength Session is active (started ${isoDate(active.startTime)}). Finish it with finish_strength_session before logging a past one.`,
					);
				throw error;
			}
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
			"Add an Exercise to an active Strength Session, optionally with Planned Sets: targets the app shows for the user to confirm while training. Each Planned Set has target reps and a load, either weight in unit or percentOfOneRepMax (resolved from the user's stored 1RM; refused when none is stored, so ask for it and save it with record_one_rep_max, or give weight). plannedSets replaces that Exercise's Planned Sets, so repeating the call is safe. Add each Exercise with its Planned Sets in one call, before the user opens the session: an app that already shows the Exercise keeps its own plan. Without plannedSets, adding an Exercise that is already there changes nothing.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			sessionId,
			exerciseId,
			plannedSets: z
				.array(plannedTarget)
				.min(1)
				.max(SET_LIMITS.plannedSets.max)
				.optional()
				.describe("Targets in order: set 1 first"),
			unit: unit
				.default("kg")
				.describe("Unit of weight and of the resolved loads"),
		},
		async run({ sessionId, exerciseId, plannedSets, unit }, { backend }) {
			const id = sessionId as Id<"workoutSessions">;
			if (!plannedSets) {
				await backend.mutation(api.workoutSessions.addExercise, {
					sessionId: id,
					exerciseId,
				});
				return { session: await sessionWithSets(backend, sessionId) };
			}
			plannedSets.forEach((target, index) => {
				if (
					(target.weight === undefined) ===
					(target.percentOfOneRepMax === undefined)
				)
					throw new ToolInputError(
						`plannedSets[${index}] needs exactly one of weight or percentOfOneRepMax.`,
					);
			});
			try {
				const plan = await backend.mutation(api.workoutSessions.planExercise, {
					sessionId: id,
					exerciseId,
					unit,
					plannedSets,
				});
				return { plan, session: await sessionWithSets(backend, sessionId) };
			} catch (error) {
				if (isConvexCode(error, "unavailable", "oneRepMax"))
					throw new ToolInputError(
						"No 1RM is stored for this Exercise, so a percentage cannot be resolved. Ask the user for their 1RM and save it with record_one_rep_max, or give weight instead.",
					);
				throw error;
			}
		},
	}),
	defineTool({
		name: "log_set",
		title: "Log set",
		description:
			"Record one performed Set in a Strength Session. The Exercise is added to the session when needed. Set numbers count per Exercise from 1. For a session logged afterwards, pass loggedAt with when the Set was done; it is required once the session started more than 6 hours ago, and it dates 1RM and progress records.",
		access: "write",
		input: {
			idempotencyKey,
			sessionId,
			exerciseId,
			setNumber: z.number().int().min(1).max(10000),
			reps: z
				.number()
				.int()
				.min(0)
				.max(1000)
				.describe(
					"Reps, or seconds held when list_exercises gives the Exercise measure seconds",
				),
			weight: z.number().min(0).max(2000).describe("Load; 0 for bodyweight"),
			unit,
			rpe: z.number().min(1).max(10).optional(),
			notes: z
				.string()
				.trim()
				.max(SET_NOTE_LENGTH)
				.optional()
				.describe("The user's note on this Set, such as narrow grip"),
			setType: setType.default("working"),
			loggedAt: pastTime(
				"When the Set was done, for a session logged afterwards.",
			),
		},
		async run({ idempotencyKey, loggedAt, ...set }, { backend, now }) {
			const session = await requireSession(backend, set.sessionId);
			requireTimeForPastSession(session, loggedAt, "loggedAt", now());
			const id = await backend.mutation(api.sets.add, {
				...set,
				sessionId: session._id,
				operationId: `mcp:${idempotencyKey}`,
				loggedAt: recordedTime(loggedAt, "loggedAt", now(), session.startTime),
			});
			return { setId: id };
		},
	}),
	defineTool({
		name: "update_set",
		title: "Update set",
		description:
			"Correct the reps, load, RPE, note, or classification of a Set.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			setId: z.string().min(1),
			reps: z
				.number()
				.int()
				.min(0)
				.max(1000)
				.optional()
				.describe("Reps, or seconds held on an Exercise measured in seconds"),
			weight: z.number().min(0).max(2000).optional(),
			unit: unit.optional(),
			rpe: z.number().min(1).max(10).nullable().optional(),
			notes: z
				.string()
				.trim()
				.max(SET_NOTE_LENGTH)
				.optional()
				.describe(
					"Replaces the Set's note; an empty string clears it, omitting it keeps it",
				),
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
			"Finish an active Strength Session. While planned Sets are still unlogged it refuses unless discardUnfinished is true. For a session logged afterwards, pass endedAt (for example the last Set's time); it is required once the session started more than 6 hours ago.",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			sessionId,
			discardUnfinished: z.boolean().optional(),
			endedAt: pastTime("When the session ended, for one logged afterwards."),
		},
		async run({ sessionId, discardUnfinished, endedAt }, { backend, now }) {
			const session = await requireSession(backend, sessionId);
			// Finishing a finished session again is a no-op retry.
			let endTime: number | undefined;
			if (session.status === "active") {
				requireTimeForPastSession(session, endedAt, "endedAt", now());
				endTime = recordedTime(endedAt, "endedAt", now(), session.startTime);
				if (!discardUnfinished && (await hasUnloggedTargets(backend, session)))
					throw new ToolInputError(
						"Some planned Sets are not logged yet. Confirm with the user, then finish with discardUnfinished: true.",
					);
			}
			await backend.mutation(api.workoutSessions.finish, {
				id: session._id,
				endTime,
			});
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
