import { useConvexConnectionState, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen } from "expo-router/testing-library";
import { todayIsoDate } from "../data/calendar-day";
import type { NutrientGoal } from "../data/nutrition-day";
import { OFFLINE_GRACE_MS } from "../data/stalled-offline";
import { renderApp } from "../test-support/render-app";

const defaultQuery = jest.mocked(useQuery).getMockImplementation();
let goals: NutrientGoal[] | undefined;

beforeEach(() => {
	goals = undefined;
	jest.mocked(useConvexConnectionState).mockReturnValue({
		...useConvexConnectionState(),
		isWebSocketConnected: true,
	});
	jest.mocked(useQuery).mockImplementation((reference, args?) => {
		if (getFunctionName(reference) === "nutritionGoals:forDate")
			return goals
				? { goals, basis: "effective", effectiveFrom: "2026-09-20" }
				: undefined;
		return defaultQuery?.(reference, args);
	});
});

it("replaces the loading region with received goals", async () => {
	renderApp();
	await screen.findByText("Breakfast");
	expect(screen.getByLabelText("Loading goals")).toBeTruthy();
	goals = [{ nutrient: "energy", direction: "max", target: 2100 }];
	// A screen update samples the newly available query response.
	fireEvent.press(screen.getByLabelText("Show other nutrients"));
	expect(screen.queryByLabelText("Loading goals")).toBeNull();
	expect(screen.queryByText("No nutrition goals")).toBeNull();
	expect(screen.getByLabelText(/Energy: 0 \/ ≤2100 kcal/)).toBeTruthy();
});

it("keeps a downloaded diary usable while its goals are still loading", async () => {
	renderApp();
	await screen.findByText("Breakfast");
	expect(screen.queryByText("No nutrition goals")).toBeNull();
	expect(screen.getByLabelText("Loading goals")).toBeTruthy();
	expect(screen.getByLabelText("Add food to Breakfast")).toBeEnabled();
});

it("does not call uncached meals empty after a local entry is added", async () => {
	jest.mocked(useQuery).mockReturnValue(undefined);
	const app = renderApp();
	app.nutritionRepository.accept("test-user", {
		version: 1,
		operationId: "offline-entry",
		expectedSubject: "test-user",
		operation: {
			kind: "create",
			entry: {
				clientEntryId: "offline-apple",
				date: todayIsoDate(),
				meal: "breakfast",
				name: { en: "Apple", nl: "Appel" },
				serving: { en: "Apple × 1", nl: "Appel × 1" },
				quantity: 1,
				amount: 130,
				baseUnit: "g",
				provenance: { source: "oneOff" },
				nutrients: {
					energy: { kind: "value", amount: 73 },
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
	});
	// Date navigation rereads the actual local projection.
	fireEvent.press(screen.getByLabelText("Next day"));
	fireEvent.press(screen.getByLabelText("Previous day"));
	expect(await screen.findByText("Apple")).toBeTruthy();
	expect(
		screen.queryAllByText("Nothing logged yet. Use + to add a food."),
	).toHaveLength(0);
	expect(
		screen.getAllByText("No entries for this meal are on this phone yet."),
	).toHaveLength(3);
	expect(screen.getByLabelText("Add food to Lunch")).toBeEnabled();
});

it("explains uncached goals offline without hiding the available diary", async () => {
	jest.useFakeTimers();
	jest.mocked(useConvexConnectionState).mockReturnValue({
		...useConvexConnectionState(),
		isWebSocketConnected: false,
	});
	try {
		renderApp();
		await screen.findByText("Breakfast");
		act(() => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
		expect(screen.queryByText("No nutrition goals")).toBeNull();
		expect(screen.queryByLabelText("Loading goals")).toBeNull();
		expect(
			screen.getByText(
				"Goals for this day are not on this phone yet. They will appear when you reconnect. You can still log food.",
			),
		).toBeTruthy();
		expect(screen.getByLabelText("Add food to Breakfast")).toBeEnabled();
	} finally {
		jest.useRealTimers();
	}
});
