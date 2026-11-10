import { describe, expect, it } from "vitest";
import { totalNutrients } from "./aggregate";
import { ABSENT, nutrientValue, TRACE } from "./nutrients";
import { weekAverage } from "./week";

function day(date: string, energies: Parameters<typeof nutrientValue>[0][]) {
	return {
		date,
		entryCount: energies.length,
		totals: totalNutrients(
			energies.map((amount) => ({
				nutrients: { energy: nutrientValue(amount) },
			})),
		),
	};
}

describe("weekAverage", () => {
	it("averages logged, complete days up to and including today", () => {
		const days = [
			day("2026-11-02", [2000]),
			day("2026-11-03", []),
			day("2026-11-04", [1500, 300]),
			day("2026-11-05", [900]),
		];
		expect(weekAverage(days, "energy", "2026-11-04")).toEqual({
			value: 1900,
			days: 2,
			qualified: false,
		});
	});

	it("leaves out a day with a missing figure and qualifies one with a trace", () => {
		const incomplete = {
			date: "2026-11-02",
			entryCount: 1,
			totals: totalNutrients([{ nutrients: { energy: ABSENT } }]),
		};
		const traced = {
			date: "2026-11-03",
			entryCount: 2,
			totals: totalNutrients([
				{ nutrients: { energy: nutrientValue(1000) } },
				{ nutrients: { energy: TRACE } },
			]),
		};
		expect(weekAverage([incomplete, traced], "energy", "2026-11-08")).toEqual({
			value: 1000,
			days: 1,
			qualified: true,
		});
	});

	it("has no average when no day counts", () => {
		expect(weekAverage([day("2026-11-02", [])], "energy", "2026-11-08")).toBe(
			undefined,
		);
	});
});
