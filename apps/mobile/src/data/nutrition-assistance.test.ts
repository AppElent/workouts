import { totalNutrients } from "@workouts/core/nutrition";
import {
	type AssistanceFood,
	allAssistanceRowsSelected,
	assistanceInputError,
	buildAssistanceBatchEntries,
	buildAssistanceFoodCatalog,
	editableLabelNutrients,
	nutrientsFromLabelInputs,
	parseNutritionLabel,
	parseTextAssistedLog,
	personalFoodDraftFromLabel,
	selectAssistanceFood,
} from "./nutrition-assistance";

const food = (
	id: string,
	name: string,
	baseUnit: "g" | "ml" = "g",
): AssistanceFood => ({
	id,
	kind: "personal",
	name: { en: name, nl: name },
	baseUnit,
	nutrients: {
		energy: { kind: "value", amount: 100 },
		protein: { kind: "value", amount: 10 },
		carbs: { kind: "value", amount: 20 },
		fat: { kind: "absent" },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "absent" },
		sugars: { kind: "absent" },
		salt: { kind: "absent" },
	},
	provenance: {
		source: "personal",
		sourceId: id,
		nutritionSource: "manual",
		locallyEdited: true,
	},
});

describe("text assistance and label review helpers", () => {
	it("requires explicit g/ml quantities and handles Dutch decimal commas", () => {
		const rows = parseTextAssistedLog(
			"250,5 g yoghurt, 1 banana",
			[food("yoghurt", "yoghurt"), food("banana", "banana")],
			"nl",
		);
		expect(rows[0]).toMatchObject({
			quantity: 250.5,
			unit: "g",
			status: "needs-selection",
		});
		expect(rows[1]).toMatchObject({
			status: "unresolved",
			error: "unsupported-quantity",
		});
	});

	it("never accepts the first match without an explicit selection", () => {
		const rows = parseTextAssistedLog(
			"100 g yoghurt",
			[food("one", "yoghurt"), food("two", "yoghurt")],
			"en",
		);
		const row = rows[0];
		expect(row?.status).toBe("ambiguous");
		expect(row?.selectedCandidateId).toBeUndefined();
		expect(allAssistanceRowsSelected(rows)).toBe(false);
		const selected = row && selectAssistanceFood(row, "two");
		expect(selected).toMatchObject({
			status: "selected",
			selectedCandidateId: "two",
		});
	});

	it("keeps unsupported unit matches unresolved", () => {
		const row = parseTextAssistedLog(
			"200 ml milk",
			[food("milk", "milk", "g")],
			"en",
		)[0];
		expect(row).toMatchObject({ status: "needs-selection" });
		const selected = row && selectAssistanceFood(row, "milk");
		expect(selected).toMatchObject({
			status: "unresolved",
			error: "unit-mismatch",
		});
	});

	it("requires selection before creating a createBatch payload", () => {
		const catalog = [food("oats", "oats")];
		const initial = parseTextAssistedLog("30 g oats", catalog, "en")[0];
		expect(initial).toBeDefined();
		if (!initial) return;
		expect(() =>
			buildAssistanceBatchEntries(
				[initial],
				"2026-09-12",
				"breakfast",
				() => "entry",
			),
		).toThrow("explicit selection");
		const selected = selectAssistanceFood(initial, "oats");
		const entries = buildAssistanceBatchEntries(
			[selected],
			"2026-09-12",
			"breakfast",
			() => "entry",
		);
		expect(entries[0]).toMatchObject({
			amount: 30,
			quantity: 30,
			baseUnit: "g",
			clientEntryId: "entry",
		});
		expect(entries[0]?.nutrients.energy).toEqual({ kind: "value", amount: 30 });
	});

	it("parses a pasted per-100 label, leaves absent nutrients blank, and converts kJ explicitly", () => {
		const label = parseNutritionLabel(
			[
				"Name: Plain yoghurt",
				"Per 100 g",
				"Energy 418.4 kJ",
				"Protein 5 g",
				"Carbohydrate 4 g",
				"of which sugars 4 g",
				"Fat 3 g",
			].join("\n"),
		);
		expect(label?.name).toEqual({ en: "Plain yoghurt", nl: "Plain yoghurt" });
		expect(label?.baseUnit).toBe("g");
		expect(label?.energyBasis).toBe("kj-converted");
		expect(label?.nutrients.energy).toMatchObject({
			kind: "value",
			amount: 100,
		});
		expect(label?.nutrients.fibre).toEqual({ kind: "absent" });
		expect(Object.keys(label?.nutrients ?? {})).toHaveLength(8);
	});

	it("round-trips editable label blanks as absent rather than zero", () => {
		const label = parseNutritionLabel("Name: Oats\nPer 100 g\nEnergy 1500 kJ");
		expect(label).toBeDefined();
		if (!label) return;
		const inputs = editableLabelNutrients(label.nutrients);
		expect(inputs.protein).toBe("");
		const nutrients = nutrientsFromLabelInputs({ ...inputs, protein: "12,5" });
		expect(nutrients.protein).toEqual({ kind: "value", amount: 12.5 });
		expect(nutrients.fat).toEqual({ kind: "absent" });
	});

	it("bounds long or oversized text before a local batch can be accepted", () => {
		expect(assistanceInputError("x".repeat(12_001))).toBe("too-long");
		expect(
			assistanceInputError(
				Array.from({ length: 101 }, () => "1 g oats").join(", "),
			),
		).toBe("too-many-rows");
	});

	it("keeps an edited label base unit in the personal-food draft", () => {
		const label = parseNutritionLabel(
			"Name: Drink\nPer 100 g\nEnergy 100 kcal",
		);
		expect(label).toBeDefined();
		if (!label) return;
		const draft = personalFoodDraftFromLabel(
			label,
			label.name,
			label.nutrients,
			"ml",
		);
		expect(draft.baseUnit).toBe("ml");
	});

	it("builds a local catalog from personal and shipped sources without changing snapshots", () => {
		const personal = {
			id: "p",
			name: { en: "Food", nl: "Voedsel" },
			baseUnit: "g" as const,
			nutrients: food("p", "Food").nutrients,
			provenance: {
				recordOrigin: "personal" as const,
				nutritionSource: "manual" as const,
				locallyEdited: true,
			},
			servings: [],
			createdAt: 1,
			updatedAt: 1,
		};
		const catalog = buildAssistanceFoodCatalog([], [personal]);
		expect(catalog).toHaveLength(1);
		expect(totalNutrients([catalog[0]?.nutrients ?? {}]).energy.amount).toBe(
			100,
		);
	});
});
