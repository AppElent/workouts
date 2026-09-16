import type { PersonalMeasure } from "@workouts/core/nutrition";
import { usePaginatedQuery } from "convex/react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api } from "../convex/api";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "./nutrition-operation-service";

type PersonalMeasuresState = {
	measures: readonly PersonalMeasure[];
	loading: boolean;
	lastCreatedId?: string;
	markCreated: (measure: PersonalMeasure) => void;
	consumeCreated: () => void;
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
	const operations = useNutritionOperations();
	const [optimisticCreated, setOptimisticCreated] = useState<PersonalMeasure>();
	const [lastCreatedId, setLastCreatedId] = useState<string>();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const { results, status, loadMore } = usePaginatedQuery(
		api.personalMeasures.list,
		subject ? {} : "skip",
		{ initialNumItems: 100 },
	);

	useEffect(() => {
		if (status === "CanLoadMore") loadMore(100);
	}, [loadMore, status]);
	useEffect(() => {
		if (
			subject &&
			status === "Exhausted" &&
			(!optimisticCreated ||
				results.some((measure) => measure.id === optimisticCreated.id))
		) {
			operations.cachePersonalMeasures(subject, results);
		}
	}, [operations, optimisticCreated, results, status, subject]);
	useEffect(() => {
		if (
			optimisticCreated &&
			results.some((measure) => measure.id === optimisticCreated.id)
		) {
			setOptimisticCreated(undefined);
		}
	}, [optimisticCreated, results]);

	const measures = useMemo(() => {
		const available = subject
			? status === "Exhausted"
				? results
				: operations.getPersonalMeasures(subject)
			: [];
		return optimisticCreated &&
			!available.some((item) => item.id === optimisticCreated.id)
			? [...available, optimisticCreated]
			: available;
	}, [operations, optimisticCreated, results, status, subject]);
	const markCreated = useCallback((measure: PersonalMeasure) => {
		setOptimisticCreated(measure);
		setLastCreatedId(measure.id);
	}, []);
	const consumeCreated = useCallback(() => setLastCreatedId(undefined), []);
	const value = useMemo<PersonalMeasuresState>(
		() => ({
			measures,
			loading:
				Boolean(subject) &&
				status === "LoadingFirstPage" &&
				measures.length === 0,
			lastCreatedId,
			markCreated,
			consumeCreated,
		}),
		[consumeCreated, lastCreatedId, markCreated, measures, status, subject],
	);
	return (
		<PersonalMeasuresContext.Provider value={value}>
			{children}
		</PersonalMeasuresContext.Provider>
	);
}

export function usePersonalMeasures() {
	return useContext(PersonalMeasuresContext).measures;
}

export function usePersonalMeasureActions() {
	return useContext(PersonalMeasuresContext);
}
