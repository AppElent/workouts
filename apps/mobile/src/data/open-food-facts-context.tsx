import { createContext, type ReactNode, use, useState } from "react";
import {
	type FetchLike,
	lookupOffBarcode,
	type OffLookupOutcome,
	type OffSearchOutcome,
	searchOffProducts,
} from "./open-food-facts";
import {
	type OpenFoodFactsCache,
	openOpenFoodFactsCache,
} from "./personal-food-repository";

type OpenFoodFactsValue = {
	lookupBarcode(barcode: string): Promise<OffLookupOutcome>;
	search(query: string): Promise<OffSearchOutcome>;
};

const OpenFoodFactsContext = createContext<OpenFoodFactsValue | null>(null);

export function OpenFoodFactsProvider({
	children,
	cache: suppliedCache,
	fetchImpl,
}: {
	children: ReactNode;
	/** Injected in tests; production mounts open the shared on-device cache. */
	cache?: OpenFoodFactsCache;
	fetchImpl?: FetchLike;
}) {
	const [cache] = useState<OpenFoodFactsCache>(
		() => suppliedCache ?? openOpenFoodFactsCache(),
	);
	const [value] = useState<OpenFoodFactsValue>(() => ({
		lookupBarcode: (barcode) => lookupOffBarcode(barcode, { cache, fetchImpl }),
		search: (query) => searchOffProducts(query, { cache, fetchImpl }),
	}));

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
