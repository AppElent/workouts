import type { SupplementaryServing } from "@workouts/core/nutrition";
import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
} from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../convex/api";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "./nutrition-operation-service";

/** Account/food scoped subscriptions; only complete pages replace the offline cache. */
export function useSupplementaryServings(foodId?: string) {
	const operations = useNutritionOperations();
	const version = useNutritionOperationVersion();
	const subject = operations.getSubject();
	const connected = useConvexConnectionState().isWebSocketConnected;
	const query = usePaginatedQuery(
		api.supplementaryServings.list,
		subject && foodId ? { foodId } : "skip",
		{ initialNumItems: 100 },
	);
	const create = useMutation(api.supplementaryServings.create);
	const [created, setCreated] = useState<{
		subject: string;
		serving: SupplementaryServing;
	}>();
	useEffect(() => {
		if (query.status === "CanLoadMore") query.loadMore(100);
	}, [query.status, query.loadMore]);
	const pending =
		created && created.subject === subject && created.serving.foodId === foodId
			? created.serving
			: undefined;
	useEffect(() => {
		if (
			subject &&
			foodId &&
			connected &&
			query.status === "Exhausted" &&
			(!pending || query.results.some((item) => item.id === pending.id))
		) {
			operations.cacheSupplementaryServings(subject, foodId, query.results);
			if (pending) setCreated(undefined);
		}
	}, [
		subject,
		foodId,
		connected,
		query.status,
		query.results,
		pending,
		operations,
	]);
	const cached = useMemo(() => {
		void version;
		return subject && foodId
			? operations.getSupplementaryServings(subject, foodId)
			: [];
	}, [subject, foodId, operations, version]);
	const available =
		subject && foodId
			? connected && query.status === "Exhausted"
				? query.results
				: cached
			: cached;
	const servings = useMemo(
		() =>
			pending && !available.some((item) => item.id === pending.id)
				? [...available, pending]
				: available,
		[available, pending],
	);
	return {
		servings,
		loading:
			Boolean(foodId && subject) &&
			query.status === "LoadingFirstPage" &&
			cached.length === 0,
		async add(input: { name: string; amount: number; unit: "g" | "ml" }) {
			if (!subject || !foodId || !connected) throw new Error("offline");
			const serving = await create({ ...input, foodId });
			// An account switch while the request was pending must not expose the result.
			if (operations.getSubject() === subject) {
				operations.cacheSupplementaryServings(subject, foodId, [
					...servings.filter((item) => item.id !== serving.id),
					serving,
				]);
				setCreated({ subject, serving });
			}
			return serving;
		},
	};
}
