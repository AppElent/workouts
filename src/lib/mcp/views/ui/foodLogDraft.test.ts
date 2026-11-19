import { describe, expect, it } from "vitest";
import type { ReviewItem } from "../types";
import {
	changeItem,
	type DraftItem,
	FoodConflictError,
	itemMacros,
	logUnsaved,
	parseQuantity,
	removalsFinal,
	savedContext,
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
		name: { en: "Banana", nl: "Banaan" },
		servingIndex: 0,
		quantity: 2,
		servings: [
			{
				servingIndex: 0,
				label: { en: "1 medium", nl: "1 middel" },
				perQuantity: macros(105, 1.3),
			},
			{
				servingIndex: 1,
				label: { en: "g", nl: "g" },
				perQuantity: macros(0.89, 0.011),
			},
		],
	},
	{
		foodId: "shipped:oats",
		name: { en: "Oats", nl: "Havermout" },
		servingIndex: 0,
		quantity: 1,
		servings: [
			{
				servingIndex: 0,
				label: { en: "40 g", nl: "40 g" },
				perQuantity: macros(150, 5),
			},
		],
	},
];

function keys() {
	let next = 0;
	return () => `key-${++next}`;
}

/** Applies logUnsaved's updates like the view's state setter. */
async function run(
	items: DraftItem[],
	fail: Set<string> = new Set(),
	conflict: Set<string> = new Set(),
) {
	let current = items;
	const sent: string[] = [];
	await logUnsaved(
		items,
		async (item) => {
			sent.push(item.key);
			if (conflict.has(item.foodId)) throw new FoodConflictError("conflict");
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
		const draft = startDraft(ITEMS, "review-1");
		expect(itemMacros(draft[0])).toEqual(macros(210, 2.6));
		expect(sumMacros(draft.map(itemMacros))).toEqual(macros(360, 7.6));
	});

	it("keeps a key for retries and makes a new one when unsent input changes", async () => {
		const newKey = keys();
		const draft = startDraft(ITEMS, "review-1");
		const first = await run(draft, new Set(["shipped:oats"]));
		expect(first.items.map((item) => item.status)).toEqual(["saved", "failed"]);

		const retry = await run(first.items);
		expect(retry.sent).toEqual([draft[1].key]);
		expect(retry.items.every((item) => item.status === "saved")).toBe(true);
		expect(unsaved(retry.items)).toEqual([]);

		const edited = changeItem(draft[1], { quantity: 2 }, newKey);
		expect(edited.key).not.toBe(draft[1].key);
		expect(changeItem(edited, { quantity: 2 }, newKey)).toBe(edited);

		// A failed write may have landed, so its key survives every later edit.
		const once = changeItem(first.items[1], { quantity: 2 }, newKey);
		const twice = changeItem(once, { quantity: 20 }, newKey);
		const thrice = changeItem(twice, { quantity: 3 }, newKey);
		for (const item of [once, twice, thrice])
			expect(item).toMatchObject({ key: draft[1].key, status: "pending" });
	});

	it("does not change or remove saved items, and skips removed ones", async () => {
		const draft = startDraft(ITEMS, "review-1");
		const withoutOats = [draft[0], setRemoved(draft[1], true)];
		const { items, sent } = await run(withoutOats);
		expect(sent).toEqual([draft[0].key]);
		expect(changeItem(items[0], { quantity: 5 }, keys())).toBe(items[0]);
		expect(setRemoved(items[0], true)).toBe(items[0]);
	});

	it("derives keys from the review, so a reloaded view reuses them", () => {
		const first = startDraft(ITEMS, "review-1");
		expect(startDraft(ITEMS, "review-1").map((item) => item.key)).toEqual(
			first.map((item) => item.key),
		);
		expect(new Set(first.map((item) => item.key)).size).toBe(2);
		expect(startDraft(ITEMS, "review-2")[0].key).not.toBe(first[0].key);
	});

	it("flags a conflict and clears it on the next edit", async () => {
		const draft = startDraft(ITEMS, "review-1");
		const { items } = await run(draft, new Set(), new Set(["shipped:oats"]));
		expect(items[1]).toMatchObject({ status: "failed", conflict: true });
		const retried = await run(items, new Set(["shipped:oats"]));
		expect(retried.items[1]).toMatchObject({
			status: "failed",
			conflict: false,
		});
		expect(changeItem(items[1], { quantity: 3 }, keys()).conflict).toBe(
			undefined,
		);
	});

	it("tells the model every saved item, not just the latest save", async () => {
		const draft = startDraft(ITEMS, "review-1");
		const first = await run(draft, new Set(["shipped:oats"]));
		expect(savedContext(first.items, "dinner", "2026-11-19")).toBe(
			"From the review_food_log view the user logged 1 item(s) to dinner on 2026-11-19: 2 × 1 medium Banana. They are saved in Foundry; do not log them again.",
		);
		const second = await run(first.items);
		const text = savedContext(second.items, "dinner", "2026-11-19");
		expect(text).toContain("logged 2 item(s)");
		expect(text).toContain("2 × 1 medium Banana; 1 × 40 g Oats");
	});

	it("keeps removals final once something is saved", async () => {
		const draft = startDraft(ITEMS, "review-1");
		expect(removalsFinal(draft)).toBe(false);
		const { items } = await run([draft[0], setRemoved(draft[1], true)]);
		expect(removalsFinal(items)).toBe(true);
	});

	it("accepts only amounts log_food accepts", () => {
		expect(parseQuantity("2.5")).toBe(2.5);
		expect(parseQuantity("10000")).toBe(10000);
		for (const text of ["", " ", "0", "-1", "10001", "abc", "Infinity"])
			expect(parseQuantity(text)).toBeNull();
	});
});
