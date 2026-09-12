import { totalNutrients } from "@workouts/core/nutrition";
import {
	averageKnownNutrient,
	reviewCoverage,
	weekDates,
	weekStartMonday,
} from "./nutrition-weekly-review";

const known = (energy: number, protein: number) => ({
	energy: { kind: "value" as const, amount: energy },
	protein: { kind: "value" as const, amount: protein },
	carbs: { kind: "value" as const, amount: 0 },
	fat: { kind: "value" as const, amount: 0 },
	saturatedFat: { kind: "value" as const, amount: 0 },
	fibre: { kind: "value" as const, amount: 0 },
	sugars: { kind: "value" as const, amount: 0 },
	salt: { kind: "value" as const, amount: 0 },
});

describe("weekly review helpers", () => {
	it("builds a Monday-to-Sunday week from any selected date", () => {
		expect(weekStartMonday("2026-09-13")).toBe("2026-09-07");
		expect(weekDates("2026-09-07")).toEqual([
			"2026-09-07",
			"2026-09-08",
			"2026-09-09",
			"2026-09-10",
			"2026-09-11",
			"2026-09-12",
			"2026-09-13",
		]);
	});

	it("counts logged coverage and marked-complete days independently", () => {
		const days = [
			{
				date: "2026-09-07",
				entries: [],
				totals: totalNutrients([]),
				markedComplete: true,
			},
			{
				date: "2026-09-08",
				entries: [{ nutrients: known(100, 10) }],
				totals: totalNutrients([known(100, 10)]),
				markedComplete: false,
			},
			{
				date: "2026-09-09",
				entries: [],
				totals: totalNutrients([]),
				markedComplete: false,
			},
		];
		expect(reviewCoverage(days)).toEqual({
			loggedDayCount: 1,
			markedCompleteCount: 1,
		});
	});

	it("averages only days with entries and complete known values", () => {
		const complete = {
			date: "2026-09-07",
			entries: [{ nutrients: known(100, 10) }],
			totals: totalNutrients([known(100, 10)]),
			markedComplete: false,
		};
		const incomplete = {
			date: "2026-09-08",
			entries: [
				{
					nutrients: { ...known(200, 20), energy: { kind: "absent" as const } },
				},
			],
			totals: totalNutrients([
				{ ...known(200, 20), energy: { kind: "absent" as const } },
			]),
			markedComplete: false,
		};
		const empty = {
			date: "2026-09-09",
			entries: [],
			totals: totalNutrients([]),
			markedComplete: false,
		};
		expect(
			averageKnownNutrient([complete, incomplete, empty], "energy"),
		).toEqual({ average: 100, dayCount: 1 });
		expect(
			averageKnownNutrient([complete, incomplete, empty], "protein"),
		).toEqual({ average: 15, dayCount: 2 });
	});
});
