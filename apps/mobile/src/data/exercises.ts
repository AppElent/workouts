import {
	getShippedExercise,
	mergeExerciseCatalog,
} from "@workouts/core/exercises";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "../convex/api";

export function useExercises() {
	const { results, status, loadMore } = usePaginatedQuery(
		api.exercises.listPersonal,
		{},
		{ initialNumItems: 100 },
	);
	useEffect(() => {
		if (status === "CanLoadMore") loadMore(100);
	}, [status, loadMore]);
	return useMemo(() => mergeExerciseCatalog(results), [results]);
}

export function useExercise(id: string | undefined) {
	const local = id ? getShippedExercise(id) : undefined;
	const remote = useQuery(
		api.exercises.getById,
		id && !local ? { id } : "skip",
	);
	return local ?? remote;
}
