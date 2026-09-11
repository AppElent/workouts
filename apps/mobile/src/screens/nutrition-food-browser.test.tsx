import { useMutation } from "convex/react";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

describe("browsing shipped foods", () => {
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
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"training oats",
		);
		fireEvent.press(await screen.findByText("Training oats"));
		fireEvent.press(screen.getByText("Log food"));

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
		fireEvent.press(screen.getByText("Create Personal Food"));
		fireEvent.changeText(screen.getByLabelText("English name"), "Training gel");
		fireEvent.changeText(screen.getByLabelText("Dutch name"), "Trainingsgel");
		fireEvent.press(screen.getByLabelText("Energy: Amount"));
		fireEvent.changeText(screen.getByLabelText("Energy per 100 g"), "260");
		fireEvent.press(screen.getByText("Add Serving"));
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 English label"),
			"Pouch",
		);
		fireEvent.changeText(
			screen.getByLabelText("Serving 1 Dutch label"),
			"Zakje",
		);
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
		fireEvent.press(screen.getByText("Create Personal Food"));
		fireEvent.changeText(screen.getByLabelText("English name"), "Morning mix");
		fireEvent.changeText(screen.getByLabelText("Dutch name"), "Ochtendmix");
		fireEvent.press(screen.getByText("Save Personal Food"));
		// The serving sheet opens over the results, so the new food's name is
		// both the sheet's title and the row behind it.
		await screen.findAllByText("Morning mix");
		const originalId = repository.list()[0].id;

		fireEvent.press(screen.getByText("Edit Personal Food"));
		fireEvent.changeText(screen.getByLabelText("English name"), "Morning oats");
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

		expect(await screen.findByText("Find food for Lunch")).toBeTruthy();
		expect(screen.getByText("Apple")).toBeTruthy();

		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"hagelslag",
		);
		expect(await screen.findByText("Chocolate sprinkles")).toBeTruthy();
	});

	it("only includes the full NEVO catalogue after an explicit search-all action", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"apple strudel",
		);

		expect(screen.queryByText("Apple strudel")).toBeNull();
		fireEvent.press(screen.getByText("Search all 2,328 foods"));
		expect(await screen.findByText("Apple strudel")).toBeTruthy();
	});

	it("browses the complete catalogue in bounded pages", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Breakfast"));
		fireEvent.press(screen.getByText("Search all 2,328 foods"));

		expect(await screen.findByText("All NEVO foods")).toBeTruthy();
		expect(screen.getByText("Show more foods")).toBeTruthy();
		fireEvent.press(screen.getByText("Show more foods"));
		expect(screen.getAllByRole("button").length).toBeGreaterThan(50);
	});

	it("previews authored servings and preserves trace nutrient states", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Snacks"));
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
		fireEvent.press(screen.getByText("Search all 2,328 foods"));
		fireEvent.press(await screen.findByText("Black nightshade raw"));

		expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
	});

	it("offers exact grams and scales the preview when quantity changes", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
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

		expect(screen.getByText("Scan barcode")).toBeTruthy();
		fireEvent.press(screen.getByText("Apple"));
		fireEvent.press(await screen.findByText("Log food"));

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
		fireEvent.press(screen.getByText("Apple"));
		const button = await screen.findByText("Log food");
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
});
