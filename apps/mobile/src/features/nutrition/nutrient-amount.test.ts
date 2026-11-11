import { formatNutrientAmount, formatNutrientTotal } from "./nutrient-amount";

describe("nutrient amounts", () => {
	it("round per nutrient and use the language's digits", () => {
		expect(formatNutrientAmount("protein", 72.46, "nl", { unit: true })).toBe(
			"72,5 g",
		);
		expect(formatNutrientAmount("salt", 1.234, "en")).toBe("1.23");
		expect(formatNutrientAmount("energy", 2299.6, "en", { unit: true })).toBe(
			"2,300 kcal",
		);
	});

	it("mark totals that miss entries or include estimates", () => {
		expect(
			formatNutrientTotal(
				"fat",
				{ amount: 10, incomplete: true, qualified: false },
				"en",
			),
		).toBe("≥ 10");
		expect(
			formatNutrientTotal(
				"fat",
				{ amount: 10, incomplete: false, qualified: true },
				"en",
			),
		).toBe("~ 10");
	});
});
