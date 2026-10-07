import { createContext, type ReactNode, use, useState } from "react";
import {
	completeOffSearchDraft,
	type FetchLike,
	lookupOffBarcode,
	type OffLookupOutcome,
	type OffSearchOutcome,
	searchOffProducts,
} from "./open-food-facts";
import { createOffRequestBudget } from "./open-food-facts-budget";
import {
	type OpenFoodFactsCache,
	openOpenFoodFactsCache,
	type PersonalFoodDraft,
} from "./personal-food-repository";

type OpenFoodFactsValue = {
	lookupBarcode(barcode: string): Promise<OffLookupOutcome>;
	refreshBarcode(barcode: string): Promise<OffLookupOutcome>;
	search(query: string): Promise<OffSearchOutcome>;
	/** A picked search result with what only its product page has. */
	complete(draft: PersonalFoodDraft): Promise<PersonalFoodDraft>;
	/** When the shared request budget opens again; `undefined` when it is open. */
	coolingUntil(): number | undefined;
};

const OpenFoodFactsContext = createContext<OpenFoodFactsValue | null>(null);

export function OpenFoodFactsProvider({
	children,
	cache: suppliedCache,
	fetchImpl,
	now,
}: {
	children: ReactNode;
	/** Injected in tests; production mounts open the shared on-device cache. */
	cache?: OpenFoodFactsCache;
	fetchImpl?: FetchLike;
	/** Injected in tests that walk the request budget's clock. */
	now?: () => number;
}) {
	const [cache] = useState<OpenFoodFactsCache>(
		() => suppliedCache ?? openOpenFoodFactsCache(),
	);
	const [value] = useState<OpenFoodFactsValue>(() => {
		// One budget per app session, shared by search and barcode lookups.
		const budget = createOffRequestBudget(now ? { now } : {});
		const client = {
			cache,
			fetchImpl: budget.wrap(
				fetchImpl ?? ((input, init) => globalThis.fetch(input, init)),
			),
		};
		return {
			lookupBarcode: (barcode) => lookupOffBarcode(barcode, client),
			refreshBarcode: (barcode) =>
				lookupOffBarcode(barcode, client, { fresh: true }),
			search: (query) => searchOffProducts(query, client),
			complete: (draft) => completeOffSearchDraft(draft, client),
			coolingUntil: budget.coolingUntil,
		};
	});

	return <OpenFoodFactsContext value={value}>{children}</OpenFoodFactsContext>;
}

export function useOpenFoodFacts(): OpenFoodFactsValue {
	const value = use(OpenFoodFactsContext);
	if (!value) {
		throw new Error(
			"useOpenFoodFacts must be used within <OpenFoodFactsProvider>",
		);
	}
	return value;
}
