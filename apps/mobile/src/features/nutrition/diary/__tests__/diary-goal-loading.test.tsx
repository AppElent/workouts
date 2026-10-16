import { useConvexConnectionState, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen } from "expo-router/testing-library";
import {
	formatLongDate as diaryDateLabel,
	shiftIsoDate as diaryShift,
	todayIsoDate as diaryToday,
} from "../../../../data/calendar-day";
import type { NutrientGoal } from "../../../../data/nutrition-day";
import { OFFLINE_GRACE_MS } from "../../../../data/stalled-offline";
import { renderApp } from "../../../../test-support/render-app";

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
	await renderApp();
	await screen.findByText("Breakfast");
	expect(screen.getByLabelText("Loading goals")).toBeTruthy();
	goals = [{ nutrient: "energy", direction: "max", target: 2100 }];
	// Navigating dates samples the newly available query response.
	await fireEvent.press(
		screen.getByLabelText(diaryDateLabel(diaryShift(diaryToday(), 1), "en")),
	);
	expect(screen.queryByLabelText("Loading goals")).toBeNull();
	expect(screen.queryByText("No nutrition goals")).toBeNull();
	expect(screen.getByLabelText("Energy: 0 kcal")).toBeTruthy();
});

it("keeps a downloaded diary usable while its goals are still loading", async () => {
	await renderApp();
	await screen.findByText("Breakfast");
	expect(screen.queryByText("No nutrition goals")).toBeNull();
	expect(screen.getByLabelText("Loading goals")).toBeTruthy();
	expect(screen.getByLabelText("Add food to Breakfast")).toBeEnabled();
});

it("explains uncached goals offline without hiding the available diary", async () => {
	jest.useFakeTimers();
	jest.mocked(useConvexConnectionState).mockReturnValue({
		...useConvexConnectionState(),
		isWebSocketConnected: false,
	});
	try {
		await renderApp();
		await screen.findByText("Breakfast");
		await act(() => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
		expect(screen.queryByText("No nutrition goals")).toBeNull();
		expect(screen.queryByLabelText("Loading goals")).toBeNull();
		expect(
			screen.getByText(
				"Goals for this day are not on this phone yet. Connect to load them and log food.",
			),
		).toBeTruthy();
		expect(screen.getByLabelText("Add food to Breakfast")).toBeEnabled();
	} finally {
		jest.useRealTimers();
	}
});
