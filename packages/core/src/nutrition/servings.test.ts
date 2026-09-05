import { describe, expect, test } from "vitest";
import { getShippedFood, shippedLibrary } from "./library";
import { numericAmount } from "./nutrients";
import {
	formatQuantity,
	formatServingSelection,
	previewServing,
	scaleNutrients,
	servingAmount,
	servingOptions,
	servingVolumeMapping,
} from "./servings";
import type { ShippedFood } from "./types";

function food(id: string): ShippedFood {
	const found = getShippedFood(id);
	if (!found) throw new Error(`fixture missing: ${id}`);
	return found;
}

describe("the serving picker", () => {
	test("offers the authored servings first and the base unit last", () => {
		const options = servingOptions(food("shipped:wheat-bread-brown"));
		expect(options.map((option) => option.label.en)).toEqual([
			"Slice",
			"Two slices",
			"Gram (g)",
		]);
		expect(options.at(-1)?.kind).toBe("base-unit");
	});

	test("always offers the exact base unit, even for a food with no authored serving", () => {
		const raw = shippedLibrary().active.find((entry) => !entry.promoted);
		if (!raw) throw new Error("expected an unpromoted food");
		const options = servingOptions(raw);
		expect(options).toHaveLength(1);
		expect(options[0]).toMatchObject({ kind: "base-unit", amount: 1 });
	});

	test("names the base unit after the food's own basis", () => {
		const perMillilitre = shippedLibrary().active.find(
			(entry) => entry.baseUnit === "ml",
		);
		if (!perMillilitre) throw new Error("expected a per-100-ml food");
		expect(servingOptions(perMillilitre).at(-1)?.label.en).toBe(
			"Millilitre (ml)",
		);
	});
});

describe("expressing a selection", () => {
	test("reads as serving name times quantity", () => {
		const glass = servingOptions(food("shipped:milk-semi-skimmed"))[0];
		if (!glass) throw new Error("expected an authored serving");
		expect(formatServingSelection(glass, 1, "en")).toBe("Glass (200 ml) × 1");
		expect(formatServingSelection(glass, 2, "nl")).toBe("Glas (200 ml) × 2");
	});

	test("writes a fractional quantity the way the language does", () => {
		expect(formatQuantity(1.5, "en")).toBe("1.5");
		expect(formatQuantity(1.5, "nl")).toBe("1,5");
		expect(formatQuantity(2, "nl")).toBe("2");
	});

	test("works for the base unit as well as an authored serving", () => {
		const grams = servingOptions(food("shipped:banana")).at(-1);
		if (!grams) throw new Error("expected a base-unit option");
		expect(formatServingSelection(grams, 85, "en")).toBe("Gram (g) × 85");
	});
});

describe("scaling", () => {
	test("scales per-100 figures by the amount chosen", () => {
		const banana = food("shipped:banana");
		const perHundred = numericAmount(banana.nutrients.energy) ?? 0;
		const scaled = scaleNutrients(banana, 50);
		expect(numericAmount(scaled.energy)).toBeCloseTo(perHundred / 2, 10);
	});

	test("stores the unrounded figure and leaves rounding to the screen", () => {
		const bread = food("shipped:wheat-bread-brown");
		const scaled = scaleNutrients(bread, 35);
		const protein = numericAmount(scaled.protein) ?? 0;
		expect(Number.isInteger(protein * 100)).toBe(false);
	});

	test("keeps an absent nutrient absent however much is eaten", () => {
		const withAbsent = shippedLibrary().active.find(
			(entry) => entry.nutrients.fibre.kind === "absent",
		);
		if (!withAbsent) throw new Error("expected a food with no fibre figure");
		expect(scaleNutrients(withAbsent, 250).fibre).toEqual({ kind: "absent" });
	});

	test("keeps a trace a trace — the source never said how much", () => {
		const withTrace = shippedLibrary().active.find(
			(entry) => entry.nutrients.sodium.kind === "trace",
		);
		if (!withTrace) throw new Error("expected a food with a sodium trace");
		const scaled = scaleNutrients(withTrace, 300);
		expect(scaled.sodium).toEqual({ kind: "trace" });
		expect(scaled.salt).toEqual({ kind: "trace" });
	});

	test("multiplies a serving by the quantity chosen", () => {
		const slice = servingOptions(food("shipped:wheat-bread-brown"))[0];
		if (!slice) throw new Error("expected an authored serving");
		expect(servingAmount(slice, 3)).toBe(105);
	});
});

describe("previewing a serving", () => {
	test("returns the label, the amount and the scaled nutrients together", () => {
		const milk = food("shipped:milk-semi-skimmed");
		const glass = servingOptions(milk)[0];
		if (!glass) throw new Error("expected an authored serving");
		const preview = previewServing(milk, glass, 1, "nl");

		expect(preview.label).toBe("Glas (200 ml) × 1");
		expect(preview.amount).toBe(206);
		expect(preview.baseUnit).toBe("g");
		const perHundred = numericAmount(milk.nutrients.energy) ?? 0;
		expect(numericAmount(preview.nutrients.energy)).toBeCloseTo(
			perHundred * 2.06,
			10,
		);
	});
});

describe("beverages, which NEVO measures by mass", () => {
	test("maps a volume-labelled glass to a defensible gram amount", () => {
		const milk = food("shipped:milk-semi-skimmed");
		const mapping = servingVolumeMapping(
			milk.servings[0] ?? { label: { en: "", nl: "" }, amount: 0 },
		);
		expect(mapping).toMatchObject({
			volumeMl: 200,
			grams: 206,
			basis: "density",
		});
		expect(mapping?.note).toMatch(/1\.03/);
	});

	test("allows the documented 1 ml is 1 g fallback only for water-like drinks", () => {
		const water = food("shipped:water-av");
		for (const serving of water.servings) {
			expect(servingVolumeMapping(serving)).toMatchObject({
				basis: "one-to-one",
			});
			expect(serving.amount).toBe(serving.volumeMl);
		}
	});

	test("does not claim a volume mapping for a serving that is plainly a mass", () => {
		const slice = food("shipped:wheat-bread-brown").servings[0];
		if (!slice) throw new Error("expected an authored serving");
		expect(servingVolumeMapping(slice)).toBeUndefined();
	});

	test("scales a beer glass off the mass it stores, not the millilitres it names", () => {
		const beer = food("shipped:beer-pilsner");
		const glass = servingOptions(beer)[0];
		if (!glass) throw new Error("expected an authored serving");
		expect(servingAmount(glass, 1)).toBe(253);
		expect(formatServingSelection(glass, 1, "en")).toBe("Glass (250 ml) × 1");
	});
});
