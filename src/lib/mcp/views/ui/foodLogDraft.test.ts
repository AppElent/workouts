import { describe, expect, it } from "vitest";
import type { ReviewItem } from "../types";
import {
	changeItem,
	type DraftItem,
	itemMacros,
	logUnsaved,
	setRemoved,
	startDraft,
	sumMacros,
	unsaved,
} from "./foodLogDraft";

const macros = (energyKcal: number | null, proteinG: number | null = null) => ({
	energyKcal,
	proteinG,
	carbsG: null,
	fatG: null,
});

const ITEMS: ReviewItem[] = [
	{
		foodId: "shipped:banana",
		name: "Banana",
		servingIndex: 0,
		quantity: 2,
		servings: [
			{ servingIndex: 0, label: "1 medium", perQuantity: macros(105, 1.3) },
			{ servingIndex: 1, label: "g", perQuantity: macros(0.89, 0.011) },
		],
	},
	{
		foodId: "shipped:oats",
		name: "Oats",
		servingIndex: 0,
		quantity: 1,
		servings: [{ servingIndex: 0, label: "40 g", perQuantity: macros(150, 5) }],
	},
];

function keys() {
	let next = 0;
	return () => `key-${++next}`;
}

/** Applies logUnsaved's updates like the view's state setter. */
async function run(items: DraftItem[], fail: Set<string> = new Set()) {
	let current = items;
	const sent: string[] = [];
	await logUnsaved(
		items,
		async (item) => {
			sent.push(item.key);
			if (fail.has(item.foodId)) throw new Error("network");
			return { entryId: `entry-${item.key}` };
		},
		(row, change) => {
			current = current.map((item) =>
				item.row === row ? { ...item, ...change } : item,
			);
		},
	);
	return { items: current, sent };
}

describe("food log draft", () => {
	it("scales figures by quantity and sums the meal", () => {
		const draft = startDraft(ITEMS, keys());
		expect(itemMacros(draft[0])).toEqual(macros(210, 2.6));
		expect(sumMacros(draft.map(itemMacros))).toEqual(macros(360, 7.6));
	});

	it("keeps a key for retries and makes a new one when unsent input changes", async () => {
		const newKey = keys();
		const draft = startDraft(ITEMS, newKey);
		const first = await run(draft, new Set(["shipped:oats"]));
		expect(first.items.map((item) => item.status)).toEqual(["saved", "failed"]);

		const retry = await run(first.items);
		expect(retry.sent).toEqual([draft[1].key]);
		expect(retry.items.every((item) => item.status === "saved")).toBe(true);
		expect(unsaved(retry.items)).toEqual([]);

		const edited = changeItem(draft[1], { quantity: 2 }, newKey);
		expect(edited.key).not.toBe(draft[1].key);
		expect(changeItem(edited, { quantity: 2 }, newKey)).toBe(edited);

		// A failed write may have landed, so its key survives an edit.
		const editedAfterFailure = changeItem(
			first.items[1],
			{ quantity: 2 },
			newKey,
		);
		expect(editedAfterFailure).toMatchObject({
			key: draft[1].key,
			status: "pending",
		});
	});

	it("does not change or remove saved items, and skips removed ones", async () => {
		const draft = startDraft(ITEMS, keys());
		const withoutOats = [draft[0], setRemoved(draft[1], true)];
		const { items, sent } = await run(withoutOats);
		expect(sent).toEqual([draft[0].key]);
		expect(changeItem(items[0], { quantity: 5 }, keys())).toBe(items[0]);
		expect(setRemoved(items[0], true)).toBe(items[0]);
	});
});
