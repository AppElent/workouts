/**
 * The last finished session of the same routine (or, without a routine, the
 * same name), so the recap can say how today compares (APP-255). Read-only,
 * from existing queries: no backend change.
 */
import { isTimedExercise, toKg, workingVolume } from "@foundry/core";
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
				sum.volume +
				(isTimedExercise(set.exerciseId) ? 0 : Math.max(0, kg) * set.reps),
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
		),
		workingSets: working.length,
		reps: working
			.filter((set) => !isTimedExercise(set.exerciseId))
			.reduce((sum, set) => sum + set.reps, 0),
		top,
		byExercise,
	};
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
	const duration =
		previous.endTime !== undefined
			? Math.round((previous.endTime - previous.startTime) / 1000)
			: null;
	return {
		date: previous.startTime,
		totals: totalsOf(sets, duration),
	};
}
