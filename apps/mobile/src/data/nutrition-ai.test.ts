import { shippedLibrary } from "@foundry/core/shipped-foods";
import {
	applyChoices,
	asksFor,
	asksToRemove,
	carryOver,
	chooseInput,
	combinedNutrients,
	countedPortion,
	currentDescription,
	type DescribedItem,
	diarySnapshots,
	groundItems,
	isDeletedRow,
	isUncertain,
	itemNutrients,
	type LabelReading,
	labelChecks,
	labelNutrients,
	oneEntrySnapshot,
	personalFoodDraftFromReading,
	preparationCaption,
	type ReviewItem,
	readyToLog,
	removedInWords,
	reviewTotals,
	sentenceWithoutRemoved,
	withAmount,
	withOmittedRows,
} from "./nutrition-ai";
import { buildAssistanceFoodCatalog } from "./nutrition-assistance";

const catalog = buildAssistanceFoodCatalog(shippedLibrary().active, []);

const bread: DescribedItem = {
	kind: "ingredient",
	components: [],
	estimate: null,
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
		expect(half.confidence).toBe(item?.confidence);
	});

	it("marks only guesses as estimated, and keeps the food reference", () => {
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
		expect(matched?.estimated).toBeUndefined();
		expect(matched).toMatchObject({
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

describe("AI entry products", () => {
	const part = {
		protein: 10,
		carbs: 20,
		fat: 10,
		saturatedFat: 2,
		sugars: 2,
		fibre: 2,
		salt: 0.5,
	};
	const sandwich: DescribedItem = {
		...bread,
		kind: "product",
		name: "Broodje pittige kip (Spar)",
		amount: 200,
		grams: 200,
		amountLabel: "1 broodje",
		brand: "Spar",
		searchTerms: ["broodje kip", "brood"],
		components: [
			{ name: "Meergranen bol", grams: 100, energy: 260, ...part },
			{ name: "Gefrituurde kip", grams: 100, energy: 240, ...part },
		],
		estimate: { energy: 500, ...part },
	};

	it("keeps a product whole and estimated instead of matching an ingredient", () => {
		const [item] = groundItems([sandwich], catalog, "nl");
		expect(item.candidates).toEqual([]);
		expect(chooseInput([item], ["Spar"])[0]).toMatchObject({ product: true });
		const [chosen] = applyChoices(
			[item],
			[{ index: 0, ref: null, estimate: { energy: 99, ...part } }],
		);
		expect(itemNutrients(chosen)?.energy).toEqual({
			kind: "value",
			amount: 500,
		});
		expect(chosen.components?.map((c) => c.name)).toEqual([
			"Meergranen bol",
			"Gefrituurde kip",
		]);
	});

	it("scales a product's components with its amount", () => {
		const [item] = groundItems([sandwich], catalog, "nl");
		const half = withAmount(item, 100, "nl");
		expect(half.components?.map((c) => c.energy)).toEqual([130, 120]);
		expect(itemNutrients(half)?.energy).toEqual({ kind: "value", amount: 250 });
	});
});

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

describe("corrections", () => {
	const figures = {
		energy: 400,
		protein: 20,
		carbs: 40,
		fat: 16,
		saturatedFat: 4,
		sugars: 4,
		fibre: 2,
		salt: 1,
	};
	const sandwich: DescribedItem = {
		...bread,
		kind: "product",
		name: "Broodje kip (Spar)",
		brand: "Spar",
		amount: 200,
		grams: 200,
		amountLabel: "1 broodje",
		estimate: figures,
		components: [{ name: "Broodje", grams: 200, ...figures }],
	};
	const matched = () => {
		const [row] = groundItems([bread], catalog, "nl");
		const ref = row?.candidates[0]?.id ?? null;
		return applyChoices(groundItems([bread], catalog, "nl"), [
			{ index: 0, ref, estimate: null },
		]);
	};

	it("leaves an item as it is when the amount did not change", () => {
		const [row] = matched();
		expect(row && withAmount(row, row.amount, "nl")).toBe(row);
	});

	it("describes the review as it stands: edits in, deleted rows out", () => {
		const rows = groundItems([sandwich, bread], catalog, "nl");
		const halved = rows[0] && withAmount(rows[0], 100, "nl");
		const now = currentDescription(halved ? [halved] : [], [sandwich, bread]);
		expect(now.map((item) => item.name)).toEqual(["Broodje kip (Spar)"]);
		expect(now[0]?.grams).toBe(100);
		expect(now[0]?.estimate?.energy).toBe(200);
		expect(now[0]?.components[0]?.energy).toBe(200);
	});

	it("keeps untouched matched rows, and rescales them when only the size moved", () => {
		const rows = matched();
		const chosen = rows[0]?.food?.id;
		const same = groundItems([bread], catalog, "nl");
		expect(carryOver(same, [bread], rows, [bread], "nl")[0]?.food?.id).toBe(
			chosen,
		);
		const more = { ...bread, amount: 105, grams: 105 };
		const bigger = carryOver(
			groundItems([more], catalog, "nl"),
			[more],
			rows,
			[bread],
			"nl",
		)[0];
		expect(bigger?.food?.id).toBe(chosen);
		expect(bigger?.amount).toBeCloseTo(105);
	});

	it("goes back to the AI when a correction changed what the food is", () => {
		const other = { ...bread, searchTerms: ["brood wit"] };
		expect(
			carryOver(
				groundItems([other], catalog, "nl"),
				[other],
				matched(),
				[bread],
				"nl",
			)[0],
		).toBeUndefined();
	});

	it("keeps values set by hand, even if the AI renames the food's search", () => {
		const [estimated] = groundItems([sandwich], catalog, "nl");
		const edited = { ...estimated, edited: true } as NonNullable<
			typeof estimated
		>;
		const next = { ...sandwich, searchTerms: ["iets anders"] };
		expect(
			carryOver(
				groundItems([next], catalog, "nl"),
				[next],
				[edited],
				[sandwich],
				"nl",
			)[0]?.edited,
		).toBe(true);
	});
});

describe("grounding", () => {
	const food = (id: string) =>
		catalog.find((candidate) => candidate.name.nl === id);

	it("never offers a dry food for a cooked weight", () => {
		const cooked: DescribedItem = {
			...bread,
			name: "Havermout gekookt",
			searchTerms: ["havermout"],
			amount: 250,
			grams: 250,
		};
		const [row] = groundItems([cooked], catalog, "nl");
		expect(
			row?.candidates.every((candidate) => {
				const energy = candidate.nutrients.energy;
				return energy.kind !== "value" || energy.amount <= 250;
			}),
		).toBe(true);
		expect(food("Havermout")).toBeTruthy();
	});

	it("treats ongekookt as dry, and only caps grains and legumes", () => {
		const dry: DescribedItem = {
			...bread,
			name: "Pasta ongekookt",
			searchTerms: ["pasta ongekookt", "pasta"],
			amount: 80,
			grams: 80,
		};
		const [row] = groundItems([dry], catalog, "nl");
		expect(
			row?.candidates.some((candidate) => {
				const energy = candidate.nutrients.energy;
				return energy.kind === "value" && energy.amount > 300;
			}),
		).toBe(true);
	});

	it("drops fried variants when the fat is its own row", () => {
		const egg: DescribedItem = {
			...bread,
			name: "Gebakken ei",
			searchTerms: ["ei gebakken", "ei"],
			amount: 165,
			grams: 165,
		};
		const butter: DescribedItem = {
			...bread,
			name: "Roomboter",
			searchTerms: ["roomboter"],
			amount: 15,
			grams: 15,
		};
		const fried = (rows: ReturnType<typeof groundItems>) =>
			rows[0]?.candidates.filter((food) => /gebakken/i.test(food.name.nl)) ??
			[];
		expect(fried(groundItems([egg], catalog, "nl")).length).toBeGreaterThan(0);
		expect(fried(groundItems([egg, butter], catalog, "nl"))).toHaveLength(0);
	});

	it("offers shipped foods for a generic dish, not for a named store product", () => {
		const pie: DescribedItem = {
			...bread,
			kind: "product",
			name: "Appeltaart",
			searchTerms: ["appeltaart"],
			amount: 120,
			grams: 120,
		};
		expect(
			groundItems([pie], catalog, "nl")[0]?.candidates.length,
		).toBeGreaterThan(0);
		expect(
			groundItems([{ ...pie, brand: "Spar" }], catalog, "nl")[0]?.candidates,
		).toHaveLength(0);
	});
});

describe("counted portions", () => {
	const egg: DescribedItem = {
		...bread,
		name: "Ei gekookt",
		searchTerms: ["ei gekookt", "ei"],
		amount: 165,
		grams: 165,
		amountLabel: "3 eieren",
	};
	const pick = (item: DescribedItem, name: string) => {
		const grounded = groundItems([item], catalog, "nl");
		const ref = grounded[0]?.candidates.find((c) => c.name.nl === name)?.id;
		return applyChoices(grounded, [
			{ index: 0, ref: ref ?? null, estimate: null },
		])[0];
	};

	it("counts three eggs as three of the library's egg", () => {
		expect(pick(egg, "Gekookt ei")?.amount).toBe(150);
		expect(pick(egg, "Gekookt ei")?.amountLabel).toBe("3 eieren");
	});

	it("leaves a stated measure alone", () => {
		expect(pick({ ...egg, amountLabel: "165 g" }, "Gekookt ei")?.amount).toBe(
			165,
		);
	});
});

describe("what a correction may change", () => {
	const row = (item: DescribedItem, key = "item-0") => {
		const [grounded] = groundItems([item], catalog, "nl");
		const ref = grounded?.candidates[0]?.id;
		const [chosen] = applyChoices(
			[grounded as NonNullable<typeof grounded>],
			[{ index: 0, ref: ref ?? null, estimate: null }],
		);
		return { ...(chosen as NonNullable<typeof chosen>), key };
	};

	it("keeps hand-set grams when the AI repeats another weight", () => {
		const edited = {
			...withAmount(row(bread), 80, "nl"),
			edited: true,
		};
		const returned = { ...bread, id: "item-0", grams: 90, amount: 90 };
		const [kept] = carryOver(
			groundItems([returned], catalog, "nl"),
			[returned],
			[edited],
			[bread],
			"nl",
			"meer kaas",
		);
		expect(kept?.amount).toBe(80);
	});

	it("changes a hand-set row when the correction is about it", () => {
		const edited = {
			...withAmount(row(bread), 80, "nl"),
			edited: true,
		};
		const returned = { ...bread, id: "item-0", grams: 160, amount: 160 };
		const [kept] = carryOver(
			groundItems([returned], catalog, "nl"),
			[returned],
			[edited],
			[bread],
			"nl",
			"dubbel brood",
		);
		expect(kept?.amount).toBeCloseTo(160);
	});

	it("changes a row the correction changed, also when it names another", () => {
		const cheese = {
			...bread,
			name: "Goudse kaas",
			searchTerms: ["kaas gouda", "kaas"],
			amount: 40,
			grams: 40,
			amountLabel: "2 plakjes",
		};
		const more = [
			{
				...bread,
				id: "item-0",
				amount: 105,
				grams: 105,
				amountLabel: "3 sneetjes",
			},
			{
				...cheese,
				id: "item-1",
				amount: 80,
				grams: 80,
				amountLabel: "4 plakjes",
			},
		];
		const [next] = carryOver(
			groundItems(more, catalog, "nl"),
			more,
			[row({ ...bread, amountLabel: "2 sneetjes" }), row(cheese, "item-1")],
			[bread, cheese],
			"nl",
			"3 boterhammen en dubbel kaas",
		);
		expect(next?.amountLabel).toBe("3 sneetjes");
		expect(next?.grams).toBe(105);
	});

	it("does not change an untouched row because the AI rephrased its amount", () => {
		const cheese = {
			...bread,
			name: "Goudse kaas",
			searchTerms: ["kaas gouda", "kaas"],
			amount: 40,
			grams: 40,
			amountLabel: "2 plakjes",
		};
		const drifted = [
			{ ...bread, id: "item-0", amount: 90, grams: 90, amountLabel: "90 g" },
			{
				...cheese,
				id: "item-1",
				amount: 60,
				grams: 60,
				amountLabel: "3 plakjes",
			},
		];
		const [next] = carryOver(
			groundItems(drifted, catalog, "nl"),
			drifted,
			[row({ ...bread, amountLabel: "2 sneetjes" }), row(cheese, "item-1")],
			[bread, cheese],
			"nl",
			"meer kaas",
		);
		expect(next?.amountLabel).toBe("2 sneetjes");
	});

	it("never takes the raw food for something prepared", () => {
		const [breaded] = groundItems(
			[
				{
					...bread,
					name: "Kipfilet gepaneerd",
					searchTerms: ["kipfilet gepaneerd"],
				},
			],
			catalog,
			"nl",
		);
		expect(breaded?.candidates.map((food) => food.name.nl).join()).not.toMatch(
			/rauw/i,
		);
	});

	it("brings back a row the AI left out, unless that was asked", () => {
		const cheese = { ...bread, name: "Goudse kaas", searchTerms: ["kaas"] };
		const prior = [row(bread), row(cheese, "item-1")];
		const kept: DescribedItem[] = [{ ...bread, id: "item-0" }];
		const names = (said: string, items = kept) =>
			withOmittedRows(items, prior, [bread, cheese], said).map(
				(item) => item.name,
			);
		expect(names("en een glas water")).toEqual([bread.name, cheese.name]);
		const handSet = [{ ...row(bread), edited: true }, row(cheese, "item-1")];
		expect(
			withOmittedRows(
				[{ ...cheese, id: "item-1" }],
				handSet,
				[bread, cheese],
				"meer kaas",
			).map((item) => item.name),
		).toEqual([cheese.name, bread.name]);
		expect(names("geen kaas")).toEqual([bread.name]);
		expect(names("geen beleg")).toEqual([bread.name]);
		expect(names("laatste weg")).toEqual([bread.name]);
		expect(names("het was een tosti")).toEqual([bread.name]);
		expect(names("alleen het brood")).toEqual([bread.name]);
		expect(names("het was sushi", [{ ...bread, name: "Sushi" }])).toEqual([
			"Sushi",
		]);
	});

	it("does not take dry figures for a cooked weight", () => {
		const [oats] = groundItems(
			[
				{
					...bread,
					name: "Havermout gekookt",
					amount: 250,
					grams: 250,
					searchTerms: ["geen treffer"],
				},
			],
			catalog,
			"nl",
		);
		const [row] = applyChoices(
			[oats as ReviewItem],
			[
				{
					index: 0,
					ref: null,
					estimate: {
						energy: 925,
						protein: 30,
						carbs: 150,
						fat: 17,
						saturatedFat: 3,
						sugars: 2,
						fibre: 25,
						salt: 0,
					},
				},
			],
			"nl",
		);
		expect(row?.confidence).toBe("low");
		const energy = row?.estimate?.energy;
		expect(energy?.kind === "value" && energy.amount).toBeCloseTo(175, 0);
	});

	it("prefers the prepared food in the database over an estimate", () => {
		const [chicken] = groundItems(
			[
				{
					...bread,
					name: "Kipfilet gebakken",
					amount: 150,
					grams: 150,
					searchTerms: ["kip gebakken"],
				},
			],
			catalog,
			"nl",
		);
		const [row] = applyChoices(
			[chicken as ReviewItem],
			[
				{
					index: 0,
					ref: null,
					estimate: {
						energy: 300,
						protein: 45,
						carbs: 0,
						fat: 12,
						saturatedFat: 3,
						sugars: 0,
						fibre: 0,
						salt: 0.5,
					},
				},
			],
			"nl",
		);
		expect(row?.food?.name.nl).toMatch(/kipfilet/i);
		for (const name of [
			"Kipfilet rauw",
			"Kipfilet gepaneerd",
			"Kipfilet in roomsaus",
		]) {
			const [own] = groundItems(
				[
					{
						...bread,
						name,
						amount: 150,
						grams: 150,
						searchTerms: ["kipfilet"],
					},
				],
				catalog,
				"nl",
			);
			const [kept] = applyChoices(
				[own as ReviewItem],
				[
					{
						index: 0,
						ref: null,
						estimate: {
							energy: 300,
							protein: 45,
							carbs: 0,
							fat: 12,
							saturatedFat: 3,
							sugars: 0,
							fibre: 0,
							salt: 0.5,
						},
					},
				],
				"nl",
			);
			expect(kept?.food).toBeUndefined();
		}
	});

	it("does not match a food that already contains another row", () => {
		const milk = { ...bread, name: "Halfvolle melk", searchTerms: ["melk"] };
		const porridge = {
			...bread,
			name: "Havermout gekookt",
			searchTerms: ["pap havermout"],
		};
		const [first] = groundItems([porridge, milk], catalog, "nl");
		expect(first?.candidates.map((food) => food.name.nl).join()).not.toMatch(
			/melk/i,
		);
	});

	it("replaces a hand-set food when the correction names another", () => {
		const edited = { ...withAmount(row(bread), 80, "nl"), edited: true };
		const chicken = {
			...bread,
			id: "item-0",
			name: "Kipfilet",
			searchTerms: ["kipfilet", "kip"],
		};
		const [kept] = carryOver(
			groundItems([chicken], catalog, "nl"),
			[chicken],
			[edited],
			[bread],
			"nl",
			"kip in plaats van brood",
		);
		expect(kept).toBeUndefined();
	});

	it("leaves a row alone when the correction is about another", () => {
		const cheese = {
			...bread,
			name: "Goudse kaas",
			searchTerms: ["kaas gouda", "kaas"],
			amount: 40,
			grams: 40,
			amountLabel: "2 plakjes",
		};
		const breadRow = row(bread);
		const cheeseRow = row(cheese, "item-1");
		const drifted = [
			{ ...bread, id: "item-0", grams: 90, amount: 90 },
			{ ...cheese, id: "item-1", grams: 60, amount: 60 },
		];
		const [keptBread, keptCheese] = carryOver(
			groundItems(drifted, catalog, "nl"),
			drifted,
			[breadRow, cheeseRow],
			[bread, cheese],
			"nl",
			"meer kaas",
		);
		expect(keptBread?.amount).toBe(70);
		expect(keptCheese?.amount).toBeCloseTo(60);
	});

	it("follows a row the AI renamed, by its id", () => {
		const edited = {
			...withAmount(row(bread), 80, "nl"),
			edited: true,
		};
		const renamed = { ...bread, id: "item-0", name: "Bruin brood" };
		const [kept] = carryOver(
			groundItems([renamed], catalog, "nl"),
			[renamed],
			[edited],
			[bread],
			"nl",
			"meer kaas",
		);
		expect(kept?.amount).toBe(80);
		expect(kept?.described).toBe("Bruin brood");
	});

	it("reads whether a correction asks for a food", () => {
		expect(asksFor("toch wel ham erbij", ["Ham"])).toBe(true);
		expect(asksFor("en een ei", ["Ei"])).toBe(true);
		expect(asksFor("wel boter", ["Roomboter"])).toBe(true);
		expect(asksFor("nog steeds zonder boter", ["Boter"])).toBe(false);
		expect(asksFor("geen kaas", ["Kaas"])).toBe(false);
		expect(asksFor("een groot glas", ["Glas melk"])).toBe(true);
		expect(asksFor("met extra saus", ["Brood met kaas"])).toBe(false);
		expect(asksFor("toch wel eieren", ["Ei"])).toBe(true);
		expect(asksFor("extra pindakaas", ["Kaas"])).toBe(false);
		expect(asksFor("200 g rijst", ["Boter", "10 g"])).toBe(false);
		expect(asksFor("zonder ui, kaas erbij", ["Kaas"])).toBe(true);
		expect(asksFor("zonder de kaas", ["Kaas"])).toBe(false);
		expect(asksFor("zonder extra kaas", ["Kaas"])).toBe(false);
		expect(asksFor("zonder ui en kaas", ["Kaas"])).toBe(false);
		expect(asksFor("geen saus maar wel kaas", ["Kaas"])).toBe(true);
		expect(asksFor("niet zo veel kaas", ["Kaas"])).toBe(true);
		expect(asksFor("toch tomaten", ["Tomaat"])).toBe(true);
	});

	it("knows a deleted row under another name", () => {
		const gone = [{ name: "Boter", searchTerms: ["boter"] }];
		expect(
			isDeletedRow({ name: "Roomboter", searchTerms: ["roomboter"] }, gone),
		).toBe(true);
		expect(
			isDeletedRow({ name: "Kaas", searchTerms: ["kaas gouda"] }, gone),
		).toBe(false);
		const cheese = [{ name: "Jonge kaas", searchTerms: ["kaas jong"] }];
		expect(
			isDeletedRow(
				{ name: "Kaas belegen", searchTerms: ["kaas belegen"] },
				cheese,
			),
		).toBe(true);
		expect(
			isDeletedRow({ name: "Tosti met kaas", searchTerms: ["tosti"] }, cheese),
		).toBe(false);
		const apple = [{ name: "Appel", searchTerms: ["appel"] }];
		expect(
			isDeletedRow({ name: "Appeltaart", searchTerms: ["appeltaart"] }, apple),
		).toBe(false);
	});
});

describe("portions in the person's words", () => {
	it("never overrides a weight in the label", () => {
		const cream = { amountLabel: "1 portie (30 g)" } as ReviewItem;
		expect(countedPortion(cream)).toBeUndefined();
		expect(
			countedPortion({ amountLabel: "200 ml" } as ReviewItem),
		).toBeUndefined();
		expect(countedPortion({ amountLabel: "3 eieren" } as ReviewItem)).toBe(3);
	});

	it("shows a volume as said, though the diary counts grams", () => {
		const milk: DescribedItem = {
			...bread,
			name: "Halfvolle melk",
			searchTerms: ["melk halfvolle"],
			amount: 200,
			unit: "ml",
			grams: 206,
			amountLabel: "200 ml",
		};
		const [grounded] = groundItems([milk], catalog, "nl");
		const [chosen] = applyChoices(
			[grounded as NonNullable<typeof grounded>],
			[{ index: 0, ref: grounded?.candidates[0]?.id ?? null, estimate: null }],
		);
		const [entry] = diarySnapshots(
			[chosen as ReviewItem],
			"2026-10-14",
			"lunch",
			() => "id",
		);
		expect(entry?.serving.nl).toBe("200 ml");
	});
});

describe("logging", () => {
	const rows = () => {
		const grounded = groundItems([bread], catalog, "nl");
		return applyChoices(grounded, [
			{ index: 0, ref: grounded[0]?.candidates[0]?.id ?? null, estimate: null },
		]);
	};

	it("shows the person's own portion in the diary", () => {
		const [entry] = diarySnapshots(rows(), "2026-11-06", "lunch", () => "id");
		expect(entry?.serving.nl).toBe("2 sneetjes (70 g)");
		expect(entry?.amount).toBe(70);
	});

	it("logs everything as one entry with its total weight", () => {
		const entry = oneEntrySnapshot(
			[
				...rows(),
				{ ...rows()[0], key: "b" } as ReturnType<typeof rows>[number],
			],
			"Boterhammen",
			"2026-11-06",
			"lunch",
			"id",
		);
		expect(entry.name.nl).toBe("Boterhammen");
		expect(entry.amount).toBe(140);
		expect(entry.serving.nl).toBe("2 sneetjes, 2 sneetjes (140 g)");
		expect(entry.clientEntryId).toBe("id");
	});
});

describe("what the review says after a correction", () => {
	const ham = { name: "Ham", searchTerms: ["ham"] };

	it("rebuilds a sentence that names a removed food, from the rows", () => {
		expect(
			sentenceWithoutRemoved(
				{ seen: "Broodje met ham en kaas", title: "Broodje ham kaas" },
				[ham],
				["Broodje", "Kaas"],
			),
		).toEqual({ seen: "Broodje, Kaas", title: "" });
	});

	it("leaves words that still hold", () => {
		const sentence = { seen: "Broodje zonder ham", title: "Broodje kaas" };
		expect(sentenceWithoutRemoved(sentence, [ham], ["Broodje"])).toEqual(
			sentence,
		);
		const tosti = { seen: "Tosti met ham", title: "Tosti ham" };
		expect(sentenceWithoutRemoved(tosti, [ham], ["Tosti met ham"])).toEqual(
			tosti,
		);
	});

	it("says fried under a fried egg counted as a boiled one", () => {
		const [food] = catalog.filter((entry) =>
			/(^|\s)gekookt/i.test(entry.name.nl),
		);
		const row = {
			...groundItems([bread], catalog, "nl")[0],
			described: "Gebakken ei",
			food,
		} as ReviewItem;
		expect(preparationCaption(row, "nl")).toBe("Gebakken ei");
		expect(
			preparationCaption({ ...row, described: "Gekookt ei" }, "nl"),
		).toBeUndefined();
	});
});

describe("corrected matched rows", () => {
	const egg: DescribedItem = {
		...bread,
		name: "Gekookt ei",
		searchTerms: ["ei gekookt"],
		amountLabel: "2 eieren",
		amount: 110,
		grams: 110,
	};
	const eggRow = () => {
		const food = catalog.find((entry) =>
			entry.servings?.some((serving) => /^(1\s+)?ei\b/i.test(serving.label.nl)),
		);
		if (!food) throw new Error("no egg with a serving in the library");
		const [row] = groundItems([egg], catalog, "nl");
		return { ...row, food } as ReviewItem;
	};

	it("takes a raw to cooked answer back to the AI for another food", () => {
		const raw = { ...egg, name: "Kipfilet rauw", searchTerms: ["kipfilet"] };
		const cooked = { ...raw, name: "Kipfilet gegaard" };
		const [row] = groundItems([raw], catalog, "nl");
		const food = catalog[0];
		expect(
			carryOver(
				groundItems([cooked], catalog, "nl"),
				[cooked],
				[{ ...row, food } as ReviewItem],
				[raw],
				"nl",
				"Gegaard",
			)[0],
		).toBeUndefined();
	});

	it("weighs a corrected count as that many servings", () => {
		const row = eggRow();
		const serving = row.food?.servings?.find((option) =>
			/^(1\s+)?ei\b/i.test(option.label.nl),
		);
		const four = { ...egg, amountLabel: "4 eieren", amount: 220, grams: 220 };
		const [next] = carryOver(
			groundItems([four], catalog, "nl"),
			[four],
			[row],
			[egg],
			"nl",
			"het waren er 4",
		);
		expect(next?.amount).toBeCloseTo(4 * (serving?.amount ?? 0));
	});

	it("halves a row set by hand on a whole-meal correction, not otherwise", () => {
		const cheese: DescribedItem = {
			...bread,
			name: "Kaas",
			searchTerms: ["kaas"],
			amountLabel: "60 g",
			amount: 60,
			grams: 60,
		};
		const [row] = groundItems([cheese], catalog, "nl");
		const edited = {
			...row,
			food: catalog[0],
			amount: 60,
			grams: 60,
			edited: true,
		} as ReviewItem;
		const half = { ...cheese, amountLabel: "30 g", amount: 30, grams: 30 };
		const amountAfter = (correction: string) =>
			carryOver(
				groundItems([half], catalog, "nl"),
				[half],
				[edited],
				[cheese],
				"nl",
				correction,
			)[0]?.amount;
		expect(amountAfter("halve portie")).toBeCloseTo(30);
		expect(amountAfter("bruin brood")).toBeCloseTo(60);
	});
});

describe("portions the AI did not hear", () => {
	const row = (over: Partial<DescribedItem>) =>
		groundItems([{ ...bread, ...over }], catalog, "nl")[0] as ReviewItem;

	it("takes a known portion over the AI's guess, with its figures", () => {
		const fries = row({
			kind: "product",
			name: "Patatje oorlog",
			amountStated: false,
			amountLabel: "1 portie",
			amount: 500,
			grams: 500,
			estimate: {
				energy: 1275,
				protein: 10,
				carbs: 100,
				fat: 60,
				saturatedFat: 10,
				sugars: 5,
				fibre: 5,
				salt: 2,
			},
			components: [],
		});
		expect(fries.grams).toBe(260);
		expect(fries.portionGuessed).toBeUndefined();
	});

	it("counts stated pieces of a known portion", () => {
		expect(
			row({
				name: "Volkoren cracker",
				amountStated: true,
				amountLabel: "2 crackers",
				amount: 5,
				grams: 5,
			}).grams,
		).toBe(20);
	});

	it("does not shrink a dish to one food in its name", () => {
		const plate = row({
			name: "Stamppot met gehaktbal",
			amountStated: false,
			amountLabel: "1 bord",
			amount: 450,
			grams: 450,
		});
		expect(plate.grams).toBe(450);
		const side = row({
			name: "Hamburger met friet",
			amountStated: false,
			amountLabel: "1 portie",
			amount: 400,
			grams: 400,
		});
		expect(side.grams).toBe(400);
	});

	it("leaves a stated weight or size alone", () => {
		const stated = row({
			name: "Cracker",
			amountStated: true,
			amountLabel: "40 g",
			amount: 40,
			grams: 40,
		});
		expect(stated.grams).toBe(40);
		const big = row({
			name: "Frikandel",
			amountStated: true,
			amountLabel: "1 grote",
			amount: 120,
			grams: 120,
		});
		expect(big.grams).toBe(120);
	});

	it("marks an unknown portion nobody stated, until the person sets it", () => {
		const guess = row({ name: "Poke bowl", amountStated: false });
		expect(guess.portionGuessed).toBe(true);
		expect(isUncertain({ ...guess, food: catalog[0] })).toBe(true);
		expect(isUncertain({ ...guess, food: catalog[0], edited: true })).toBe(
			false,
		);
	});

	it("keeps a product's estimate when its match is another dish", () => {
		const [curry] = groundItems(
			[
				{
					...bread,
					kind: "product",
					name: "Kipkerrie met rijst",
					amount: 450,
					grams: 450,
					estimate: {
						energy: 495,
						protein: 30,
						carbs: 60,
						fat: 15,
						saturatedFat: 3,
						sugars: 5,
						fibre: 3,
						salt: 2,
					},
					components: [
						{
							name: "Kip",
							grams: 450,
							energy: 495,
							protein: 30,
							carbs: 60,
							fat: 15,
							saturatedFat: 3,
							sugars: 5,
							fibre: 3,
							salt: 2,
						},
					],
				},
			],
			catalog,
			"nl",
		);
		const rich = catalog.find((food) => {
			const energy = food.nutrients.energy;
			return (
				food.baseUnit === "g" && energy.kind === "value" && energy.amount > 280
			);
		});
		const picked = { ...curry, candidates: [rich] } as ReviewItem;
		const [next] = applyChoices(
			[picked],
			[{ index: 0, ref: rich?.id ?? null, estimate: null }],
			"nl",
		);
		expect(next?.food).toBeUndefined();
		expect(next?.confidence).toBe("low");
		expect(reviewTotals([next as ReviewItem]).energy.amount).toBeCloseTo(495);
	});
});

describe("corrections as operations", () => {
	it("reads what a correction takes away without a row of its own", () => {
		expect(removedInWords("geen saus").map((row) => row.name)).toEqual([
			"saus",
		]);
		expect(removedInWords("zonder ui, kaas erbij").map((r) => r.name)).toEqual([
			"ui",
		]);
		expect(removedInWords("meer kaas")).toEqual([]);
	});

	it("does not move other rows when one food is taken away", () => {
		const cheese: DescribedItem = {
			...bread,
			name: "Kaas",
			searchTerms: ["kaas"],
			amount: 40,
			grams: 40,
			amountLabel: "2 plakken",
		};
		const [row] = groundItems([cheese], catalog, "nl");
		const matched = { ...row, food: catalog[0] } as ReviewItem;
		const drifted = { ...cheese, amount: 60, grams: 60 };
		const [next] = carryOver(
			groundItems([drifted], catalog, "nl"),
			[drifted],
			[matched],
			[cheese],
			"nl",
			"geen melk",
		);
		expect(next?.amount).toBeCloseTo(40);
	});

	it("halves a product whose figures were set by hand", () => {
		const made: DescribedItem = {
			...bread,
			kind: "product",
			name: "Broodje",
			searchTerms: ["broodje"],
			amount: 200,
			grams: 200,
			amountLabel: "1 broodje",
			estimate: {
				energy: 500,
				protein: 20,
				carbs: 50,
				fat: 20,
				saturatedFat: 5,
				sugars: 5,
				fibre: 3,
				salt: 2,
			},
			components: [
				{
					name: "Broodje",
					grams: 200,
					energy: 500,
					protein: 20,
					carbs: 50,
					fat: 20,
					saturatedFat: 5,
					sugars: 5,
					fibre: 3,
					salt: 2,
				},
			],
		};
		const [row] = groundItems([made], catalog, "nl");
		const edited = { ...row, edited: true } as ReviewItem;
		const [next] = carryOver(
			groundItems([made], catalog, "nl"),
			[made],
			[edited],
			[made],
			"nl",
			"halve portie",
		);
		expect(next?.grams).toBeCloseTo(100);
		expect(reviewTotals([next as ReviewItem]).energy.amount).toBeCloseTo(250);
	});
});

describe("the last code pass", () => {
	const row = (over: Partial<DescribedItem>) =>
		groundItems([{ ...bread, ...over }], catalog, "nl")[0] as ReviewItem;

	it("knows plurals and diminutives of a portion, not longer words", () => {
		const guessed = (name: string, amountLabel: string) =>
			row({ name, amountLabel, amount: 33, grams: 33, amountStated: false })
				.grams;
		expect(guessed("Frietjes", "1 portie")).toBe(165);
		expect(guessed("Patatje", "1 portie")).toBe(165);
		expect(guessed("Kroketten", "2 stuks")).toBe(200);
		expect(guessed("Hamburgers", "2 stuks")).toBe(340);
		expect(guessed("Appels", "2 stuks")).toBe(300);
		expect(guessed("Bananen", "2 stuks")).toBe(240);
		expect(guessed("Marsreep", "1 reep")).toBe(51);
		expect(guessed("Croissantdeeg", "1 portie")).toBe(33);
		expect(guessed("Stroopwafeldeeg", "1 portie")).toBe(33);
		expect(guessed("Kroket", "1 stukje")).toBe(33);
		expect(guessed("Friet", "1 zak")).toBe(33);
	});

	it("keeps diminutives on a portion and plural measures off it", () => {
		const guessed = (name: string, amountLabel: string) =>
			row({ name, amountLabel, amount: 33, grams: 33, amountStated: false })
				.grams;
		expect(guessed("Banaantje", "1 stuk")).toBe(120);
		expect(guessed("Appeltje", "1 stuk")).toBe(150);
		expect(guessed("Mandarijntje", "1 stuk")).toBe(70);
		expect(guessed("Eiwitreepje", "1 stuk")).toBe(55);
		expect(guessed("Appel", "3 schijven")).toBe(33);
		expect(guessed("Appel", "2 happen")).toBe(33);
		expect(guessed("Kroket", "2 hapjes")).toBe(33);
		const stated = (name: string, amountLabel: string) =>
			row({ name, amountLabel, amount: 33, grams: 33 }).grams;
		expect(stated("Cracker", "10 grams")).toBe(33);
		expect(stated("Appel", "1 kilogram")).toBe(33);
	});

	it("does not count an ons as a piece", () => {
		expect(
			row({ name: "Frikandel", amountLabel: "1 ons", amount: 100, grams: 100 })
				.grams,
		).toBe(100);
	});

	it("treats 'geen idee' as no removal", () => {
		expect(asksToRemove("geen idee")).toBe(false);
		expect(asksToRemove("geen idee hoeveel")).toBe(false);
		expect(asksToRemove("geen flauw idee")).toBe(false);
		expect(asksToRemove("geen saus")).toBe(true);
	});

	it("leaves a matched row alone on a removal when the AI only renames it", () => {
		const [first] = groundItems([bread], catalog, "nl");
		const matched = applyChoices(
			[first as ReviewItem],
			[{ index: 0, ref: first?.candidates[0]?.id ?? null, estimate: null }],
			"nl",
		)[0] as ReviewItem;
		const renamed = {
			...bread,
			id: matched.key,
			name: `Volkoren ${bread.name}`,
			amountLabel: "3 sneetjes",
			amount: 105,
			grams: 105,
		};
		const [kept] = carryOver(
			groundItems([renamed], catalog, "nl"),
			[renamed],
			[matched],
			[bread],
			"nl",
			"geen saus",
		);
		expect(kept?.grams).toBe(matched.grams);
		expect(kept?.food?.id).toBe(matched.food?.id);
		for (const said of [
			"geen saus en drie sneetjes",
			"geen saus, 3 sneetjes",
		]) {
			const [moved] = carryOver(
				groundItems([renamed], catalog, "nl"),
				[renamed],
				[matched],
				[bread],
				"nl",
				said,
			);
			expect(moved?.grams).not.toBe(matched.grams);
		}
	});

	it("does not take a sauce, a roll or a part for the whole food", () => {
		for (const [name, label] of [
			["Frietsaus", "1 portie"],
			["Hamburgerbroodje", "1 broodje"],
			["Kebabsaus", "1 portie"],
			["Frikandelletjes", "5 stuks"],
			["Appel", "2 schijfjes"],
			["Proteinepoeder", "1 eetlepel"],
			["Friet", "1 flinke portie"],
		] as const) {
			expect(
				row({ name, amountLabel: label, amount: 33, grams: 33 }).grams,
			).toBe(33);
		}
	});

	it("leaves the amount of a row the AI kept on a correction", () => {
		expect(
			row({
				id: "item-0",
				name: "Frikandel",
				amountLabel: "1 frikandel",
				amount: 42,
				grams: 42,
			}).grams,
		).toBe(42);
	});

	it("offers no cooked food for a dry weight", () => {
		const dry = row({
			name: "Rijst droog",
			searchTerms: ["rijst"],
			amount: 150,
			grams: 150,
		});
		expect(dry.candidates.length).toBeGreaterThan(0);
		for (const food of dry.candidates) {
			const energy = food.nutrients.energy;
			expect(energy.kind === "value" && energy.amount).toBeGreaterThan(200);
		}
	});

	it("corrects cooked figures estimated for a dry weight", () => {
		const dry = {
			...row({ name: "Bulgur droog", amount: 100, grams: 100 }),
			candidates: [],
		};
		const [next] = applyChoices(
			[dry],
			[
				{
					index: 0,
					ref: null,
					estimate: {
						energy: 120,
						protein: 4,
						carbs: 24,
						fat: 1,
						saturatedFat: 0,
						sugars: 0,
						fibre: 2,
						salt: 0,
					},
				},
			],
			"nl",
		);
		expect(next?.confidence).toBe("low");
		expect(reviewTotals([next as ReviewItem]).energy.amount).toBeCloseTo(350);
	});

	const estimated = (name: string, energy: number) =>
		({
			...row({
				kind: "product",
				name,
				amount: 400,
				grams: 400,
				estimate: {
					energy,
					protein: 10,
					carbs: 10,
					fat: 10,
					saturatedFat: 1,
					sugars: 1,
					fibre: 1,
					salt: 1,
				},
				components: [
					{
						name,
						grams: 400,
						energy,
						protein: 10,
						carbs: 10,
						fat: 10,
						saturatedFat: 1,
						sugars: 1,
						fibre: 1,
						salt: 1,
					},
				],
			}),
		}) as ReviewItem;
	const food = (nl: string, kind: string, kcal: number) =>
		({
			...catalog[0],
			id: nl,
			kind,
			baseUnit: "g",
			name: { nl, en: nl },
			nutrients: {
				...catalog[0]?.nutrients,
				energy: { kind: "value", amount: kcal },
			},
		}) as unknown as NonNullable<ReviewItem["food"]>;

	it("keeps a library row of the same dish, and a person's own food", () => {
		const pick = (item: ReviewItem, chosen: NonNullable<ReviewItem["food"]>) =>
			applyChoices(
				[{ ...item, candidates: [chosen] }],
				[{ index: 0, ref: chosen.id, estimate: null }],
				"nl",
			)[0]?.food?.id;
		const soup = food("Erwtensoep met vlees", "shipped", 77);
		expect(pick(estimated("Erwtensoep", 600), soup)).toBe(soup.id);
		const own = food("Mijn kipschotel", "personal", 160);
		expect(pick(estimated("Kipschotel van thuis", 300), own)).toBe(own.id);
	});

	it("keeps the estimate of a dish that is more than the library's plain food", () => {
		const pick = (item: ReviewItem, chosen: NonNullable<ReviewItem["food"]>) =>
			applyChoices(
				[{ ...item, candidates: [chosen] }],
				[{ index: 0, ref: chosen.id, estimate: null }],
				"nl",
			)[0];
		const hutspot = pick(
			estimated("Hutspot met klapstuk", 800),
			food("Hutspot", "shipped", 63),
		);
		expect(hutspot?.food).toBeUndefined();
		expect(hutspot?.confidence).toBe("low");
		// A known portion's figures beat the patty of the same name.
		expect(
			pick(estimated("Hamburger", 420), food("Hamburger", "shipped", 255))
				?.food,
		).toBeUndefined();
		// The food says what was named: still that dish.
		const soup = food("Erwtensoep met vlees", "shipped", 77);
		expect(pick(estimated("Erwtensoep met vlees", 600), soup)?.food?.id).toBe(
			soup.id,
		);
	});

	it("does not take a plain library food for a named dish", () => {
		const [item] = applyChoices(
			[
				{
					...estimated("Pasta carbonara", 750),
					candidates: [food("Pasta (bereid)", "shipped", 112)],
				},
			],
			[{ index: 0, ref: "Pasta (bereid)", estimate: null }],
			"nl",
		);
		expect(item?.food).toBeUndefined();
	});

	it("halves every row, also next to one labelled a portion", () => {
		const stew = { ...estimated("Stamppot", 500), amountLabel: "1 portie" };
		const sausage = estimated("Rookworst", 300);
		const source = [
			{ ...bread, kind: "product", name: "Stamppot", amountLabel: "1 portie" },
			{ ...bread, kind: "product", name: "Rookworst" },
		] as DescribedItem[];
		const halved = carryOver(
			[stew, sausage],
			source,
			[stew, sausage],
			source,
			"nl",
			"halve portie",
		);
		expect(reviewTotals(halved as ReviewItem[]).energy.amount).toBeCloseTo(400);
	});

	it("halves what is on screen, whatever figure the AI returns", () => {
		const shown = estimated("Lasagne", 500);
		const [half] = carryOver(
			[estimated("Lasagne", 310)],
			[{ ...bread, kind: "product", name: "Lasagne" }],
			[shown],
			[{ ...bread, kind: "product", name: "Lasagne" }],
			"nl",
			"halve portie",
		);
		expect(reviewTotals([half as ReviewItem]).energy.amount).toBeCloseTo(250);
	});

	it("sends the figures on screen to the AI, also when nobody edited them", () => {
		const source = {
			...bread,
			kind: "product",
			name: "Kroket",
			amount: 400,
			grams: 400,
			estimate: {
				energy: 500,
				protein: 10,
				carbs: 10,
				fat: 10,
				saturatedFat: 1,
				sugars: 1,
				fibre: 1,
				salt: 1,
			},
		} as DescribedItem;
		const [sent] = currentDescription([estimated("Kroket", 260)], [source]);
		expect(sent?.estimate?.energy).toBeCloseTo(260);
	});

	it("takes a re-priced row on a removal, and leaves an unchanged one", () => {
		const made = estimated("Broodje kip", 500);
		const before = {
			name: "Broodje kip",
			searchTerms: ["broodje"],
		} as DescribedItem;
		const plain = {
			...bread,
			kind: "product",
			name: "Broodje kip",
			searchTerms: ["broodje"],
			amount: 400,
			grams: 400,
			estimate: {
				energy: 380,
				protein: 10,
				carbs: 10,
				fat: 5,
				saturatedFat: 1,
				sugars: 1,
				fibre: 1,
				salt: 1,
			},
			components: [
				{
					name: "Broodje",
					grams: 400,
					energy: 380,
					protein: 10,
					carbs: 10,
					fat: 5,
					saturatedFat: 1,
					sugars: 1,
					fibre: 1,
					salt: 1,
				},
			],
		} as DescribedItem;
		expect(
			carryOver(
				groundItems([plain], catalog, "nl"),
				[plain],
				[made, { ...made, key: "other", described: "Cola" }],
				[before],
				"nl",
				"geen saus",
			)[0],
		).toBeUndefined();
	});

	it("keeps a hand-set row the AI dropped when another food is taken away", () => {
		const kept = { ...bread, name: "Kip", searchTerms: ["kip"] };
		const broccoli = { ...bread, name: "Broccoli", searchTerms: ["broccoli"] };
		const rows = groundItems([kept, broccoli], catalog, "nl").map((item) =>
			item.described === "Broccoli" ? { ...item, edited: true } : item,
		) as ReviewItem[];
		const names = withOmittedRows(
			[{ ...kept, id: rows[0]?.key }],
			rows,
			[kept, broccoli],
			"geen saus",
		).map((item) => item.name);
		expect(names).toContain("Broccoli");
	});
});
