import { useAuth } from "@clerk/expo";
import {
	type RequestForQueries,
	useConvexConnectionState,
	useQueries,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useState } from "react";
import { api, type Id } from "../../../convex/api";

export type SessionRecord = NonNullable<
	FunctionReturnType<typeof api.workoutSessions.getById>
>;
export type SessionSet = FunctionReturnType<
	typeof api.sets.listForSession
>[number];
type Wods = FunctionReturnType<typeof api.wodResults.listForSession>;
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
	const [retained, setRetained] = useState<{
		scope: string;
		session?: SessionRecord | null;
		sets?: SessionSet[];
		wods?: Wods;
	}>();
	useEffect(() => {
		setRetained((previous) => {
			const old = previous?.scope === scope ? previous : undefined;
			const next = {
				scope,
				session:
					session instanceof Error || session === undefined
						? old?.session
						: session,
				sets: Array.isArray(sets) ? sets : old?.sets,
				wods: Array.isArray(wods) ? wods : old?.wods,
			};
			return old &&
				old.session === next.session &&
				old.sets === next.sets &&
				old.wods === next.wods
				? old
				: next;
		});
	}, [scope, session, sets, wods]);
	const previous = retained?.scope === scope ? retained : undefined;
	return {
		session:
			session instanceof Error || session === undefined
				? (previous?.session ?? session)
				: session,
		sets: Array.isArray(sets) ? sets : (previous?.sets ?? sets),
		wods: Array.isArray(wods) ? wods : (previous?.wods ?? wods),
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
