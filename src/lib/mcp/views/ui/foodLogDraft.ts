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
	/**
	 * A write was sent with this key, so it may have reached Foundry. Never
	 * reset: the key must outlive every later edit.
	 */
	attempted: boolean;
	/**
	 * Foundry already holds a write with this key but other input, so this
	 * item cannot be saved as edited. Cleared by the next edit.
	 */
	conflict?: boolean;
	entryId?: string;
};

/** The one amount range log_food accepts. */
export const MAX_QUANTITY = 10000;

/** The quantity a field's text stands for, or null when it is not a valid one. */
export function parseQuantity(text: string): number | null {
	if (text.trim() === "") return null;
	const value = Number(text);
	return Number.isFinite(value) && value > 0 && value <= MAX_QUANTITY
		? value
		: null;
}

/** log_food refused a key it already holds with other input. */
export class FoodConflictError extends Error {}

/**
 * Keys come from the review, not from chance: the host may send the same
 * result again (a reloaded view), and a fresh random key would log the same
 * items a second time.
 */
export function startDraft(
	items: readonly ReviewItem[],
	reviewId: string,
): DraftItem[] {
	return items.map((item, row) => ({
		...item,
		row,
		key: `${reviewId}:${row}`,
		removed: false,
		status: "pending",
		attempted: false,
	}));
}

/**
 * A changed serving or quantity is a different write, so it gets a new key,
 * unless a write was already sent with it: that write may have reached
 * Foundry, and the old key makes log_food reject the changed input instead of
 * logging twice.
 */
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
	const key = item.attempted ? item.key : newKey();
	return { ...next, key, status: "pending", conflict: undefined };
}

export function setRemoved(item: DraftItem, removed: boolean): DraftItem {
	if (item.status === "saved" || item.status === "saving") return item;
	return { ...item, removed };
}

/**
 * Once something is saved, what the user left out stays out: the model has
 * been told what was logged, and putting a dropped item back would log
 * something the user had decided against.
 */
export function removalsFinal(items: readonly DraftItem[]) {
	return items.some((item) => item.status === "saved");
}

function label(item: DraftItem) {
	const serving = item.servings.find(
		(entry) => entry.servingIndex === item.servingIndex,
	);
	return `${item.quantity} × ${serving?.label.en ?? "serving"} ${item.name.en}`;
}

/**
 * Tells the model everything saved so far. updateModelContext replaces what
 * the view said before, so a later save must repeat the earlier ones.
 */
export function savedContext(
	items: readonly DraftItem[],
	meal: string,
	date: string,
) {
	const saved = items.filter((item) => item.status === "saved");
	return `From the review_food_log view the user logged ${saved.length} item(s) to ${meal} on ${date}: ${saved.map(label).join("; ")}. They are saved in Foundry; do not log them again.`;
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
		update(item.row, { status: "saving", attempted: true });
		try {
			const { entryId } = await logFood(item);
			update(item.row, { status: "saved", entryId, conflict: false });
		} catch (error) {
			update(item.row, {
				status: "failed",
				conflict: error instanceof FoodConflictError,
			});
		}
	}
}

/**
 * The row an app tool means by a food ID: the first one the user can still
 * change, else the first with that food, so the answer can say why not.
 */
export function findItem(items: readonly DraftItem[], foodId: string) {
	const matches = items.filter((item) => item.foodId === foodId);
	return (
		matches.find(
			(item) =>
				!item.removed && item.status !== "saved" && item.status !== "saving",
		) ?? matches[0]
	);
}

/**
 * A food an app tool added. It gets a fresh key: a reloaded view drops it (the
 * host sends the original result), so no other write can share that key.
 */
export function addItem(
	items: readonly DraftItem[],
	item: ReviewItem,
	key: string,
): DraftItem[] {
	const row = items.reduce((max, entry) => Math.max(max, entry.row), -1) + 1;
	return [
		...items,
		{
			...item,
			row,
			key,
			removed: false,
			status: "pending",
			attempted: false,
		},
	];
}

/** What Claude reads after an app tool changed the review. */
export function draftText(items: readonly DraftItem[]) {
	const kept = items.filter((item) => !item.removed);
	if (kept.length === 0) return "The review has no items left.";
	const kcal = sumMacros(kept.map(itemMacros)).energyKcal;
	const lines = kept.map(
		(item) =>
			`${label(item)} (${item.foodId}${item.status === "saved" ? ", logged" : ""})`,
	);
	return `The review now holds ${kept.length} item(s): ${lines.join("; ")}. Meal ${kcal === null ? "has no kcal figure" : `${Math.round(kcal)} kcal`}. Nothing new is logged until the user presses Log.`;
}
