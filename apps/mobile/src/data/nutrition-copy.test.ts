import { copyMealEntries, previousCalendarDay } from "./nutrition-copy";
import type { DiaryEntry } from "./nutrition-day";

const nutrients = {
	energy: { kind: "value", amount: 400 },
	protein: { kind: "value", amount: 20 },
	carbs: { kind: "value", amount: 50 },
	fat: { kind: "value", amount: 10 },
	saturatedFat: { kind: "value", amount: 3 },
	fibre: { kind: "value", amount: 8 },
	sugars: { kind: "value", amount: 12 },
	salt: { kind: "value", amount: 0.4 },
} as const;

function entry(id: string, comboGroup?: DiaryEntry["comboGroup"]): DiaryEntry {
	return {
		id,
		name: { en: `Food ${id}`, nl: `Eten ${id}` },
		serving: { en: "Bowl × 1", nl: "Kom × 1" },
		nutrients,
		quantity: 1,
		amount: 250,
		baseUnit: "g",
		provenance: {
			source: "shipped",
			sourceId: "food-1",
			dataset: "test",
			edition: "1",
			sourceCode: 1,
			sourceName: { en: "Food", nl: "Eten" },
			saltDerived: false,
		},
		comboGroup,
	};
}

describe("nutrition copy", () => {
	it("uses calendar arithmetic across month, year, and leap-day boundaries", () => {
		expect(previousCalendarDay("2026-01-01")).toBe("2025-12-31");
		expect(previousCalendarDay("2026-03-01")).toBe("2026-02-28");
		expect(previousCalendarDay("2024-03-01")).toBe("2024-02-29");
	});

	it("freezes snapshots, mints fresh ids, and preserves combo grouping", () => {
		const group = { id: "old-group", comboId: "combo-1", name: "Breakfast" };
		const copied = copyMealEntries(
			[entry("one", group), entry("two", group), entry("three")],
			"2026-09-12",
			"dinner",
			() => `new-${++nextId}`,
		);

		expect(copied.map((item) => item.clientEntryId)).toEqual([
			"new-2",
			"new-3",
			"new-4",
		]);
		expect(
			(copied[0] as (typeof copied)[number] & { comboGroup?: unknown })
				.comboGroup,
		).toEqual({
			id: "new-1",
			comboId: "combo-1",
			name: "Breakfast",
		});
		expect(
			(copied[1] as (typeof copied)[number] & { comboGroup?: unknown })
				.comboGroup,
		).toEqual(
			(copied[0] as (typeof copied)[number] & { comboGroup?: unknown })
				.comboGroup,
		);
		expect(
			(copied[2] as (typeof copied)[number] & { comboGroup?: unknown })
				.comboGroup,
		).toBeUndefined();
		expect(
			copied.every(
				(item) => item.date === "2026-09-12" && item.meal === "dinner",
			),
		).toBe(true);
		expect(copied[0]?.nutrients).toBe(nutrients);
	});
});

let nextId = 0;
