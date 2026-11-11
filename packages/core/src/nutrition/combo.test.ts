import { describe, expect, it } from "vitest";
import { isRuleError } from "../rules";
import { comboNutrients, normalizeCombo, normalizeComboDraft } from "./combo";
import {
	ABSENT,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	nutrientValue,
	TRACE,
} from "./nutrients";

const nutrients = (energy: number): Record<NutrientKey, NutrientValue> => ({
	...(Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, ABSENT])) as Record<
		NutrientKey,
		NutrientValue
	>),
	energy: nutrientValue(energy),
	salt: TRACE,
});

const shippedPart = {
	reference: { kind: "shipped", foodId: "shipped:apple" },
	snapshot: {
		name: { en: "Apple", nl: "Appel" },
		serving: { en: "Apple × 1", nl: "Appel × 1" },
		quantity: 1,
		amount: 150,
		baseUnit: "g",
		nutrients: nutrients(80),
		provenance: {
			source: "shipped",
			sourceId: "shipped:apple",
			dataset: "NEVO",
			edition: "2023",
			sourceCode: 1,
			sourceName: { en: "Apple", nl: "Appel" },
			saltDerived: false,
		},
	},
} as const;

const oneOffPart = {
	reference: { kind: "oneOff" },
	snapshot: {
		...shippedPart.snapshot,
		name: { en: "Coffee", nl: "Koffie" },
		estimated: true,
		nutrients: nutrients(5),
		provenance: { source: "oneOff" },
	},
} as const;

describe("Combo drafts", () => {
	it("accepts shipped, personal and one-off parts and trims the name", () => {
		const combo = normalizeComboDraft({
			name: " Breakfast ",
			parts: [shippedPart, oneOffPart],
		});
		expect(combo.name).toBe("Breakfast");
		expect(combo.parts[1].snapshot.estimated).toBe(true);
	});

	it("reports the field of the first broken rule", () => {
		const issue = (draft: unknown) => {
			try {
				normalizeComboDraft(draft);
				return undefined;
			} catch (error) {
				if (!isRuleError(error)) throw error;
				return { field: error.field, code: error.code };
			}
		};
		expect(issue({ name: "x".repeat(501), parts: [shippedPart] })).toEqual({
			field: "name",
			code: "tooLong",
		});
		expect(issue({ name: "Empty", parts: [] })).toEqual({
			field: "parts",
			code: "required",
		});
		expect(
			issue({
				name: "Nested",
				parts: [{ ...shippedPart, reference: { kind: "combo", foodId: "c" } }],
			}),
		).toEqual({ field: "parts.0.reference", code: "nested" });
		expect(
			issue({
				name: "Moved",
				parts: [
					{
						...shippedPart,
						reference: { kind: "shipped", foodId: "shipped:pear" },
					},
				],
			}),
		).toEqual({
			field: "parts.0.snapshot.provenance",
			code: "referenceMismatch",
		});
		expect(
			issue({
				name: "Negative",
				parts: [
					{
						...shippedPart,
						snapshot: { ...shippedPart.snapshot, nutrients: nutrients(-1) },
					},
				],
			}),
		).toEqual({ field: "parts.0.snapshot.nutrients.energy", code: "negative" });
		expect(
			issue({
				name: "Zero",
				parts: [
					{
						...shippedPart,
						snapshot: { ...shippedPart.snapshot, quantity: 0 },
					},
				],
			}),
		).toEqual({ field: "parts.0.snapshot.quantity", code: "notPositive" });
	});
});

describe("stored Combos", () => {
	const stored = {
		id: "combo-1",
		name: "Breakfast",
		parts: [{ id: "part-1", ...shippedPart }],
		createdAt: 1,
		updatedAt: 2,
	};

	it("needs part ids and timestamps that a draft may omit", () => {
		expect(normalizeCombo(stored).parts[0].id).toBe("part-1");
		expect(() => normalizeCombo({ ...stored, parts: [shippedPart] })).toThrow(
			expect.objectContaining({ field: "parts.0.id", code: "required" }),
		);
		expect(() => normalizeCombo({ ...stored, updatedAt: Number.NaN })).toThrow(
			expect.objectContaining({ field: "updatedAt", code: "invalid" }),
		);
	});

	it("totals its saved parts as one reading per nutrient", () => {
		const total = comboNutrients({
			parts: [shippedPart, oneOffPart],
		});
		expect(total.energy).toEqual({ kind: "value", amount: 85 });
		expect(total.salt).toEqual({ kind: "trace" });
		expect(total.fibre).toEqual({ kind: "absent" });
	});
});
