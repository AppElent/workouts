import { useMutation } from "convex/react";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

async function showAllFoods(query?: string) {
	fireEvent.press(await screen.findByRole("tab", { name: "All foods" }));
	if (query) {
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), query);
	}
}

describe("browsing shipped foods", () => {
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

		expect(await screen.findByText("Nothing logged recently")).toBeTruthy();
		expect(screen.queryByText("Apple")).toBeNull();
		fireEvent.changeText(screen.getByPlaceholderText("Search foods"), "apple");
		expect(
			screen.getByRole("tab", { name: "All foods" }).props.accessibilityState,
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
		fireEvent.press(screen.getByText("Save Personal Food"));

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
		fireEvent.press(screen.getByText("Save Personal Food"));
		// The serving sheet opens over the results, so the new food's name is
		// both the sheet's title and the row behind it.
		await screen.findAllByText("Morning mix");
		const originalId = repository.list()[0].id;

		fireEvent.press(screen.getByText("Edit Personal Food"));
		fireEvent.changeText(screen.getByLabelText("Name"), "Morning oats");
		fireEvent.press(screen.getByText("Save Personal Food"));
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

		expect(await screen.findByLabelText("Find food for Lunch")).toBeTruthy();
		expect(screen.getByText("Nothing logged recently")).toBeTruthy();
		await showAllFoods("apple");
		expect(screen.getByText("Apple")).toBeTruthy();

		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"hagelslag",
		);
		expect(await screen.findByText("Chocolate sprinkles")).toBeTruthy();
	});

	it("switches an empty Recent search to the full NEVO catalogue", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple strudel",
		);

		expect(
			screen.getByRole("tab", { name: "All foods" }).props.accessibilityState,
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
		expect(await screen.findByText("Thursday, August 20")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Find food for Breakfast"));
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

		expect(screen.getByLabelText("Find food for Lunch")).toBeTruthy();
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
			expect(screen.getByText("Added Apple to Dinner")).toBeTruthy(),
		);
		expect(screen.getByLabelText("Find food for Dinner")).toBeTruthy();
	});
});
