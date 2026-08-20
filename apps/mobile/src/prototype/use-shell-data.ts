/**
 * PROTOTYPE — #46. Delete with the rest of `src/prototype`.
 *
 * Read-only, on purpose: the question is what the shell should look like, not
 * whether the backend works. Nothing here writes, so "Start workout" in any
 * variant navigates without creating a session — which also means you can mash
 * it without filling the database with empty workouts.
 *
 * Real queries against real data, though. A shell judged against three fake
 * rows of lorem ipsum lies about density.
 */
import { useQuery } from "convex/react";
import { api } from "../convex/api";

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
