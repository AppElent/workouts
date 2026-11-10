import { useAuth } from "@clerk/expo";
import { type RequestForQueries, useConvexConnectionState } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";
import { api, type Id } from "../../../convex/api";
import { useQueries } from "../../../convex/query-cache";
import { useRetained } from "../../../data/session-data";

type SessionRecord = NonNullable<
	FunctionReturnType<typeof api.workoutSessions.getById>
>;
type SessionSet = FunctionReturnType<typeof api.sets.listForSession>[number];
type Wods = FunctionReturnType<typeof api.wodResults.listForSession>;

/** One session's record, sets and WOD results; a refresh keeps the last readable copy. */
export function useStrengthSession(id?: Id<"workoutSessions">) {
	const { userId } = useAuth();
	const scope = `${userId ?? ""}:${id ?? ""}`;
	const queries = useMemo((): RequestForQueries => {
		if (!id) return {};
		return {
			[`session${scope}`]: { query: api.workoutSessions.getById, args: { id } },
			[`sets${scope}`]: {
				query: api.sets.listForSession,
				args: { sessionId: id },
			},
			[`wods${scope}`]: {
				query: api.wodResults.listForSession,
				args: { sessionId: id },
			},
		};
	}, [id, scope]);
	const results = useQueries(queries);
	const session = results[`session${scope}`] as
		| SessionRecord
		| null
		| Error
		| undefined;
	const sets = results[`sets${scope}`] as SessionSet[] | Error | undefined;
	const wods = results[`wods${scope}`] as Wods | Error | undefined;
	const keptSession = useRetained(
		scope,
		session instanceof Error ? undefined : session,
	);
	const keptSets = useRetained(scope, Array.isArray(sets) ? sets : undefined);
	const keptWods = useRetained(scope, Array.isArray(wods) ? wods : undefined);
	return {
		session: keptSession === undefined ? session : keptSession,
		sets: keptSets ?? sets,
		wods: keptWods ?? wods,
		verified: Boolean(
			session &&
				!(session instanceof Error) &&
				Array.isArray(sets) &&
				Array.isArray(wods),
		),
		error:
			session instanceof Error ||
			sets instanceof Error ||
			wods instanceof Error,
		online: useConvexConnectionState().isWebSocketConnected,
	};
}
