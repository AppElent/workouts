import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useMemo,
	useState,
} from "react";
import {
	type Combo,
	type ComboDraft,
	openPersonalFoodRepository,
	type PersonalFood,
	type PersonalFoodDraft,
	type PersonalFoodRepository,
} from "./personal-food-repository";

type PersonalFoodsValue = {
	revision: number;
	list(): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	search(query: string, locale: "en" | "nl"): PersonalFood[];
	create(draft: PersonalFoodDraft): PersonalFood;
	update(id: string, draft: PersonalFoodDraft): PersonalFood;
	remove(id: string): boolean;
	listCombos(): Combo[];
	findCombo(id: string): Combo | undefined;
	createCombo(draft: ComboDraft): Combo;
	updateCombo(id: string, draft: ComboDraft): Combo;
	removeCombo(id: string): boolean;
};

const PersonalFoodsContext = createContext<PersonalFoodsValue | null>(null);

export function PersonalFoodsProvider({
	children,
	repository: suppliedRepository,
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
}) {
	const [repository] = useState(
		() => suppliedRepository ?? openPersonalFoodRepository(),
	);
	const [revision, setRevision] = useState(0);
	const changed = useCallback(() => setRevision((value) => value + 1), []);

	const value = useMemo<PersonalFoodsValue>(
		() => ({
			revision,
			list: () => repository.list(),
			find: (id) => repository.find(id),
			search: (query, locale) => repository.search(query, locale),
			create: (draft) => {
				const food = repository.create(draft);
				changed();
				return food;
			},
			update: (id, draft) => {
				const food = repository.update(id, draft);
				changed();
				return food;
			},
			remove: (id) => {
				const removed = repository.remove(id);
				if (removed) changed();
				return removed;
			},
			listCombos: () => repository.listCombos(),
			findCombo: (id) => repository.findCombo(id),
			createCombo: (draft) => {
				const combo = repository.createCombo(draft);
				changed();
				return combo;
			},
			updateCombo: (id, draft) => {
				const combo = repository.updateCombo(id, draft);
				changed();
				return combo;
			},
			removeCombo: (id) => {
				const removed = repository.removeCombo(id);
				if (removed) changed();
				return removed;
			},
		}),
		[changed, repository, revision],
	);

	return <PersonalFoodsContext value={value}>{children}</PersonalFoodsContext>;
}

export function usePersonalFoods(): PersonalFoodsValue {
	const value = use(PersonalFoodsContext);
	if (!value) {
		throw new Error(
			"usePersonalFoods must be used within <PersonalFoodsProvider>",
		);
	}
	return value;
}
