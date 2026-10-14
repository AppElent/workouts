import { shippedLibrary } from "@foundry/core/nutrition";
import {
	applyChoices,
	chooseInput,
	combinedNutrients,
	type DescribedItem,
	diarySnapshots,
	groundItems,
	itemNutrients,
	type LabelReading,
	labelChecks,
	labelNutrients,
	personalFoodDraftFromReading,
	readyToLog,
	reviewTotals,
	withAmount,
} from "./nutrition-ai";
import { buildAssistanceFoodCatalog } from "./nutrition-assistance";

const catalog = buildAssistanceFoodCatalog(shippedLibrary().active, []);

const bread: DescribedItem = {
	name: "Volkorenbrood",
	amount: 70,
	unit: "g",
	grams: 70,
	amountLabel: "2 sneetjes",
	confidence: "high",
	brand: null,
	searchTerms: ["brood volkoren", "brood"],
};
const pancake: DescribedItem = {
	...bread,
	name: "Bananenpannenkoek van oma",
	amount: 120,
	grams: 120,
	amountLabel: "1 stuk",
	confidence: "low",
	searchTerms: ["zzz onbekend"],
};

const estimate = {
	energy: 260,
	protein: 8,
	carbs: 38,
	fat: 8,
	saturatedFat: 2,
	sugars: 14,
	fibre: 2,
	salt: 0.5,
};

describe("AI entry grounding", () => {
	it("offers local candidates per item and sends only refs and names", () => {
		const [grounded] = groundItems([bread], catalog, "nl");
		expect(grounded.candidates.length).toBeGreaterThan(0);
		expect(grounded.candidates.length).toBeLessThanOrEqual(12);
		const [input] = chooseInput([grounded], ["Lidl"]);
		expect(input.brand).toBe("Lidl");
		expect(input.candidates[0]).toEqual({
			ref: grounded.candidates[0].id,
			name: expect.any(String),
		});
	});

	it("computes a chosen food from its own figures and keeps an estimate only without one", () => {
		const grounded = groundItems([bread, pancake], catalog, "nl");
		const ref = grounded[0].candidates[0].id;
		const items = applyChoices(grounded, [
			{ index: 0, ref, estimate: null },
			{ index: 1, ref: null, estimate },
		]);
		expect(items[0].food?.id).toBe(ref);
		expect(items[1].food).toBeUndefined();
		expect(itemNutrients(items[1])?.energy).toEqual({
			kind: "value",
			amount: 260,
		});
		const per100 = items[0].food?.nutrients.energy;
		expect(itemNutrients(items[0])?.energy).toEqual({
			kind: "value",
			amount: per100?.kind === "value" ? per100.amount * 0.7 : Number.NaN,
		});
		expect(readyToLog(items)).toBe(true);
		expect(reviewTotals(items).energy.amount).toBeCloseTo(
			260 + (per100?.kind === "value" ? per100.amount * 0.7 : 0),
		);
	});

	it("uses the weight for a drink matched to a food measured per gram", () => {
		const milk: DescribedItem = {
			...bread,
			name: "Halfvolle melk",
			amount: 200,
			unit: "ml",
			grams: 206,
			amountLabel: "1 glas",
			searchTerms: ["melk halfvolle", "melk"],
		};
		const [grounded] = groundItems([milk], catalog, "nl");
		const perGram = grounded.candidates.find((food) => food.baseUnit === "g");
		const [item] = applyChoices(
			[grounded],
			[{ index: 0, ref: perGram?.id ?? null, estimate: null }],
		);
		expect(item).toMatchObject({ amount: 206, unit: "g", ml: 200 });
	});

	it("never offers a per-ml food for an amount described as a weight", () => {
		const grounded = groundItems([bread], catalog, "nl");
		expect(grounded[0].candidates.every((food) => food.baseUnit !== "ml")).toBe(
			true,
		);
	});

	it("marks a total incomplete instead of counting an unknown as zero", () => {
		const [item] = applyChoices(groundItems([pancake], catalog, "nl"), [
			{ index: 0, ref: null, estimate },
		]);
		const unknownFat = {
			...item,
			estimate: { ...itemNutrients(item), fat: { kind: "absent" as const } },
		} as typeof item;
		const totals = reviewTotals([item, unknownFat]);
		expect(totals.energy).toEqual({ amount: 520, known: 2, missing: false });
		expect(totals.fat).toEqual({ amount: 8, known: 1, missing: true });
	});

	it("blocks logging an item with neither a food nor an estimate", () => {
		const items = applyChoices(groundItems([pancake], catalog, "nl"), [
			{ index: 0, ref: null, estimate: null },
		]);
		expect(readyToLog(items)).toBe(false);
	});

	it("rescales an estimate with a new amount", () => {
		const [item] = applyChoices(groundItems([pancake], catalog, "nl"), [
			{ index: 0, ref: null, estimate },
		]);
		const half = withAmount(item, 60, "nl");
		expect(itemNutrients(half)?.energy).toEqual({ kind: "value", amount: 130 });
		expect(half.amountLabel).toBe("60 g");
		expect(half.confidence).toBe("high");
	});

	it("logs estimated entries that keep their food reference", () => {
		const grounded = groundItems([bread, pancake], catalog, "nl");
		const items = applyChoices(grounded, [
			{ index: 0, ref: grounded[0].candidates[0].id, estimate: null },
			{ index: 1, ref: null, estimate },
		]);
		let id = 0;
		const [matched, guessed] = diarySnapshots(
			items,
			"2026-10-14",
			"lunch",
			() => `id-${++id}`,
		);
		expect(matched).toMatchObject({
			estimated: true,
			amount: 70,
			provenance: { source: "shipped", sourceId: grounded[0].candidates[0].id },
			clientEntryId: "id-1",
		});
		expect(guessed).toMatchObject({
			estimated: true,
			provenance: { source: "oneOff" },
			name: { nl: "Bananenpannenkoek van oma" },
		});
	});

	it("combines items into one estimate and keeps an unknown figure unknown", () => {
		const grounded = groundItems([pancake, pancake], catalog, "nl");
		const items = applyChoices(grounded, [
			{ index: 0, ref: null, estimate },
			{ index: 1, ref: null, estimate },
		]);
		expect(combinedNutrients(items).energy).toEqual({
			kind: "value",
			amount: 520,
		});
		const withUnknown = [
			items[0],
			{
				...items[1],
				estimate: {
					...itemNutrients(items[1]),
					fibre: { kind: "absent" as const },
				} as NonNullable<(typeof items)[1]["estimate"]>,
			},
		];
		expect(combinedNutrients(withUnknown).fibre).toEqual({ kind: "absent" });
	});
});

