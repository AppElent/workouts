import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { formatShortDate, todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);
const mockUsePaginatedQuery = jest.mocked(usePaginatedQuery);

/** The setup file's defaults, restored after any test that seeds a diary day. */
function emptyDay(reference: Parameters<typeof getFunctionName>[0]) {
	const name = getFunctionName(reference);
	if (name === "nutritionDiary:day") return { entries: [], totals: {} };
	if (name === "nutritionGoals:forDate")
		return { goals: [], basis: "reference", effectiveFrom: null };
	return [];
}

afterEach(() => {
	mockUsePaginatedQuery.mockReturnValue({
		results: [],
		status: "Exhausted",
		loadMore: jest.fn(),
	} as never);
	jest.mocked(useQuery).mockImplementation(emptyDay as never);
});

/**
 * The deliberate broader view (#75), which is now its own chip rather than the
 * last of five exclusive tabs. Tests that only need "search everything" no
 * longer come through here — the default pool already does that.
 */
async function showAllFoods(query?: string) {
	fireEvent.press(await screen.findByRole("tab", { name: "Full catalogue" }));
	if (query) {
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), query);
	}
}

describe("browsing shipped foods", () => {
	it("offers same-unit Personal Measures and logs their exact amount", async () => {
		mockUsePaginatedQuery.mockReturnValue({
			results: [
				{ id: "glass", name: "Small glass", amount: 250, unit: "ml", order: 0 },
				{ id: "scoop", name: "Scoop", amount: 35, unit: "g", order: 1 },
			],
			status: "Exhausted",
			loadMore: jest.fn(),
		} as never);
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = renderApp();
		repository.create({
			name: { en: "Training drink", nl: "Trainingsdrank" },
			baseUnit: "ml",
			nutrients: {
				energy: { kind: "value", amount: 40 },
				protein: { kind: "value", amount: 2 },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await showAllFoods("training drink");
		fireEvent.press(await screen.findByText("Training drink"));

		expect(screen.getByText("Small glass (250 ml)")).toBeTruthy();
		expect(screen.queryByText("Scoop (35 g)")).toBeNull();
		// Personal Measures are choices, never a global default. With no memory,
		// this base-only Food keeps its normal 100 ml starting amount.
		expect(screen.getByText("100 ml")).toBeTruthy();
		fireEvent.press(screen.getByText("Small glass (250 ml)"));
		expect(screen.getByText("Small glass (250 ml) × 1")).toBeTruthy();
		expect(screen.getByText("250 ml")).toBeTruthy();
	});

	it("shows a Personal Food's selected visual and the neutral fallback in search", async () => {
		const { repository } = renderApp();
		const base = {
			baseUnit: "g" as const,
			nutrients: {
				energy: { kind: "value" as const, amount: 42 },
				protein: { kind: "absent" as const },
				carbs: { kind: "absent" as const },
				fat: { kind: "absent" as const },
				saturatedFat: { kind: "absent" as const },
				fibre: { kind: "absent" as const },
				sugars: { kind: "absent" as const },
				salt: { kind: "absent" as const },
			},
			servings: [],
			provenance: {
				recordOrigin: "personal" as const,
				nutritionSource: "manual" as const,
				locallyEdited: false,
			},
		};
		repository.create({
			...base,
			name: { en: "Icon apple", nl: "Icoonappel" },
			visual: { kind: "icon", preset: "fruit" },
		});
		repository.create({
			...base,
			name: { en: "Plain apple", nl: "Gewone appel" },
		});

		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await showAllFoods("apple");

		expect(screen.getByLabelText("Icon apple visual")).toBeTruthy();
		expect(screen.getByLabelText("Plain apple visual")).toBeTruthy();
	});

	it("finds Recipes in the Personal Library and logs a per-serving estimate through the ordinary serving sheet", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = renderApp();
		const nutrients = {
			energy: { kind: "value" as const, amount: 550 },
			protein: { kind: "trace" as const },
			carbs: { kind: "absent" as const },
			fat: { kind: "absent" as const },
			saturatedFat: { kind: "absent" as const },
			fibre: { kind: "absent" as const },
			sugars: { kind: "absent" as const },
			salt: { kind: "absent" as const },
		};
		const recipe = repository.create({
			name: { en: "Pasta bowl", nl: "Pastakom" },
			baseUnit: "serving",
			classification: "recipe",
			estimated: true,
			nutritionBasis: { kind: "perServing", label: { en: "Bowl", nl: "Kom" } },
			nutrients,
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		repository.create({
			name: { en: "Ordinary shake", nl: "Shake" },
			baseUnit: "g",
			nutrients,
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.press(await screen.findByRole("tab", { name: "Recipes" }));
		expect(screen.queryByText("Ordinary shake")).toBeNull();
		fireEvent.press(await screen.findByText("Pasta bowl"));
		expect(screen.getByLabelText("Quantity").props.value).toBe("1");
		fireEvent.changeText(screen.getByLabelText("Quantity"), "");
		expect(screen.queryByText("550 kcal")).toBeNull();
		fireEvent.changeText(screen.getByLabelText("Quantity"), "2");
		fireEvent.press(screen.getByText("Add & continue"));
		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({
			estimated: true,
			amount: 2,
			baseUnit: "serving",
			nutrients: {
				energy: { kind: "value", amount: 1100 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
			},
			provenance: { source: "personal", sourceId: recipe.id },
		});
	});

	it("defaults a base-only Personal Food to 100 base units", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = renderApp();
		repository.create({
			name: { en: "Base-only shake", nl: "Shake zonder portie" },
			baseUnit: "ml",
			nutrients: {
				energy: { kind: "value", amount: 42 },
				protein: { kind: "value", amount: 3 },
				carbs: { kind: "value", amount: 5 },
				fat: { kind: "value", amount: 1 },
				saturatedFat: { kind: "value", amount: 0.2 },
				fibre: { kind: "value", amount: 1 },
				sugars: { kind: "value", amount: 2 },
				salt: { kind: "value", amount: 0.1 },
			},
			servings: [],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await showAllFoods();
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"base-only shake",
		);
		fireEvent.press(await screen.findByText("Base-only shake"));

		expect(screen.getByLabelText("Quantity").props.value).toBe("100");
		expect(await screen.findByText("Millilitre (ml) × 100")).toBeTruthy();
		expect(screen.getByText("42 kcal")).toBeTruthy();
		fireEvent.press(screen.getByText("Add & continue"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({
			amount: 100,
			baseUnit: "ml",
			quantity: 100,
			nutrients: { energy: { kind: "value", amount: 42 } },
		});
	});

	it("keeps Recent honest and quick-logs the remembered default once", async () => {
		const log = jest.fn().mockResolvedValue("entry-1");
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));

		expect(await screen.findByText("Find a food to log")).toBeTruthy();
		expect(screen.queryByText("Apple")).toBeNull();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(
			screen.getByRole("tab", { name: "All" }).props.accessibilityState,
		).toMatchObject({ selected: true });
		fireEvent.press(await screen.findByLabelText("Quick log Apple"));
		fireEvent.press(screen.getByLabelText("Quick log Apple"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		fireEvent.press(screen.getByRole("tab", { name: "Recent" }));
		expect(await screen.findByText("Apple")).toBeTruthy();
	});

	it("shows saved Combos inline with detail and log actions", async () => {
		const app = renderApp();
		const combo = app.repository.createCombo({
			name: "Training lunch",
			parts: [
				{
					reference: { kind: "oneOff" },
					snapshot: {
						name: { en: "Oats", nl: "Haver" },
						serving: { en: "Bowl", nl: "Kom" },
						quantity: 1,
						amount: 100,
						baseUnit: "g",
						provenance: { source: "oneOff" },
						nutrients: {
							energy: { kind: "value", amount: 100 },
							protein: { kind: "absent" },
							carbs: { kind: "absent" },
							fat: { kind: "absent" },
							saturatedFat: { kind: "absent" },
							fibre: { kind: "absent" },
							sugars: { kind: "absent" },
							salt: { kind: "absent" },
						},
					},
				},
			],
		});
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(await screen.findByRole("tab", { name: "Combos" }));

		expect(await screen.findByText("Training lunch")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Open Combo Training lunch"));
		await waitFor(() =>
			expect(app.getSearchParams()).toMatchObject({ comboId: combo.id }),
		);
	});

	it("uses absolute authored-serving quantity shortcuts", async () => {
		const { repository } = renderApp();
		repository.create({
			name: { en: "Shortcut oats", nl: "Snelhavermout" },
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 400 },
				protein: { kind: "value", amount: 10 },
				carbs: { kind: "value", amount: 60 },
				fat: { kind: "value", amount: 8 },
				saturatedFat: { kind: "value", amount: 1 },
				fibre: { kind: "value", amount: 7 },
				sugars: { kind: "value", amount: 2 },
				salt: { kind: "value", amount: 0.1 },
			},
			servings: [{ label: { en: "Scoop", nl: "Schep" }, amount: 30 }],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await showAllFoods();
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"shortcut oats",
		);
		fireEvent.press(await screen.findByText("Shortcut oats"));
		fireEvent.press(screen.getByText("½"));
		expect(await screen.findByText("Scoop × 0.5")).toBeTruthy();
		fireEvent.press(screen.getByText("2"));
		expect(await screen.findByText("Scoop × 2")).toBeTruthy();
		expect(screen.getByText("240 kcal")).toBeTruthy();
	});

	it("logs an unrounded Personal Food snapshot with its stable local provenance", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		const { repository } = renderApp();
		const personalFood = repository.create({
			name: { en: "Training oats", nl: "Trainingshavermout" },
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 371.25 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
				fat: { kind: "value", amount: 7.5 },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "value", amount: 12 },
				sugars: { kind: "value", amount: 0 },
				salt: { kind: "value", amount: 0.01 },
			},
			servings: [{ label: { en: "Scoop", nl: "Schep" }, amount: 30 }],
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		await showAllFoods();
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"training oats",
		);
		fireEvent.press(await screen.findByText("Training oats"));
		fireEvent.press(screen.getByText("Add & continue"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({
			date: todayIsoDate(),
			meal: "lunch",
			name: { en: "Training oats", nl: "Trainingshavermout" },
			serving: { en: "Scoop × 1", nl: "Schep × 1" },
			quantity: 1,
			amount: 30,
			baseUnit: "g",
			nutrients: {
				energy: { kind: "value", amount: 111.375 },
				protein: { kind: "trace" },
				carbs: { kind: "absent" },
				sugars: { kind: "value", amount: 0 },
			},
			provenance: {
				source: "personal",
				sourceId: personalFood.id,
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
	});

	it("creates a Personal Food and finds it ahead of shipped foods in ordinary search", async () => {
		const { repository } = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(screen.getByLabelText("More food actions"));
		fireEvent.press(screen.getByText("New Personal Food"));
		fireEvent.changeText(screen.getByLabelText("Name"), "Training gel");
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "260");
		fireEvent.press(screen.getByText("Custom servings"));
		fireEvent.press(screen.getByText("Add serving"));
		fireEvent.changeText(screen.getByLabelText("Serving 1 name"), "Pouch");
		fireEvent.changeText(screen.getByLabelText("Serving 1 amount in g"), "40");
		fireEvent.press(screen.getByText("Add portion"));
		fireEvent.press(screen.getByText("Save"));

		expect(await screen.findByText("Pouch × 1")).toBeTruthy();
		expect(screen.getByText("104 kcal")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Close serving options"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"training gel",
		);

		const labels = await screen.findAllByText("Personal Food");
		expect(labels).toHaveLength(1);
		expect(screen.getByText("Training gel")).toBeTruthy();
		expect(repository.search("training gel", "en")).toHaveLength(1);
	});

	it("edits and deletes a Personal Food without changing its stable id", async () => {
		const { repository } = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.press(screen.getByLabelText("More food actions"));
		fireEvent.press(screen.getByText("New Personal Food"));
		fireEvent.changeText(screen.getByLabelText("Name"), "Morning mix");
		fireEvent.press(screen.getByText("Save"));
		// The serving sheet opens over the results, so the new food's name is
		// both the sheet's title and the row behind it.
		await screen.findAllByText("Morning mix");
		const originalId = repository.list()[0].id;

		fireEvent.press(await screen.findByText("Edit Personal Food"));
		fireEvent.changeText(screen.getByLabelText("Name"), "Morning oats");
		fireEvent.press(screen.getByText("Save"));
		expect((await screen.findAllByText("Morning oats")).length).toBeGreaterThan(
			0,
		);
		expect(repository.list()[0].id).toBe(originalId);

		fireEvent.press(screen.getByText("Delete Personal Food"));
		expect(await screen.findByText("Delete this Personal Food?")).toBeTruthy();
		const deleteButtons = screen.getAllByText("Delete Personal Food", {
			exact: true,
		});
		fireEvent.press(deleteButtons[deleteButtons.length - 1]);
		await waitFor(() => expect(repository.find(originalId)).toBeUndefined());
		expect(screen.queryByText("Morning oats")).toBeNull();
	});

	it("opens the promoted library for the chosen meal and searches pooled aliases", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));

		expect(
			(await screen.findByRole("radio", { name: "Lunch" })).props
				.accessibilityState,
		).toMatchObject({ checked: true });
		expect(screen.getByText("Find a food to log")).toBeTruthy();
		await showAllFoods("apple");
		expect(screen.getByText("Apple")).toBeTruthy();

		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"hagelslag",
		);
		expect(await screen.findByText("Chocolate sprinkles")).toBeTruthy();
	});

	it("reaches the full NEVO catalogue from the default pool, without switching scope", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple strudel",
		);

		expect(
			screen.getByRole("tab", { name: "All" }).props.accessibilityState,
		).toMatchObject({ selected: true });
		expect(await screen.findByText("Apple strudel")).toBeTruthy();
	});

	it("virtualizes the complete catalogue instead of showing a launcher stack", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await showAllFoods();

		expect(await screen.findByText("Abricots dried and soaked")).toBeTruthy();
		expect(screen.queryByText("Show more foods")).toBeNull();
	});

	it("previews authored servings and preserves trace nutrient states", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		await showAllFoods();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "peach");
		fireEvent.press(await screen.findByText("Peach"));

		expect(await screen.findByText("Peach × 1")).toBeTruthy();
		expect(screen.getAllByText("Trace").length).toBeGreaterThan(0);
		expect(
			screen.getByText(
				"Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven",
			),
		).toBeTruthy();
		expect(screen.getByText(/Salt is not published by NEVO/)).toBeTruthy();
	});

	it("does not turn an absent source nutrient into zero", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"black nightshade",
		);
		await showAllFoods();
		fireEvent.press(await screen.findByText("Black nightshade raw"));

		expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
	});

	it("offers exact grams and scales the preview when quantity changes", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		await showAllFoods("apple");
		fireEvent.press(await screen.findByText("Apple"));
		fireEvent.press(screen.getByText("Gram (g)"));
		fireEvent.changeText(screen.getByLabelText("Quantity"), "100");

		expect(await screen.findByText("Gram (g) × 100")).toBeTruthy();
		expect(screen.getByText("56 kcal")).toBeTruthy();
	});

	it("shows scan beside search and logs the selected snapshot once", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));

		expect(screen.getByLabelText("Scan barcode")).toBeTruthy();
		await showAllFoods("apple");
		fireEvent.press(screen.getByText("Apple"));
		fireEvent.press(await screen.findByText("Add & continue"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({
			date: todayIsoDate(),
			meal: "lunch",
			quantity: 1,
			provenance: { source: "shipped", saltDerived: true },
		});
	});

	it("prevents duplicate logs and preserves the serving after a failure", async () => {
		const log = jest.fn().mockRejectedValue(new Error("offline"));
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		await showAllFoods("apple");
		fireEvent.press(screen.getByText("Apple"));
		const button = await screen.findByText("Add & continue");
		fireEvent.press(button);
		fireEvent.press(button);

		expect(
			await screen.findByText(
				"This food could not be logged. Your selection is still here.",
			),
		).toBeTruthy();
		expect(screen.getByText("Apple × 1")).toBeTruthy();
		expect(log).toHaveBeenCalledTimes(1);
	});

	it("keeps the selected historical meal and browser context for three additions", async () => {
		const log = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp("/nutrition-food?date=2026-08-20&meal=breakfast");
		expect(await screen.findByText("Thu, August 20")).toBeTruthy();
		fireEvent.press(screen.getByRole("radio", { name: "Lunch" }));
		await showAllFoods();

		for (const [query, food] of [
			["apple", "Apple"],
			["peach", "Peach"],
			["hagelslag", "Chocolate sprinkles"],
		] as const) {
			fireEvent.changeText(screen.getByPlaceholderText("Search foods"), query);
			fireEvent.press(await screen.findByText(food));
			fireEvent.press(screen.getByText("Add & continue"));
			await waitFor(() =>
				expect(log).toHaveBeenCalledTimes(
					["apple", "peach", "hagelslag"].indexOf(query) + 1,
				),
			);
		}

		expect(
			screen.getByRole("radio", { name: "Lunch" }).props.accessibilityState,
		).toMatchObject({ checked: true });
		expect(screen.getByPlaceholderText("Search foods").props.value).toBe(
			"hagelslag",
		);
		expect(log.mock.calls).toHaveLength(3);
		expect(log.mock.calls.map(([snapshot]) => snapshot)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ date: "2026-08-20", meal: "lunch" }),
			]),
		);
	});

	it("lets the first submit outcome win while both actions are tapped", async () => {
		let resolveLog!: () => void;
		const log = jest.fn().mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveLog = resolve;
				}),
		);
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		await showAllFoods("apple");
		fireEvent.press(screen.getByText("Apple"));
		fireEvent.press(await screen.findByText("Add & continue"));
		fireEvent.press(screen.getByText("Add & close"));

		expect(log).toHaveBeenCalledTimes(1);
		resolveLog();
		await waitFor(() =>
			expect(screen.queryByText("Add & continue")).toBeNull(),
		);
		expect(
			screen.getByRole("radio", { name: "Dinner" }).props.accessibilityState,
		).toMatchObject({ checked: true });
	});
});

