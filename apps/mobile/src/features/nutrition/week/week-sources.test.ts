import type { NutrientKey, NutrientValue } from "@workouts/core/nutrition";
import { NUTRIENT_KEYS } from "@workouts/core/nutrition";
import { groupWeekSources } from "./week-sources";

function entry(
	id: string,
	date: string,
	name: string,
	fat: number | "absent",
	sourceId = name,
) {
	const nutrients = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
	) as Record<NutrientKey, NutrientValue>;
	nutrients.fat =
		fat === "absent" ? { kind: "absent" } : { kind: "value", amount: fat };
	return {
		id,
		date,
		meal: "dinner" as const,
		name: { en: name, nl: name },
		nutrients,
		provenance: { source: "personal", sourceId },
	};
}

describe("groupWeekSources", () => {
	it("adds up one food across days and ranks foods by amount", () => {
		const result = groupWeekSources(
			[
				entry("a", "2026-09-29", "Lasagne", 34),
				entry("b", "2026-10-01", "Lasagne", 34),
				entry("c", "2026-09-28", "Salad", 48),
				entry("d", "2026-09-30", "Bread", "absent"),
			],
			"fat",
		);
		expect(result.total).toBe(116);
		expect(result.ranked.map((item) => [item.name.en, item.amount])).toEqual([
			["Lasagne", 68],
			["Salad", 48],
		]);
		expect(result.ranked[0].entries.map((item) => item.date)).toEqual([
			"2026-09-29",
			"2026-10-01",
		]);
		expect(result.ranked[0].share).toBeCloseTo(68 / 116);
		expect(result.missingByDate).toEqual({ "2026-09-30": 1 });
	});
});
