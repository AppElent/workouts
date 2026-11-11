import type { MeasuredUnit, SupplementaryServing } from "@foundry/core";
import { useMutation } from "convex/react";
import { api } from "../convex/api";
import { usePaginatedQuery } from "../convex/query-cache";
import { useAccountWrite } from "./account-write";
import {
	useCachedAccountList,
	useCachedAccountLists,
} from "./cached-account-list";

const servingsKey = (foodId: string) => `supplementary-servings:${foodId}`;

/** A food's servings as last read this session, for decisions made at a tap. */
export function useCachedSupplementaryServings() {
	const cached = useCachedAccountLists();
	return (foodId: string) =>
		cached<SupplementaryServing>(servingsKey(foodId)) ?? [];
}

export function useSupplementaryServings(foodId?: string) {
	const account = useAccountWrite();
	const key = account.subject && foodId ? servingsKey(foodId) : undefined;
	const page = usePaginatedQuery(
		api.supplementaryServings.list,
		key && foodId ? { foodId } : "skip",
		{ initialNumItems: 100 },
	);
	const { items, loading, markCreated } = useCachedAccountList(key, page);
	const create = useMutation(api.supplementaryServings.create);
	return {
		servings: items,
		loading,
		async add(input: {
			name: string;
			amount: number;
			unit: MeasuredUnit;
		}): Promise<SupplementaryServing> {
			const serving = await account.send({
				identity: { kind: "supplementaryServing", foodId, ...input },
				prepare: () => {
					if (!foodId) throw new Error("A food is required.");
					return { ...input, foodId };
				},
				deliver: (args) => create(args),
			});
			markCreated(serving);
			return serving;
		},
	};
}
