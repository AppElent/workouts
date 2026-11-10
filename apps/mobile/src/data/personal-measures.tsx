import type { PersonalMeasure } from "@foundry/core";
import { createContext, type ReactNode, use, useMemo, useState } from "react";
import { api } from "../convex/api";
import { usePaginatedQuery } from "../convex/query-cache";
import { useAccountWrite } from "./account-write";
import { useCachedAccountList } from "./cached-account-list";

type PersonalMeasuresState = {
	readonly measures: readonly PersonalMeasure[];
	readonly loading: boolean;
	/** The measure just created from a serving popup, to select once. */
	readonly lastCreatedId?: string;
	readonly markCreated: (measure: PersonalMeasure) => void;
	readonly consumeCreated: () => void;
};

const PersonalMeasuresContext = createContext<PersonalMeasuresState>({
	measures: [],
	loading: false,
	markCreated: () => undefined,
	consumeCreated: () => undefined,
});

export function PersonalMeasuresProvider({
	children,
}: {
	children: ReactNode;
}) {
	const { subject } = useAccountWrite();
	const page = usePaginatedQuery(
		api.personalMeasures.list,
		subject ? {} : "skip",
		{ initialNumItems: 100 },
	);
	const { items, loading, markCreated } = useCachedAccountList<PersonalMeasure>(
		subject ? "personal-measures" : undefined,
		page,
	);
	const [lastCreatedId, setLastCreatedId] = useState<string>();
	const value = useMemo<PersonalMeasuresState>(
		() => ({
			measures: items,
			loading: loading && items.length === 0,
			lastCreatedId,
			markCreated(measure) {
				markCreated(measure);
				setLastCreatedId(measure.id);
			},
			consumeCreated: () => setLastCreatedId(undefined),
		}),
		[items, lastCreatedId, loading, markCreated],
	);
	return (
		<PersonalMeasuresContext value={value}>{children}</PersonalMeasuresContext>
	);
}

export function usePersonalMeasures() {
	return use(PersonalMeasuresContext).measures;
}

export function usePersonalMeasureActions() {
	return use(PersonalMeasuresContext);
}
