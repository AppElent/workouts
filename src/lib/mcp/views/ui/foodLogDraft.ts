import type { Macros, ReviewItem } from "../types";

export type DraftStatus = "pending" | "saving" | "saved" | "failed";

/** One proposed diary entry as the user edits it in the view. */
export type DraftItem = ReviewItem & {
	/** Stable row identity for rendering. */
	row: number;
	/**
	 * The log_food idempotencyKey for this exact input. A retry reuses it, so
	 * a write that reached Foundry before its reply was lost is not repeated.
	 */
	key: string;
	removed: boolean;
	status: DraftStatus;
	entryId?: string;
};

export function startDraft(
	items: readonly ReviewItem[],
	newKey: () => string,
): DraftItem[] {
	return items.map((item, row) => ({
		...item,
		row,
		key: newKey(),
		removed: false,
		status: "pending",
	}));
}

/** A changed serving or quantity is a different write, so it gets a new key. */
export function changeItem(
	item: DraftItem,
	change: { servingIndex?: number; quantity?: number },
	newKey: () => string,
): DraftItem {
	if (item.status === "saved" || item.status === "saving") return item;
	const next = { ...item, ...change };
	if (
		next.servingIndex === item.servingIndex &&
		next.quantity === item.quantity
	)
		return item;
	return { ...next, key: newKey(), status: "pending" };
}

export function setRemoved(item: DraftItem, removed: boolean): DraftItem {
	if (item.status === "saved" || item.status === "saving") return item;
	return { ...item, removed };
}

export function itemMacros(item: ReviewItem): Macros {
	const serving = item.servings.find(
		(entry) => entry.servingIndex === item.servingIndex,
	);
	const scale = (value: number | null | undefined) =>
		value === null || value === undefined ? null : value * item.quantity;
	return {
		energyKcal: scale(serving?.perQuantity.energyKcal),
		proteinG: scale(serving?.perQuantity.proteinG),
		carbsG: scale(serving?.perQuantity.carbsG),
		fatG: scale(serving?.perQuantity.fatG),
	};
}

/** Sums figures; a macro stays null only when no part has a figure for it. */
export function sumMacros(parts: readonly Macros[]): Macros {
	const sum = (key: keyof Macros) => {
		const values = parts
			.map((part) => part[key])
			.filter((value): value is number => value !== null);
		return values.length ? values.reduce((a, b) => a + b, 0) : null;
	};
	return {
		energyKcal: sum("energyKcal"),
		proteinG: sum("proteinG"),
		carbsG: sum("carbsG"),
		fatG: sum("fatG"),
	};
}

/** Items the Log button still has to write. */
export function unsaved(items: readonly DraftItem[]) {
	return items.filter(
		(item) =>
			!item.removed && (item.status === "pending" || item.status === "failed"),
	);
}

export type LogFood = (item: DraftItem) => Promise<{ entryId: string }>;

/**
 * Writes each unsaved item in turn with its own key and reports every status
 * change. Saved items are never sent again.
 */
export async function logUnsaved(
	items: readonly DraftItem[],
	logFood: LogFood,
	update: (row: number, change: Partial<DraftItem>) => void,
) {
	for (const item of unsaved(items)) {
		update(item.row, { status: "saving" });
		try {
			const { entryId } = await logFood(item);
			update(item.row, { status: "saved", entryId });
		} catch {
			update(item.row, { status: "failed" });
		}
	}
}
