import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type PersonalFood,
} from "@workouts/core/nutrition";
import type { Combo } from "../../../data/personal-food-repository";
import {
	comboDraft,
	comboPartFromEntry,
	comboPartFromFood,
	comboTotals,
	moveComboPart,
	withComboPart,
	withoutMissingParts,
} from "./combo-parts";

function nutrients(
	energy: number,
	protein = 1,
): Record<NutrientKey, NutrientValue> {
	const values = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
	) as Record<NutrientKey, NutrientValue>;
	values.energy = { kind: "value", amount: energy };
	values.protein = { kind: "value", amount: protein };
	return values;
}

function food(
	servings: PersonalFood["servings"] = [],
	baseUnit: "g" | "serving" = "g",
): PersonalFood {
	return {
		id: "oats",
		name: { en: "Oats", nl: "Havermout" },
		baseUnit,
		nutrients: nutrients(389, 13),
		servings,
		classification: "ordinary",
		nutritionBasis:
			baseUnit === "serving"
				? { kind: "perServing", label: { en: "bowl", nl: "kom" } }
				: { kind: "per100", unit: "g" },
		estimated: false,
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		createdAt: 1,
		updatedAt: 1,
	};
}

const combo: Combo = {
	id: "c1",
	name: "Wrap lunch",
	createdAt: 1,
	updatedAt: 1,
	parts: (["a", "b", "c"] as const).map((id, index) => ({
		id,
		status: id === "b" ? "missing" : "available",
		reference: { kind: "oneOff" },
		snapshot: {
			name: { en: id, nl: id },
			serving: { en: "1", nl: "1" },
			quantity: 1,
			amount: 1,
			baseUnit: "serving",
			nutrients: nutrients(100 * (index + 1), 10),
			provenance: { source: "oneOff" },
		},
	})),
};

describe("combo parts", () => {
	it("adds a library food at its first serving", () => {
		const part = comboPartFromFood(
			food([{ label: { en: "Bowl", nl: "Kom" }, amount: 60 }]),
		);
		expect(part.reference).toEqual({ kind: "personal", foodId: "oats" });
		expect(part.snapshot.amount).toBe(60);
		const energy = part.snapshot.nutrients.energy;
		expect(energy.kind === "value" && energy.amount).toBeCloseTo(233.4);
	});

	it("adds a food without servings at 100 g, or one serving", () => {
		expect(comboPartFromFood(food()).snapshot.amount).toBe(100);
		expect(comboPartFromFood(food([], "serving")).snapshot.amount).toBe(1);
	});

	it("totals the saved snapshots, missing parts included", () => {
		expect(comboTotals(combo)).toEqual({
			energy: 600,
			protein: 30,
			carbs: undefined,
			fat: undefined,
		});
	});

	it("moves a part and drops missing ones", () => {
		expect(moveComboPart(combo, "c", -1).parts.map((part) => part.id)).toEqual([
			"a",
			"c",
			"b",
		]);
		expect(moveComboPart(combo, "a", -1).parts.map((part) => part.id)).toEqual([
			"a",
			"b",
			"c",
		]);
		expect(withoutMissingParts(combo).parts.map((part) => part.id)).toEqual([
			"a",
			"c",
		]);
	});

	it("turns a combo back into a draft that keeps part ids", () => {
		const draft = comboDraft(combo);
		expect(draft.name).toBe("Wrap lunch");
		expect(draft.parts[0]).not.toHaveProperty("status");
		expect(draft.parts[0].id).toBe("a");
	});

	it("keeps a logged food by reference and a one-off as a snapshot", () => {
		const base = {
			id: "e1",
			name: { en: "Oats", nl: "Havermout" },
			serving: { en: "Bowl × 1", nl: "Kom × 1" },
			quantity: 1,
			amount: 60,
			baseUnit: "g" as const,
			nutrients: nutrients(233),
		};
		expect(
			comboPartFromEntry({
				...base,
				provenance: {
					source: "personal",
					sourceId: "oats",
					nutritionSource: "manual",
					locallyEdited: false,
				},
			} as never).reference,
		).toEqual({ kind: "personal", foodId: "oats" });
		expect(
			comboPartFromEntry({ ...base, provenance: { source: "oneOff" } } as never)
				.reference,
		).toEqual({ kind: "oneOff" });
	});

	it("appends a new part, or replaces one in its place", () => {
		const part = comboPartFromFood(food());
		const added = withComboPart(combo, part);
		expect(added.parts.map((item) => item.id ?? "new")).toEqual([
			"a",
			"b",
			"c",
			"new",
		]);
		const replaced = withComboPart(combo, part, "b");
		expect(replaced.parts.map((item) => item.id ?? "new")).toEqual([
			"a",
			"new",
			"c",
		]);
		expect(replaced.parts[1].reference).toEqual({
			kind: "personal",
			foodId: "oats",
		});
		expect(withComboPart(combo, part, "gone").parts).toHaveLength(4);
	});
});