/**
 * The redesign's own promises (design `Food logging.dc.html`, option 3a).
 *
 * These are the five problems the screen was rebuilt to fix, asserted as
 * behaviour rather than layout: one list that always searches everything, a
 * meal and a date that are two separate controls, no dead "Klaar", authoring
 * behind a menu instead of an inline panel, and a running total that is the
 * only confirmation a quick log gets.
 */
describe("the redesigned food browser", () => {
	/** One logged breakfast entry, served by the mocked diary query. */
	function seedBreakfast() {
		jest.mocked(useQuery).mockImplementation(((reference: never) => {
			if (getFunctionName(reference) === "nutritionGoals:forDate")
				return { goals: [], basis: "reference", effectiveFrom: null };
			if (getFunctionName(reference) !== "nutritionDiary:day") return [];
			return {
				entries: [
					{
						_id: "entry-1",
						meal: "breakfast" as const,
						name: { en: "Oatmeal", nl: "Havermout" },
						serving: { en: "Bowl × 1", nl: "Kom × 1" },
						quantity: 1,
						nutrients: {
							energy: { kind: "value" as const, amount: 180 },
							protein: { kind: "absent" as const },
							carbs: { kind: "absent" as const },
							fat: { kind: "absent" as const },
							saturatedFat: { kind: "absent" as const },
							fibre: { kind: "absent" as const },
							sugars: { kind: "absent" as const },
							salt: { kind: "absent" as const },
						},
					},
				],
				totals: {},
			};
		}) as never);
	}

	function oneOffPart(name: string, energy: number) {
		return {
			reference: { kind: "oneOff" as const },
			snapshot: {
				name: { en: name, nl: name },
				serving: { en: "Bowl", nl: "Kom" },
				quantity: 1,
				amount: 100,
				baseUnit: "g" as const,
				provenance: { source: "oneOff" as const },
				nutrients: {
					energy: { kind: "value" as const, amount: energy },
					protein: { kind: "absent" as const },
					carbs: { kind: "absent" as const },
					fat: { kind: "absent" as const },
					saturatedFat: { kind: "absent" as const },
					fibre: { kind: "absent" as const },
					sugars: { kind: "absent" as const },
					salt: { kind: "absent" as const },
				},
			},
		};
	}

	it("pools Combos, Personal Foods and the catalogue into one list", async () => {
		const app = renderApp();
		app.repository.createCombo({
			name: "Fixed breakfast",
			parts: [oneOffPart("Oats", 222), oneOffPart("Milk", 115)],
		});
		app.repository.create({
			name: { en: "Cheese twister", nl: "Kaastwister" },
			baseUnit: "g",
			servings: [],
			nutrients: {
				energy: { kind: "value", amount: 404 },
				protein: { kind: "absent" },
				carbs: { kind: "absent" },
				fat: { kind: "absent" },
				saturatedFat: { kind: "absent" },
				fibre: { kind: "absent" },
				sugars: { kind: "absent" },
				salt: { kind: "absent" },
			},
			provenance: {
				recordOrigin: "personal",
				nutritionSource: "manual",
				locallyEdited: false,
			},
		});
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));

		// No chip is touched between these three: the default pool holds a
		// Combo, a Personal Food and a NEVO record at once.
		expect(await screen.findByText("Fixed breakfast")).toBeTruthy();
		expect(screen.getByText("Combo · 2 foods")).toBeTruthy();
		expect(screen.getByText("337 kcal")).toBeTruthy();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "cheese");
		expect(await screen.findByText("Cheese twister")).toBeTruthy();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(await screen.findByText("Apple")).toBeTruthy();
	});

	it("keeps the meal and the date as two separate controls, and logs into both", async () => {
		const log = jest.fn().mockResolvedValue("entry-1");
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp("/nutrition-food?date=2026-08-20&meal=breakfast");

		// The date is the title and the meal is a chip; neither shares a control
		// with the other, and neither is a menu.
		expect(await screen.findByText("Thu, August 20")).toBeTruthy();
		fireEvent.press(screen.getByRole("radio", { name: "Dinner" }));
		fireEvent.press(screen.getAllByLabelText("Choose date")[0]);
		fireEvent(
			await screen.findByTestId("swiftui-date-picker"),
			"dateChange",
			new Date(2026, 7, 21, 12),
		);

		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		fireEvent.press(await screen.findByLabelText("Quick log Apple"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(log.mock.calls[0][0]).toMatchObject({
			date: "2026-08-21",
			meal: "dinner",
		});
	});

	it("resets to today from inside the picker, where the date it resets is visible", async () => {
		renderApp("/nutrition-food?date=2026-08-20&meal=breakfast");
		expect(await screen.findByText("Thu, August 20")).toBeTruthy();
		// "Today" is not in the navigation bar: there it is disabled exactly when
		// you are already on today, which is most of the time.
		expect(screen.queryByLabelText("Today")).toBeNull();

		fireEvent.press(screen.getAllByLabelText("Choose date")[0]);
		fireEvent.press(await screen.findByLabelText("Today"));

		expect(
			await screen.findByText(formatShortDate(todayIsoDate(), "en")),
		).toBeTruthy();
	});

	it("has no Done: closing is the stack's job, and each row commits its own log", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await screen.findByPlaceholderText("Search foods");

		expect(screen.queryByText("Done")).toBeNull();
	});

	it("puts authoring behind the + rather than an inline panel", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		await screen.findByPlaceholderText("Search foods");

		expect(screen.queryByText("Log once")).toBeNull();
		expect(screen.queryByText("New recipe")).toBeNull();
		fireEvent.press(screen.getByLabelText("More food actions"));

		expect(await screen.findByText("Log once")).toBeTruthy();
		expect(screen.getByText("New Personal Food")).toBeTruthy();
		expect(screen.getByText("New recipe")).toBeTruthy();
	});

	it("carries the meal's running total, and what is in it, into the browser", async () => {
		seedBreakfast();
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));

		// The bar is the browser's only confirmation now, so it has to be right
		// before a single row is tapped.
		expect(
			await screen.findByText("Breakfast · 1 item · 180 kcal"),
		).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Show what is logged"));
		expect(await screen.findByText("Oatmeal · Bowl × 1")).toBeTruthy();

		// Switching meals switches what the bar is reporting.
		fireEvent.press(screen.getByRole("radio", { name: "Lunch" }));
		expect(await screen.findByText("Lunch · 0 items")).toBeTruthy();
	});

	it("does not announce a quick log with a line of its own", async () => {
		const log = jest.fn().mockResolvedValue("entry-1");
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		fireEvent.press(await screen.findByLabelText("Quick log Apple"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		// The old lime "Added Apple to Breakfast" line is gone for good: the bar
		// and the success haptic are the feedback.
		expect(screen.queryByText("Added Apple to Breakfast")).toBeNull();
	});

	it("offers the AI entry point beside barcode rather than nowhere", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		fireEvent.press(await screen.findByLabelText("Describe a meal"));

		await waitFor(() =>
			expect(app.getPathname()).toBe("/nutrition-assistance"),
		);
		expect(app.getSearchParams()).toMatchObject({ meal: "lunch" });
	});
});
