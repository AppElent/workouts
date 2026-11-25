/**
 * The last finished session of the same routine (or, without a routine, the
 * same name), so the recap can say how today compares (APP-255). Read-only,
 * from existing queries: no backend change.
 */
import { type TimedLookup, toKg, workingVolume } from "@foundry/core";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";

const LOOKBACK = 50;

export type SessionTotals = {
	durationSeconds: number | null;
	volume: number;
	workingSets: number;
	reps: number;
	/** Heaviest working set per exercise, ties to more reps. */
	top: Record<string, { kg: number; reps: number }>;
	/** Working sets and kilograms moved per exercise. */
	byExercise: Record<string, { sets: number; volume: number }>;
};

type SetLike = {
	exerciseId: string;
	weight: number;
	unit: "kg" | "lbs";
	reps: number;
	setType: string;
};

export function totalsOf(
	sets: readonly SetLike[],
	durationSeconds: number | null,
	isTimed: TimedLookup,
): SessionTotals {
	const working = sets.filter((set) => set.setType !== "warmup");
	const top: SessionTotals["top"] = {};
	const byExercise: SessionTotals["byExercise"] = {};
	for (const set of working) {
		const kg = toKg(set.weight, set.unit);
		const sum = byExercise[set.exerciseId] ?? { sets: 0, volume: 0 };
		byExercise[set.exerciseId] = {
			sets: sum.sets + 1,
			volume:
				sum.volume + (isTimed(set.exerciseId) ? 0 : Math.max(0, kg) * set.reps),
		};
		const best = top[set.exerciseId];
		if (!best || kg > best.kg || (kg === best.kg && set.reps > best.reps))
			top[set.exerciseId] = { kg, reps: set.reps };
	}
	return {
		durationSeconds,
		volume: workingVolume(
			working.map((set) => ({
				...set,
				setType: set.setType as Doc<"sets">["setType"],
			})),
			isTimed,
		),
		workingSets: working.length,
		reps: working
			.filter((set) => !isTimed(set.exerciseId))
			.reduce((sum, set) => sum + set.reps, 0),
		top,
		byExercise,
	};
}

/**
 * The same set last time: the set of the same kind (warm-up or not) with this
 * number in the previous session, for "Last time" (APP-619). Past the last
 * one, the last one.
 */
export function previousSetOf(
	sets: readonly (SetLike & {
		setNumber: number;
		rpe?: number;
		loggedAt?: number;
	})[],
	exerciseId: string,
	number: number,
	warmup = false,
) {
	const same = previousSetsOf(sets, exerciseId).filter(
		(set) => (set.setType === "warmup") === warmup,
	);
	const set = same[number - 1] ?? same.at(-1);
	return set
		? {
				kg: toKg(set.weight, set.unit),
				reps: set.reps,
				rpe: set.rpe ?? null,
				date: set.loggedAt ?? null,
			}
		: null;
}

/** One exercise's sets in the previous session, in the order they were done. */
export function previousSetsOf<T extends SetLike & { setNumber: number }>(
	sets: readonly T[],
	exerciseId: string,
) {
	return sets
		.filter((set) => set.exerciseId === exerciseId)
		.sort((a, b) => a.setNumber - b.setNumber);
}

/** Picks the comparison session: same routine first, else same name. */
export function pickPrevious(
	current: Pick<Doc<"workoutSessions">, "_id" | "routineId" | "name">,
	recent: readonly Doc<"workoutSessions">[],
) {
	const done = recent.filter(
		(session) => session._id !== current._id && session.status === "completed",
	);
	if (current.routineId)
		return done.find((session) => session.routineId === current.routineId);
	if (current.name)
		return done.find(
			(session) => !session.routineId && session.name === current.name,
		);
	return undefined;
}

export function usePreviousSession(
	current:
		| Pick<Doc<"workoutSessions">, "_id" | "routineId" | "name">
		| null
		| undefined,
) {
	const recent = useQuery(
		api.workoutSessions.listRecent,
		current ? { limit: LOOKBACK } : "skip",
	);
	const previous = current && recent ? pickPrevious(current, recent) : null;
	const sets = useQuery(
		api.sets.listForSession,
		previous ? { sessionId: previous._id as Id<"workoutSessions"> } : "skip",
	);
	if (!previous || !sets) return null;
	const durationSeconds =
		previous.endTime !== undefined
			? Math.round((previous.endTime - previous.startTime) / 1000)
			: null;
	return { date: previous.startTime, durationSeconds, sets };
}
