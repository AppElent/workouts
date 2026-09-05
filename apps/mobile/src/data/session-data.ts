/**
 * The reads every screen shares: what is running now, what ran recently, and
 * the exercise catalog. Grouped into one hook because Home, Train and Progress
 * all want the same three, and Convex subscriptions deduplicate — asking three
 * times costs one socket's worth of traffic, not three.
 *
 * Reads only. Mutations live with the screen that fires them, so that a screen
 * reading this file is provably incapable of writing.
 */
import { useQuery } from "convex/react";
import { api, type Doc, type Id } from "../convex/api";

export function useShellData() {
	const active = useQuery(api.workoutSessions.getActive, {});
	const recent = useQuery(api.workoutSessions.listRecent, { limit: 8 });
	const exercises = useQuery(api.exercises.list, {});

	return {
		active,
		recent,
		exercises,
		/** `undefined` while any of the three is still in flight. */
		loading:
			active === undefined || recent === undefined || exercises === undefined,
	};
}

/** "Tue 12 Aug" — short enough for a row, unambiguous enough for a list. */
export function formatSessionDate(ms: number) {
	return new Date(ms).toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

/** "48m" / "1h 12m". Returns null for a session that never ended. */
export function formatDuration(startTime: number, endTime?: number) {
	if (!endTime) return null;
	const minutes = Math.max(1, Math.round((endTime - startTime) / 60000));
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** The user's routine templates, each with its exercises' names resolved. */
export function useRoutines() {
	return useQuery(api.routines.list, {});
}

/**
 * The running session, or null. Separate from `useShellData` so the chrome can
 * subscribe to just this one without pulling the exercise catalog with it.
 */
export function useActiveSession() {
	return useQuery(api.workoutSessions.getActive, {});
}

/** One session by id, for the summary screen. `null` if it isn't yours. */
export function useSession(id: Id<"workoutSessions"> | undefined) {
	return useQuery(api.workoutSessions.getById, id ? { id } : "skip");
}

/** Every set logged in a session, in insertion order. */
export function useSessionSets(id: Id<"workoutSessions"> | undefined) {
	return useQuery(api.sets.listForSession, id ? { sessionId: id } : "skip");
}

/**
 * The exercises in a session, ordered by when each first appeared — the same
 * rule the web uses in `src/routes/log/$sessionId.tsx`. Not alphabetical: the
 * order you worked in is the order you want to read back, and it keeps the
 * exercise you are mid-way through from jumping around as sets land.
 */
export function orderExercisesByFirstSet(sets: Doc<"sets">[]) {
	const seen: Id<"exercises">[] = [];
	for (const set of sets) {
		if (!seen.includes(set.exerciseId)) seen.push(set.exerciseId);
	}
	return seen;
}

/**
 * Volume in the sense the web's `SessionSummary` means it: working sets only.
 * Warmups, drop sets and failures are real work but they are not the number
 * anyone compares week to week, and counting them makes a deload look like a
 * personal best.
 */
export function workingVolume(sets: Doc<"sets">[]) {
	return sets
		.filter((s) => s.setType === "working")
		.reduce((total, s) => total + s.weight * s.reps, 0);
}
