import { useAuth } from "@clerk/expo";
import { useConvexConnectionState, useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../convex/api";

export type Routine = FunctionReturnType<typeof api.routines.list>[number];
type Active = FunctionReturnType<typeof api.workoutSessions.getActive>;

/** Keep readable rows during a refresh, scoped to the signed-in account. */
export function useTrainingData() {
	const { userId } = useAuth();
	const online = useConvexConnectionState().isWebSocketConnected;
	const [revision, setRevision] = useState(0);
	const queryScope = `${userId ?? "signed-out"}:${revision}`;
	const queries = useMemo(
		() => ({
			[`routines${queryScope}`]: { query: api.routines.list, args: {} },
			[`active${queryScope}`]: {
				query: api.workoutSessions.getActive,
				args: {},
			},
		}),
		[queryScope],
	);
	const results = useQueries(queries);
	const routines = results[`routines${queryScope}`] as
		| Routine[]
		| Error
		| undefined;
	const active = results[`active${queryScope}`] as Active | Error | undefined;
	const [retained, setRetained] = useState<{
		subject: typeof userId;
		rows: Routine[];
	}>();
	useEffect(() => {
		if (Array.isArray(routines))
			setRetained({ subject: userId, rows: routines });
	}, [routines, userId]);
	return {
		routines: Array.isArray(routines)
			? routines
			: retained?.subject === userId
				? retained?.rows
				: undefined,
		error: routines instanceof Error,
		refreshing: !Array.isArray(routines),
		active,
		online,
		retry: () => setRevision((value) => value + 1),
	};
}
