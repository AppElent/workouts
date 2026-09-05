import { useMutation } from "convex/react";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

describe("browsing shipped foods", () => {
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
