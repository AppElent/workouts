import type { ExerciseId } from "@foundry/core/exercises";
/**
 * Strength-session reads the screens share. Reads only: mutations live with
 * the screen that fires them.
 */
import { useEffect, useState } from "react";
import { api, type Doc, type Id } from "../convex/api";
import { useQuery } from "../convex/query-cache";
import { dateLocale, type Locale } from "../i18n";

/** "Tue 12 Aug" — short enough for a row, unambiguous enough for a list. */
export function formatSessionDate(ms: number, locale: Locale) {
	return new Date(ms).toLocaleDateString(dateLocale(locale), {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}

/** The user's routine templates, each with its exercises' names resolved. */
export function useRoutines() {
	return useQuery(api.routines.list, {});
}

/** The running session, or null. */
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
 * The exercises in a session, ordered by when each first appeared. The order
 * you worked in is the order you want to read back.
 */
export function orderExercisesByFirstSet(sets: Doc<"sets">[]) {
	const seen: ExerciseId[] = [];
	for (const set of sets) {
		if (!seen.includes(set.exerciseId)) seen.push(set.exerciseId);
	}
	return seen;
}

/**
 * `fresh` while it is defined, otherwise the last defined value seen under the
 * same `scope`. A refresh keeps readable rows; another account or session
 * starts empty.
 */
export function useRetained<T>(scope: string, fresh: T | undefined) {
	const [kept, setKept] = useState<{ scope: string; value: T }>();
	useEffect(() => {
		if (fresh === undefined) return;
		setKept((previous) =>
			previous?.scope === scope && previous.value === fresh
				? previous
				: { scope, value: fresh },
		);
	}, [scope, fresh]);
	if (fresh !== undefined) return fresh;
	return kept?.scope === scope ? kept.value : undefined;
}
