import { type RequestForQueries, useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";
import { api, type Id } from "../../../convex/api";

/** Read failures must leave the durable draft accessible, including an uncertain Log. */
export function useSetHistory(
	sessionId: Id<"workoutSessions">,
	exerciseId: string,
	operationId?: string,
) {
	const queries = useMemo(
		(): RequestForQueries => ({
			...(exerciseId && sessionId
				? {
						last: {
							query: api.sets.getLastForExercise,
							args: { exerciseId, excludeSessionId: sessionId },
						},
					}
				: {}),
			...(operationId
				? { receipt: { query: api.sets.getLogResult, args: { operationId } } }
				: {}),
		}),
		[sessionId, exerciseId, operationId],
	);
	const values = useQueries(queries);
	const last = values.last as
		| FunctionReturnType<typeof api.sets.getLastForExercise>
		| Error
		| undefined;
	const receipt = values.receipt as
		| FunctionReturnType<typeof api.sets.getLogResult>
		| Error
		| undefined;
	return {
		last: last instanceof Error ? null : last,
		receipt: receipt instanceof Error ? undefined : receipt,
		error: last instanceof Error || receipt instanceof Error,
	};
}
