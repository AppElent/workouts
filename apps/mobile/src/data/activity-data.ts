import type { ActivitySport, ActivitySummary } from "@workouts/core";
import { useQueries } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../convex/api";

type Page = {
	items: ActivitySummary[];
	cursor: string | null;
	isDone: boolean;
};
type Options = {
	sport?: ActivitySport;
	from?: number;
	to?: number;
	limit?: number;
};

/** Keep every loaded page subscribed, including historical edits and deletions. */
export function useActivityPages(options: Options = {}, automatic = false) {
	const key = JSON.stringify(options);
	const [state, setState] = useState<{
		key: string;
		cursors: (string | null)[];
	}>({ key, cursors: [null] });
	const cursors = state.key === key ? state.cursors : [null];
	const cursorKey = JSON.stringify(cursors);
	// Convex's multi-query hook uses request identity for its subscription.
	// Keep it stable even when callers pass a fresh inline options object.
	const queries = useMemo(() => {
		const requestOptions: Options = JSON.parse(key);
		const pageCursors: (string | null)[] = JSON.parse(cursorKey);
		return Object.fromEntries(
			pageCursors.map((cursor, i) => [
				`page${i}`,
				{
					query: api.activities.list,
					args: {
						...requestOptions,
						cursor,
						limit: requestOptions.limit ?? 30,
					},
				},
			]),
		);
	}, [key, cursorKey]);
	const results = useQueries(queries);
	const items: ActivitySummary[] = [];
	const seen = new Set<string>();
	const validCursors: (string | null)[] = [null];
	let last: Page | undefined;
	let waiting = false;
	for (let i = 0; i < cursors.length; i++) {
		if (i > 0 && (last?.isDone || last?.cursor !== cursors[i])) break;
		const result = results[`page${i}`] as Page | Error | undefined;
		if (result instanceof Error) throw result;
		if (i > 0) validCursors.push(cursors[i]);
		if (!result) {
			waiting = true;
			break;
		}
		last = result;
		for (const item of result.items) {
			const identity = `${item.sport}:${item.id}`;
			if (!seen.has(identity)) {
				seen.add(identity);
				items.push(item);
			}
		}
	}
	const next = !waiting && last && !last.isDone ? last.cursor : null;
	if (automatic && next !== null) validCursors.push(next);
	const nextState = JSON.stringify(validCursors);
	useEffect(() => {
		setState((current) =>
			current.key === key && JSON.stringify(current.cursors) === nextState
				? current
				: { key, cursors: JSON.parse(nextState) },
		);
	}, [key, nextState]);
	return {
		items,
		loading: waiting || last === undefined || (automatic && !last.isDone),
		hasMore: !last?.isDone,
		loadMore: () => {
			if (next !== null) setState({ key, cursors: [...validCursors, next] });
		},
	};
}
