/**
 * The app query module (`retention` flavor of the Convex query caching
 * standard). Screens import query hooks from here, never from `convex/react`.
 */

import { canonicalJson } from "@foundry/core";
import {
	type PaginatedQueryArgs,
	type PaginatedQueryReference,
	type UsePaginatedQueryReturnType,
	usePaginatedQuery,
} from "convex/react";
import {
	ConvexQueryCacheProvider,
	useQueries,
	useQuery,
} from "convex-helpers/react/cache";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

// Paginated queries pass through: the helper's page ids change on every
// mount, so retaining them never produces a hit.
export { usePaginatedQuery, useQueries, useQuery };

/**
 * A paginated query that unsubscribes while `active` is false and, until its
 * first page arrives again, keeps answering with the last results for the same
 * arguments (as `LoadingMore`). Returning to a screen then neither flashes a
 * loading state nor empties a list and resets its scroll position.
 */
export function usePausablePaginatedQuery<
	Query extends PaginatedQueryReference,
>(
	query: Query,
	args: PaginatedQueryArgs<Query> | "skip",
	options: { initialNumItems: number },
	active: boolean,
): UsePaginatedQueryReturnType<Query> {
	const result = usePaginatedQuery(query, active ? args : "skip", options);
	const key = args === "skip" ? undefined : canonicalJson(args);
	const last = useRef<{ key: string; results: typeof result.results }>(
		undefined,
	);
	if (key !== undefined && active && result.status !== "LoadingFirstPage")
		last.current = { key, results: result.results };
	if (
		key !== undefined &&
		result.status === "LoadingFirstPage" &&
		last.current?.key === key
	)
		return {
			...result,
			results: last.current.results,
			status: "LoadingMore",
			isLoading: true,
		};
	return result;
}

const EXPIRATION_MS = 5 * 60_000;
const MAX_IDLE_ENTRIES = 20;

/** Retain recently left subscriptions within one account; release idle ones in background. */
export function AppQueryCacheProvider({
	scope,
	children,
}: {
	scope: string;
	children: ReactNode;
}) {
	const [foreground, setForeground] = useState(
		() => AppState.currentState === "active",
	);
	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		return () => listener.remove();
	}, []);
	return (
		<ConvexQueryCacheProvider
			key={scope}
			expiration={foreground ? EXPIRATION_MS : 0}
			maxIdleEntries={foreground ? MAX_IDLE_ENTRIES : 0}
		>
			{children}
		</ConvexQueryCacheProvider>
	);
}