const reading: LabelReading = {
	isLabel: true,
	name: { en: "Fresh tortellini", nl: "Verse tortellini" },
	brand: "PLUS",
	barcode: "8710624419011",
	barcodeInvalid: false,
	packAmount: 250,
	basis: "g",
	per100: {
		energyKj: 1160,
		energy: 275,
		fat: 7.1,
		saturatedFat: 1.8,
		carbs: 42,
		sugars: 5.1,
		fibre: 1.7,
		protein: 10,
		salt: 0.93,
	},
	servings: [
		{
			name: { en: "Portion (½ package)", nl: "Portie (½ verpakking)" },
			amount: 125,
		},
		{ name: { en: "Whole package", nl: "Hele verpakking" }, amount: 250 },
	],
	notes: "",
};

describe("label scanning", () => {
	it("turns a label into a reviewable personal food with named servings", () => {
		const draft = personalFoodDraftFromReading(reading);
		expect(draft).toMatchObject({
			name: reading.name,
			baseUnit: "g",
			estimated: false,
			nutritionBasis: { kind: "per100", unit: "g" },
			servings: [
				{ label: { nl: "Portie (½ verpakking)" }, amount: 125 },
				{ label: { nl: "Hele verpakking" }, amount: 250 },
			],
			provenance: {
				barcode: "8710624419011",
				brand: "PLUS",
				quantity: "250 g",
			},
		});
		expect(draft.nutrients.salt).toEqual({ kind: "value", amount: 0.93 });
		expect(labelChecks(reading)).toEqual([]);
	});

	it("leaves missing values absent and derives kcal only from printed kJ", () => {
		const nutrients = labelNutrients({
			...reading,
			per100: { ...reading.per100, energy: null, fibre: null },
		});
		expect(nutrients.energy).toEqual({ kind: "value", amount: 277 });
		expect(nutrients.fibre).toEqual({ kind: "absent" });
	});

	it("flags a misread digit that breaks the label's own arithmetic", () => {
		expect(
			labelChecks({
				...reading,
				per100: { ...reading.per100, fat: 17.1, saturatedFat: 21 },
			}),
		).toEqual(["energyMismatch", "saturatedAboveFat"]);
	});

	it("flags an unreadable barcode and one that belongs to another product", () => {
		expect(
			labelChecks({ ...reading, barcode: null, barcodeInvalid: true }),
		).toEqual(["barcodeInvalid"]);
		expect(labelChecks(reading, "8718452341208")).toEqual(["barcodeMismatch"]);
		expect(labelChecks(reading, "8710624419011")).toEqual([]);
	});
});
