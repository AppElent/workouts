import type { ServingOption } from "@workouts/core/nutrition";
import {
	portionMemoryFor,
	rememberedSelection,
	servingKey,
} from "./nutrition-shortcuts";

const authored = (label: string, amount: number): ServingOption => ({
	kind: "authored",
	index: 0,
	label: { en: label, nl: label },
	amount,
});

const base: ServingOption = {
	kind: "base-unit",
	label: { en: "Gram (g)", nl: "Gram (g)" },
	amount: 1,
	unit: "g",
};

describe("nutrition portion memory", () => {
	it("remembers servings without converting them to a weight", () => {
		const serving: ServingOption = {
			kind: "base-unit",
			label: { en: "Bowl", nl: "Kom" },
			amount: 1,
			unit: "serving",
		};
		const memory = portionMemoryFor(serving, 1.5, "serving");
		expect(rememberedSelection([serving], "serving", memory)).toMatchObject({
			quantity: 1.5,
			option: serving,
		});
		expect(rememberedSelection([base], "g", memory)).toBeUndefined();
	});
	it("matches an authored serving by semantic identity, not its array index", () => {
		const remembered = portionMemoryFor(authored("Scoop", 30), 2, "g");
		const reordered = [
			{ ...authored("Bowl", 100), index: 4 },
			{ ...authored("Scoop", 30), index: 1 },
			base,
		];
		expect(rememberedSelection(reordered, "g", remembered)).toMatchObject({
			option: { kind: "authored", index: 1 },
			quantity: 2,
			remembered: true,
			reset: false,
		});
	});

	it("falls back to the matching base unit using the remembered total amount", () => {
		const remembered = portionMemoryFor(authored("Scoop", 30), 2, "g");
		const result = rememberedSelection([base], "g", remembered);
		expect(result).toMatchObject({ option: base, quantity: 60, reset: true });
	});

	it("remembers a Personal Measure by stable id after it is edited", () => {
		const original: ServingOption = {
			kind: "personal-measure",
			id: "glass",
			label: { en: "Glass (250 ml)", nl: "Glas (250 ml)" },
			amount: 250,
			unit: "ml",
		};
		const edited: ServingOption = {
			...original,
			label: { en: "Big glass (450 ml)", nl: "Groot glas (450 ml)" },
			amount: 450,
		};
		const mlBase: ServingOption = {
			kind: "base-unit",
			label: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
			amount: 1,
			unit: "ml",
		};

		expect(
			rememberedSelection(
				[edited, mlBase],
				"ml",
				portionMemoryFor(original, 2, "ml"),
			),
		).toMatchObject({ option: edited, quantity: 2, reset: false });
	});

	it("falls back to the exact remembered total when a Personal Measure is deleted", () => {
		const measure: ServingOption = {
			kind: "personal-measure",
			id: "glass",
			label: { en: "Glass (250 ml)", nl: "Glas (250 ml)" },
			amount: 250,
			unit: "ml",
		};
		const mlBase: ServingOption = {
			kind: "base-unit",
			label: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
			amount: 1,
			unit: "ml",
		};

		expect(
			rememberedSelection([mlBase], "ml", portionMemoryFor(measure, 1.5, "ml")),
		).toMatchObject({ option: mlBase, quantity: 375, reset: true });
	});

	it("does not translate a remembered amount across a mismatched base unit", () => {
		const remembered = portionMemoryFor(authored("Glass", 200), 1, "ml");
		expect(rememberedSelection([base], "g", remembered)).toBeUndefined();
		expect(servingKey(authored("Scoop", 30))).not.toBe(
			servingKey(authored("Bowl", 30)),
		);
	});
});
