import { useAuth } from "@clerk/expo";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { api } from "../../convex/api";
import { useOnline } from "../../convex/online";
import { useQueries } from "../../convex/query-cache";
import { useRetained } from "../../data/session-data";

export type Routine = FunctionReturnType<typeof api.routines.list>[number];
type Active = FunctionReturnType<typeof api.workoutSessions.getActive>;

/** Keep readable rows during a refresh, scoped to the signed-in account. */
export function useTrainingData() {
	const { userId } = useAuth();
	const online = useOnline();
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
	const kept = useRetained(
		userId ?? "signed-out",
		Array.isArray(routines) ? routines : undefined,
	);
	return {
		routines: kept,
		error: routines instanceof Error,
		refreshing: !Array.isArray(routines),
		active,
		online,
		retry: () => setRevision((value) => value + 1),
	};
}
