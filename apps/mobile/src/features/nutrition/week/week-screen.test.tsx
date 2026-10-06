import { NUTRIENT_KEYS } from "@workouts/core/nutrition";
import { useConvexConnectionState, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen } from "expo-router/testing-library";
import { shiftIsoDate, todayIsoDate } from "../../../data/calendar-day";
import {
	emptyReviewTotals,
	weekDates,
	weekStartMonday,
} from "../../../data/nutrition-weekly-review";
import { OFFLINE_GRACE_MS } from "../../../data/stalled-offline";
import { renderApp } from "../../../test-support/render-app";

const mockUseQuery = jest.mocked(useQuery);
const mockConnection = jest.mocked(useConvexConnectionState);

const lastWeek = shiftIsoDate(weekStartMonday(todayIsoDate()), -7);
const goals = [
	{ nutrient: "fat", direction: "max", target: 80 },
	{ nutrient: "protein", direction: "min", target: 120 },
] as const;

function reviewDay(
	date: string,
	amounts: { energy: number; fat: number; protein: number } | null,
	withGoals = true,
) {
	const totals = emptyReviewTotals();
	if (amounts)
		for (const key of NUTRIENT_KEYS)
			totals[key] = {
				...totals[key],
				amount: (amounts as Record<string, number>)[key] ?? 0,
				entryCount: 3,
				valueCount: 3,
			};
	return {
		date,
		entryCount: amounts ? 3 : 0,
		totals,
		goals: withGoals ? [...goals] : [],
		goalBasis: withGoals ? ("effective" as const) : ("reference" as const),
		effectiveFrom: withGoals ? "2026-01-01" : null,
	};
}

function serveWeek(days: ReturnType<typeof reviewDay>[] | undefined) {
	mockUseQuery.mockImplementation((reference, _args?) => {
		const name = getFunctionName(reference);
		if (name === "nutritionReview:week")
			return days && { startDate: lastWeek, days, averages: {} };
		if (name === "nutritionDiary:loggedDates") return [];
		return undefined;
	});
}

const dates = weekDates(lastWeek);
const fullWeek = (withGoals = true) => [
	reviewDay(dates[0], { energy: 2100, fat: 70, protein: 130 }, withGoals),
	reviewDay(dates[1], { energy: 2500, fat: 95, protein: 100 }, withGoals),
	reviewDay(dates[2], { energy: 2300, fat: 90, protein: 125 }, withGoals),
	reviewDay(dates[3], null, withGoals),
	reviewDay(dates[4], null, withGoals),
	reviewDay(dates[5], null, withGoals),
	reviewDay(dates[6], null, withGoals),
];

describe("week overview", () => {
	beforeEach(() => {
		mockConnection.mockReturnValue({
			isWebSocketConnected: true,
		} as ReturnType<typeof useConvexConnectionState>);
	});

	afterEach(() => jest.useRealTimers());

	it("summarises the week against each day's goal", async () => {
		serveWeek(fullWeek());
		renderApp(`/nutrition-weekly-review?startDate=${lastWeek}`);

		expect(await screen.findByText("Fat 2× too much")).toBeTruthy();
		expect(screen.getByText("avg. 2,300")).toBeTruthy();
		expect(
			screen.getByLabelText(/^Fat, avg\. 85 g\. .*over goal/),
		).toBeTruthy();
	});

	it("opens the goals of the week with day counts", async () => {
		serveWeek(fullWeek());
		renderApp(`/nutrition-weekly-review?startDate=${lastWeek}`);

		fireEvent.press(await screen.findByText("All goals"));

		expect(await screen.findByText("Goals this week")).toBeTruthy();
		expect(screen.getByText("2 of 3 days too much")).toBeTruthy();
		expect(screen.getByText("2 of 3 days above minimum")).toBeTruthy();
	});

	it("shows totals and a way to set goals when none applied", async () => {
		serveWeek(fullWeek(false));
		renderApp(`/nutrition-weekly-review?startDate=${lastWeek}`);

		expect(await screen.findByText("Set goals")).toBeTruthy();
		expect(screen.queryByText("All goals")).toBeNull();
	});

	it("offers the diary from an empty week", async () => {
		serveWeek(dates.map((date) => reviewDay(date, null)));
		renderApp(`/nutrition-weekly-review?startDate=${lastWeek}`);

		expect(await screen.findByText("Nothing logged this week")).toBeTruthy();
		expect(screen.getByText("Open Monday in diary")).toBeTruthy();
	});

	it("keeps the strip and offers a retry when the week stalls offline", async () => {
		jest.useFakeTimers();
		mockConnection.mockReturnValue({
			isWebSocketConnected: false,
		} as ReturnType<typeof useConvexConnectionState>);
		serveWeek(undefined);
		renderApp(`/nutrition-weekly-review?startDate=${lastWeek}`);
		await act(async () => {
			jest.advanceTimersByTime(OFFLINE_GRACE_MS);
		});

		expect(await screen.findByText("Try again")).toBeTruthy();
		expect(screen.getAllByText("WK").length).toBe(5);
	});
});
