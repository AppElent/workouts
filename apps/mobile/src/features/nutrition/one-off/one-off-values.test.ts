import { NUTRIENT_KEYS, type NutrientKey } from "@workouts/core/nutrition";
import type { NutrientInput } from "../use-nutrient-fields";
import { oneOffNutrients } from "./one-off-values";

function inputs(
	overrides: Partial<Record<NutrientKey, NutrientInput>>,
): Record<NutrientKey, NutrientInput> {
	return {
		...(Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, { kind: "absent", amount: "" }]),
		) as Record<NutrientKey, NutrientInput>),
		...overrides,
	};
}

describe("oneOffNutrients", () => {
	it("keeps values for the whole amount as they are", () => {
		const result = oneOffNutrients(
			inputs({
				energy: { kind: "value", amount: "820" },
				salt: { kind: "trace", amount: "" },
			}),
			{ basis: "total", amount: 1 },
		);
		expect(result?.energy).toEqual({ kind: "value", amount: 820 });
		expect(result?.salt).toEqual({ kind: "trace" });
		expect(result?.fibre).toEqual({ kind: "absent" });
	});

	it("turns per-100 values into totals without rounding", () => {
		const result = oneOffNutrients(
			inputs({ protein: { kind: "value", amount: "9,1" } }),
			{ basis: "per100", amount: 350 },
		);
		expect(result?.protein.kind).toBe("value");
		expect(
			result?.protein.kind === "value" ? result.protein.amount : 0,
		).toBeCloseTo(31.85, 10);
	});

	it("rejects a value that is not a number", () => {
		expect(
			oneOffNutrients(inputs({ fat: { kind: "value", amount: "abc" } }), {
				basis: "total",
				amount: 1,
			}),
		).toBeUndefined();
	});
});
