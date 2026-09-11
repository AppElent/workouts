/**
 * Nutrition's sub-screens are pushed routes, not conditional renders.
 *
 * The difference is invisible in a screenshot and load-bearing on a phone.
 * A pushed route is what gives iOS the edge-swipe back gesture and Android a
 * hardware back that closes the screen instead of leaving the app — neither of
 * which a `useState` swap inside the tab can offer, because there is nothing
 * on the stack to go back to.
 *
 * So what these assert is the thing the platform gestures are built on: the
 * router's own state. Each sub-screen has its own address, arrives with the
 * day and slot the user was looking at, and can be gone back from onto the
 * diary. `testRouter.back()` is the same navigation the edge swipe and the
 * hardware button perform.
 */
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import {
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const value = (amount: number) => ({ kind: "value" as const, amount });

const loggedEntry = {
	_id: "entry-1",
	meal: "lunch" as const,
	name: { en: "Apple", nl: "Appel" },
	serving: { en: "Piece × 1", nl: "Stuk × 1" },
	quantity: 1,
	nutrients: {
		energy: value(76),
		protein: value(0.3),
		carbs: value(15),
		fat: value(0.2),
		saturatedFat: value(0.1),
		fibre: value(2.7),
		sugars: value(13.5),
		salt: value(0.01),
	},
};

beforeEach(() => {
	jest.clearAllMocks();
	jest.mocked(useQuery).mockImplementation((reference, _args?) => {
		if (getFunctionName(reference) === "nutritionGoals:list") return [];
		return { entries: [loggedEntry], totals: {} };
	});
	jest
		.mocked(useMutation)
		.mockReturnValue(
			jest.fn().mockResolvedValue(undefined) as unknown as ReturnType<
				typeof useMutation
			>,
		);
});

describe("Nutrition navigation", () => {
	it("pushes the food browser with the meal and day it was opened from", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		expect(app.getSearchParams()).toMatchObject({
			meal: "dinner",
			date: todayIsoDate(),
		});
		// Opened for that meal, and says so.
		expect(await screen.findByText("Find food for Dinner")).toBeTruthy();
	});

	it("goes back from the food browser onto the diary it was pushed from", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));

		// The same navigation iOS's edge swipe and Android's back button perform.
		expect(testRouter.canGoBack()).toBe(true);
		testRouter.back();

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		expect(await screen.findByText("Today")).toBeTruthy();
	});

	it("pushes the entry editor addressed by the entry it edits", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Edit entry: Apple"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-entry"));
		expect(app.getSearchParams()).toMatchObject({
			id: "entry-1",
			meal: "lunch",
		});
		expect(await screen.findByText("Edit entry")).toBeTruthy();

		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	it("pushes the Combo library for the day being viewed", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByText("Log Combo"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-combos"));
		expect(app.getSearchParams()).toMatchObject({ date: todayIsoDate() });

		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	it("carries the chosen entries to the Combo builder by id", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByText("Create Combo"));
		fireEvent.press(await screen.findByLabelText("Select Apple for Combo"));
		fireEvent.press(await screen.findByText("Continue with 1 part"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-combo-new"));
		expect(app.getSearchParams()).toMatchObject({ entryIds: "entry-1" });
	});

	it("ends a Combo selection when the day it was made on is left", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByText("Create Combo"));
		fireEvent.press(await screen.findByLabelText("Select Apple for Combo"));
		expect(screen.getByText("Continue with 1 part")).toBeTruthy();

		fireEvent.press(screen.getAllByLabelText("Previous day")[0]);

		// The selection was of entries on the day just left, so it is over: no
		// count that outlives the entries behind it, and no enabled Continue
		// that would resolve to nothing.
		await waitFor(() =>
			expect(screen.queryByText("Continue with 1 part")).toBeNull(),
		);
		expect(screen.getByText("Create Combo")).toBeTruthy();
		expect(app.getPathname()).toBe("/nutrition");
	});

	it("leaves the diary itself at the root, with nothing behind it", async () => {
		renderApp();
		await screen.findByText("Today");
		// The tab is the bottom of the stack: back from here must not unwind
		// out of Nutrition into some other screen.
		expect(testRouter.canGoBack()).toBe(false);
	});

	it("pushes a Combo's options so back returns to the library before the diary", async () => {
		const app = renderApp();
		const combo = app.repository.createCombo({
			name: "Breakfast",
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
						nutrients: loggedEntry.nutrients,
					},
				},
			],
		});
		fireEvent.press(await screen.findByText("Log Combo"));
		fireEvent.press(await screen.findByText("Breakfast"));
		await waitFor(() =>
			expect(app.getSearchParams()).toMatchObject({
				comboId: combo.id,
				date: todayIsoDate(),
			}),
		);
		testRouter.back();
		await waitFor(() => expect(app.getSearchParams().comboId).toBeUndefined());
		expect(app.getPathname()).toBe("/nutrition-combos");
		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});
});
