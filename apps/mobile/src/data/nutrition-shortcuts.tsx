import {
	type BaseUnit,
	canonicalJson,
	type MealSlot,
	type ServingOption,
} from "@foundry/core";
import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { reportError } from "../observability/errors";
import { useAccountWrite } from "./account-write";
import {
	type FoodShortcut,
	type FoodShortcutRepository,
	type FoodUse,
	openFoodShortcutRepository,
	type PortionMemory,
} from "./food-shortcut-repository";

export type { FoodShortcut, FoodUse, PortionMemory };

export type RememberedSelection = {
	readonly option: ServingOption;
	readonly quantity: number;
	readonly remembered: boolean;
	readonly reset: boolean;
};

export function foodSourceKey(
	kind: "shipped" | "personal",
	id: string,
): string {
	return `${kind}:${id}`;
}

/** The shortcut key of a saved combo, so it can be a favourite like a food. */
export function comboSourceKey(id: string): string {
	return `combo:${id}`;
}

export function servingKey(option: ServingOption): string {
	if (option.kind === "personal-measure" || option.kind === "supplementary") {
		return canonicalJson({ kind: option.kind, id: option.id });
	}
	return canonicalJson({
		kind: option.kind,
		amount: option.amount,
		label: option.label,
		...(option.kind === "authored" && option.volumeMl !== undefined
			? { volumeMl: option.volumeMl }
			: {}),
	});
}

export function portionMemoryFor(
	option: ServingOption,
	quantity: number,
	baseUnit: BaseUnit,
): PortionMemory {
	return {
		kind: option.kind,
		servingKey: servingKey(option),
		baseUnit,
		amount: option.amount,
		quantity,
		label: option.label,
	};
}

export function rememberedSelection(
	options: readonly ServingOption[],
	baseUnit: BaseUnit,
	memory: PortionMemory | undefined,
): RememberedSelection | undefined {
	if (!memory || memory.baseUnit !== baseUnit) return undefined;
	if (
		!Number.isFinite(memory.amount) ||
		memory.amount <= 0 ||
		!Number.isFinite(memory.quantity) ||
		memory.quantity <= 0
	) {
		return undefined;
	}
	const authored = options.find(
		(option) =>
			option.kind !== "base-unit" && servingKey(option) === memory.servingKey,
	);
	if (authored) {
		return {
			option: authored,
			quantity: memory.quantity,
			remembered: true,
			reset: false,
		};
	}
	const base = options.find(
		(option) => option.kind === "base-unit" && option.unit === baseUnit,
	);
	if (!base) return undefined;
	const totalAmount = memory.amount * memory.quantity;
	if (!Number.isFinite(totalAmount) || totalAmount <= 0) return undefined;
	return { option: base, quantity: totalAmount, remembered: true, reset: true };
}

/** What a Combo's + remembers: how many whole Combos were logged last time. */
export function comboPortion(quantity: number): PortionMemory {
	return {
		kind: "authored",
		servingKey: "combo",
		baseUnit: "serving",
		amount: 1,
		quantity,
		label: { en: "combo", nl: "combo" },
	};
}

type ShortcutStore = {
	readonly repository: FoodShortcutRepository;
	readonly subscribe: (listener: () => void) => () => void;
	readonly version: () => number;
	readonly changed: () => void;
};

const FoodShortcutsContext = createContext<ShortcutStore | null>(null);

export function FoodShortcutsProvider({
	children,
	repository: supplied,
}: {
	children: ReactNode;
	repository?: FoodShortcutRepository;
}) {
	const [repository] = useState(() => supplied ?? openFoodShortcutRepository());
	useEffect(
		() => () => {
			if (!supplied) repository.close();
		},
		[repository, supplied],
	);
	const store = useMemo<ShortcutStore>(() => {
		const listeners = new Set<() => void>();
		let version = 0;
		return {
			repository,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			version: () => version,
			changed: () => {
				version += 1;
				for (const listener of listeners) listener();
			},
		};
	}, [repository]);
	return <FoodShortcutsContext value={store}>{children}</FoodShortcutsContext>;
}

function useShortcutStore(): ShortcutStore {
	const store = use(FoodShortcutsContext);
	if (!store) throw new Error("FoodShortcutsProvider is missing.");
	return store;
}

/** Records a direct log as the food's shortcut; a failure never fails the log. */
export function useRecordFoodUse() {
	const store = useShortcutStore();
	return (subject: string, use: FoodUse, meal: MealSlot) => {
		try {
			store.repository.recordUse(subject, use, meal);
			store.changed();
		} catch (error) {
			reportError(error, "nutrition.shortcuts.record");
		}
	};
}

export type FoodShortcuts = {
	recent(meal?: MealSlot): FoodShortcut[];
	favorites(): FoodShortcut[];
	get(sourceKey: string): FoodShortcut | undefined;
	setFavorite(sourceKey: string, favorite: boolean): void;
	/** How many whole Combos its + logs: as many as last time, else one. */
	comboQuantity(comboId: string): number;
};

export function useFoodShortcuts(): FoodShortcuts {
	const store = useShortcutStore();
	const { subject } = useAccountWrite();
	const version = useSyncExternalStore(
		store.subscribe,
		store.version,
		store.version,
	);
	return useMemo(() => {
		void version;
		const { repository } = store;
		const get = (sourceKey: string) =>
			subject ? repository.get(subject, sourceKey) : undefined;
		return {
			recent: (meal) => (subject ? repository.listRecent(subject, meal) : []),
			favorites: () => (subject ? repository.listFavorites(subject) : []),
			get,
			setFavorite: (sourceKey, favorite) => {
				if (!subject) return;
				repository.setFavorite(subject, sourceKey, favorite);
				store.changed();
			},
			comboQuantity: (comboId) => {
				const quantity = get(comboSourceKey(comboId))?.portion?.quantity;
				return quantity && quantity > 0 ? quantity : 1;
			},
		};
	}, [store, subject, version]);
}
