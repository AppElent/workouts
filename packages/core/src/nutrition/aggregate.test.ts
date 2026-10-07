import { describe, expect, it } from "vitest";
import { combinedNutrients } from "./aggregate";
import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "./nutrients";

function values(
	overrides: Partial<Record<NutrientKey, NutrientValue>>,
): Record<NutrientKey, NutrientValue> {
	return {
		...(Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
		) as Record<NutrientKey, NutrientValue>),
		...overrides,
	};
}

describe("combinedNutrients", () => {
	it("adds known values, keeps a trace-only sum a trace, and unknowns absent", () => {
		const combined = combinedNutrients([
			values({
				energy: { kind: "value", amount: 100 },
				fibre: { kind: "trace" },
			}),
			values({
				energy: { kind: "value", amount: 50 },
				salt: { kind: "trace" },
			}),
		]);
		expect(combined.energy).toEqual({ kind: "value", amount: 150 });
		expect(combined.fibre).toEqual({ kind: "trace" });
		expect(combined.fat).toEqual({ kind: "absent" });
	});

	it("is all absent for nothing", () => {
		expect(combinedNutrients([]).energy).toEqual({ kind: "absent" });
	});
});
