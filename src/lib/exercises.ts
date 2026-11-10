import { api } from "@convex/_generated/api";
import {
	type Exercise,
	getShippedExercise,
	mergeExerciseCatalog,
} from "@foundry/core/exercises";
import type { ConvexHttpClient } from "convex/browser";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { PaginationResult } from "convex/server";
import { useEffect, useMemo } from "react";

const PERSONAL_PAGE_SIZE = 100;

/** The shipped catalog plus every personal exercise, loading all pages. */
export function useExercises(): Exercise[] {
	const { results, status, loadMore } = usePaginatedQuery(
		api.exercises.listPersonal,
		{},
		{ initialNumItems: PERSONAL_PAGE_SIZE },
	);
	useEffect(() => {
		if (status === "CanLoadMore") loadMore(PERSONAL_PAGE_SIZE);
	}, [status, loadMore]);
	return useMemo(() => mergeExerciseCatalog(results), [results]);
}

/** `useExercises` for a one-shot server read. */
export async function loadExercises(
	client: ConvexHttpClient,
): Promise<Exercise[]> {
	const personal: Exercise[] = [];
	let cursor: string | null = null;
	for (;;) {
		const page: PaginationResult<Exercise> = await client.query(
			api.exercises.listPersonal,
			{
				paginationOpts: { numItems: PERSONAL_PAGE_SIZE, cursor },
			},
		);
		personal.push(...page.page);
		if (page.isDone) return mergeExerciseCatalog(personal);
		cursor = page.continueCursor;
	}
}

export function useExercise(id: string | undefined) {
	const local = id ? getShippedExercise(id) : undefined;
	const remote = useQuery(
		api.exercises.getById,
		id && !local ? { id } : "skip",
	);
	return local ?? remote;
}
