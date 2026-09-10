/**
 * What still works with no connection.
 *
 * Spec #68 draws the line clearly: the shipped library, Personal Foods, Combos
 * and existing diary data stay useful offline, and a provider failure never
 * blocks manual logging. Three things follow, and all three are checkable
 * here:
 *
 * 1. A day this phone has never held cannot arrive while the socket is down,
 *    so it must say so rather than show a skeleton forever. A skeleton is a
 *    promise that content is coming.
 * 2. Logging still works offline. The library is in the bundle, Personal Foods
 *    are in SQLite, and Convex queues the write and replays it on reconnect —
 *    so the meal slots keep their plus controls even when the diary is
 *    unavailable.
 * 3. Nothing claims the day is empty. "Nothing logged here" is a statement
 *    about the diary, and an offline screen is in no position to make it.
 */
import { useConvexConnectionState, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { OFFLINE_GRACE_MS } from "../data/stalled-offline";
import { renderApp } from "../test-support/render-app";

function setConnected(isWebSocketConnected: boolean) {
	jest.mocked(useConvexConnectionState).mockReturnValue({
		isWebSocketConnected,
	} as unknown as ReturnType<typeof useConvexConnectionState>);
}

const goOffline = () => setConnected(false);

/** Convex hands back `undefined` for a query it has no cached answer for. */
function noCachedDay() {
	jest.mocked(useQuery).mockReturnValue(undefined);
}

/** A day that was already downloaded before the connection dropped. */
function cachedDay() {
	jest.mocked(useQuery).mockImplementation((reference, _args?) => {
		if (getFunctionName(reference) === "nutritionGoals:list") return [];
		return {
			entries: [
				{
					_id: "entry-1",
					meal: "breakfast",
					name: { en: "Oatmeal", nl: "Havermout" },
					serving: { en: "Bowl × 1", nl: "Kom × 1" },
					quantity: 1,
					nutrients: {
						energy: { kind: "value", amount: 180 },
						protein: { kind: "value", amount: 6 },
						carbs: { kind: "value", amount: 30 },
						fat: { kind: "value", amount: 3 },
						saturatedFat: { kind: "value", amount: 0.6 },
						fibre: { kind: "value", amount: 4 },
						sugars: { kind: "value", amount: 1 },
						salt: { kind: "value", amount: 0.01 },
					},
				},
			],
			totals: {},
		};
	});
}

/** The screen waits before calling it offline; these tests wait with it. */
async function passTheGracePeriod() {
	await act(async () => {
		jest.advanceTimersByTime(OFFLINE_GRACE_MS);
	});
}

beforeEach(() => {
	jest.clearAllMocks();
	jest.useFakeTimers();
	// `clearAllMocks` forgets calls, not `mockReturnValue`, so the connection
	// has to be put back deliberately or one offline test makes the next one.
	setConnected(true);
});

afterEach(() => {
	jest.useRealTimers();
});

describe("the Nutrition day with no connection", () => {
	it("says the diary has not arrived instead of waiting on a skeleton forever", async () => {
		goOffline();
		noCachedDay();
		renderApp();
		await passTheGracePeriod();

		expect(
			screen.getByText("Your diary for this day is not on this phone yet"),
		).toBeTruthy();
		// The skeleton would have promised something was coming. Nothing is.
		expect(screen.queryByLabelText("Loading the day")).toBeNull();
	});

	it("does not claim the day is empty when it simply does not know", async () => {
		goOffline();
		noCachedDay();
		renderApp();
		await passTheGracePeriod();

		expect(screen.getAllByText("Not available offline")).toHaveLength(4);
		// The usual empty-slot sentence would be a claim about the diary.
		expect(screen.queryByText(/Nothing logged/)).toBeNull();
	});

	it("still lets every meal be logged into, because logging offline works", async () => {
		goOffline();
		noCachedDay();
		const app = renderApp();
		await passTheGracePeriod();

		for (const meal of ["Breakfast", "Lunch", "Dinner", "Snacks"]) {
			expect(screen.getByLabelText(`Add food to ${meal}`)).toBeTruthy();
		}

		fireEvent.press(screen.getByLabelText("Add food to Lunch"));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		// The shipped library ships in the bundle, so search works with no socket.
		expect(await screen.findByPlaceholderText("Search foods")).toBeTruthy();
	});

	it("shows a day it already had, rather than hiding it behind the offline notice", async () => {
		goOffline();
		cachedDay();
		renderApp();
		await passTheGracePeriod();

		expect(screen.getByText("Oatmeal")).toBeTruthy();
		expect(
			screen.queryByText("Your diary for this day is not on this phone yet"),
		).toBeNull();
	});

	it("keeps waiting normally when the socket is up and the day is merely slow", async () => {
		noCachedDay();
		renderApp();
		await passTheGracePeriod();

		expect(screen.getByLabelText("Loading the day")).toBeTruthy();
		expect(
			screen.queryByText("Your diary for this day is not on this phone yet"),
		).toBeNull();
	});

	it("does not flash the notice during the moment the socket takes to connect", async () => {
		// Every cold start looks exactly like being offline for a few hundred
		// milliseconds. Saying so would be a worse lie than the skeleton.
		goOffline();
		noCachedDay();
		renderApp();

		expect(await screen.findByLabelText("Loading the day")).toBeTruthy();
		expect(
			screen.queryByText("Your diary for this day is not on this phone yet"),
		).toBeNull();
	});

	it("goes back to waiting if the socket comes up before the notice does", async () => {
		goOffline();
		noCachedDay();
		renderApp();
		await screen.findByLabelText("Loading the day");

		setConnected(true);
		// Re-render with the connection restored, then let the old grace period
		// have elapsed: the notice must never arrive.
		fireEvent.press(screen.getAllByLabelText("Next day")[0]);
		await passTheGracePeriod();

		expect(
			screen.queryByText("Your diary for this day is not on this phone yet"),
		).toBeNull();
	});
});
