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

import { totalNutrients } from "@workouts/core/nutrition";
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import {
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { shiftIsoDate, todayIsoDate } from "../data/calendar-day";
import { weekDates, weekStartMonday } from "../data/nutrition-weekly-review";
import { renderApp } from "../test-support/render-app";

const value = (amount: number) => ({ kind: "value" as const, amount });

const loggedEntry = {
	_id: "entry-1",
	meal: "lunch" as const,
	name: { en: "Apple", nl: "Appel" },
	serving: { en: "Piece × 1", nl: "Stuk × 1" },
	quantity: 1,
	amount: 135,
	baseUnit: "g" as const,
	provenance: { source: "oneOff" as const },
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
	jest.mocked(useQuery).mockImplementation((reference, args?) => {
		if (getFunctionName(reference) === "nutritionGoals:list") return [];
		if (getFunctionName(reference) === "nutritionGoals:forDate")
			return { goals: [], basis: "reference", effectiveFrom: null };
		if (getFunctionName(reference) === "nutritionReview:week") {
			const startDate = (args as { startDate: string }).startDate;
			return {
				startDate,
				endDate: shiftIsoDate(startDate, 6),
				days: weekDates(startDate).map((date) => ({
					date,
					entryCount: 0,
					totals: totalNutrients([]),
					goals: [],
					goalBasis: "reference",
					effectiveFrom: null,
				})),
				averages: {
					energyDays: 0,
					proteinDays: 0,
					energyQualified: false,
					proteinQualified: false,
				},
			};
		}
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
	it("returns a logged One-off Entry to its diary day", async () => {
		// Keep the server write pending so the real local projection remains
		// visible until a server query acknowledges the new entry.
		jest
			.mocked(useMutation)
			.mockReturnValue(
				jest
					.fn()
					.mockReturnValue(new Promise(() => {})) as unknown as ReturnType<
					typeof useMutation
				>,
			);
		const date = "2026-09-24";
		const app = renderApp(
			`/nutrition-cooking?date=${date}&meal=dinner&mode=oneoff-log`,
		);
		fireEvent.changeText(
			await screen.findByLabelText("Food name"),
			"One-off soup",
		);
		fireEvent.changeText(screen.getByLabelText("Amount"), "1");
		fireEvent.changeText(screen.getByLabelText("Energy"), "120");
		fireEvent.press(screen.getByRole("button", { name: "Food visual" }));
		fireEvent.press(screen.getByRole("button", { name: "Fruit" }));
		fireEvent.press(screen.getAllByRole("button", { name: "Log once" })[0]);
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		expect(app.getSearchParams()).toMatchObject({ date });
		expect(await screen.findByText("One-off soup")).toBeTruthy();
		expect(screen.getByLabelText("One-off soup visual")).toBeTruthy();
	});

	it("explains invalid One-off Entry amounts and keeps the entered values", async () => {
		renderApp("/nutrition-cooking?mode=oneoff-log");
		fireEvent.changeText(
			await screen.findByLabelText("Food name"),
			"One-off soup",
		);
		fireEvent.changeText(screen.getByLabelText("Amount"), "0");
		fireEvent.press(screen.getAllByRole("button", { name: "Log once" })[0]);
		expect(
			await screen.findByText("Enter an amount greater than zero."),
		).toBeTruthy();
		expect(screen.getByDisplayValue("One-off soup")).toBeTruthy();
		expect(screen.getByDisplayValue("0")).toBeTruthy();
	});

	it("returns a directly opened Copy meal screen to its target diary day", async () => {
		const targetDate = "2026-09-20";
		const app = renderApp(
			`/nutrition-copy?targetDate=${targetDate}&targetMeal=lunch`,
		);
		const copy = await screen.findByRole("button", { name: /^Copy 1 food/ });
		await waitFor(() => expect(copy).toBeEnabled());
		fireEvent.press(copy);
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		expect(app.getSearchParams()).toMatchObject({ date: targetDate });
	});

	it("opens Week overview first from the menu and returns to the selected day", async () => {
		const app = renderApp();
		const selectedDate = shiftIsoDate(todayIsoDate(), -1);
		fireEvent.press(await screen.findByLabelText("Previous day"));
		expect(screen.queryByLabelText("Week overview")).toBeNull();

		fireEvent.press(await screen.findByLabelText("More nutrition tools"));
		const menuActions = screen.getAllByRole("button");
		const weekAction = await screen.findByText("Week overview");
		expect(
			menuActions.indexOf(screen.getByLabelText("Week overview")),
		).toBeLessThan(menuActions.indexOf(screen.getByLabelText("Food library")));
		fireEvent.press(weekAction);

		await waitFor(() =>
			expect(app.getPathname()).toBe("/nutrition-weekly-review"),
		);
		expect(app.getSearchParams()).toMatchObject({ startDate: selectedDate });
		const monday = weekStartMonday(selectedDate);
		fireEvent.press(
			await screen.findByLabelText(
				new RegExp(`Open .*${Number(monday.slice(-2))}`),
			),
		);

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		expect(app.getSearchParams()).toMatchObject({ date: monday });
	});

	it("opens assisted logging from the diary tools and returns to the diary", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("More nutrition tools"));
		fireEvent.press(await screen.findByText("Text and nutrition label"));
		await waitFor(() =>
			expect(app.getPathname()).toBe("/nutrition-assistance"),
		);
		expect(app.getSearchParams()).toMatchObject({
			date: todayIsoDate(),
			meal: "breakfast",
		});
		expect(testRouter.canGoBack()).toBe(true);
		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});
	it("pushes the food browser with the meal and day it was opened from", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		expect(app.getSearchParams()).toMatchObject({
			meal: "dinner",
			date: todayIsoDate(),
		});
		// The meal chip row retains the route's meal context.
		expect(
			(await screen.findByRole("radio", { name: "Dinner" })).props
				.accessibilityState,
		).toMatchObject({ checked: true });
	});
	it("preserves Dinner when switching from Add food to Log once", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		fireEvent.press(await screen.findByLabelText("More food actions"));
		fireEvent.press(await screen.findByText("Log once"));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-cooking"));
		expect(app.getSearchParams()).toMatchObject({
			date: todayIsoDate(),
			meal: "dinner",
			mode: "oneoff-log",
		});
		expect(await screen.findByLabelText("Food name")).toBeTruthy();
		expect(screen.getByText("Servings")).toBeTruthy();
		expect(screen.queryByLabelText("Carbohydrates")).toBeNull();
		const moreNutrients = screen.getByLabelText("More nutrients");
		expect(moreNutrients.props.accessibilityState).toEqual({ expanded: false });
		fireEvent.press(moreNutrients);
		expect(screen.getByLabelText("Carbohydrates")).toBeTruthy();
		fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		expect(app.getSearchParams()).toMatchObject({ meal: "dinner" });
	});

	it("switches between One-off and reusable food authoring", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Dinner"));
		fireEvent.press(await screen.findByLabelText("More food actions"));
		fireEvent.press(await screen.findByText("Log once"));

		fireEvent.press(
			await screen.findByRole("radio", { name: "Personal food" }),
		);
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		expect(await screen.findByText("Create Personal Food")).toBeTruthy();

		fireEvent.press(screen.getByRole("radio", { name: "One-off" }));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-cooking"));
		expect(await screen.findByLabelText("Food name")).toBeTruthy();
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
		expect(await screen.findByLabelText("Quantity")).toBeTruthy();

		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	it("pushes the Food library from the nutrition menu", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("More nutrition tools"));
		fireEvent.press(await screen.findByText("Food library"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-library"));
		expect(await screen.findByText("Personal foods")).toBeTruthy();
		expect(screen.getByText("Combos")).toBeTruthy();
		expect(screen.getByText("Recipes")).toBeTruthy();

		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	it("carries the chosen entries to the Combo builder by id", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByText("Select"));
		fireEvent.press(await screen.findByLabelText("Select Apple for Combo"));
		fireEvent.press(await screen.findByText("Continue with 1 part"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-combo-new"));
		expect(app.getSearchParams()).toMatchObject({ entryIds: "entry-1" });
	});

	it("ends a Combo selection when the day it was made on is left", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByText("Select"));
		fireEvent.press(await screen.findByLabelText("Select Apple for Combo"));
		expect(screen.getByText("Continue with 1 part")).toBeTruthy();

		fireEvent.press(screen.getAllByLabelText("Previous day")[0]);

		// The selection was of entries on the day just left, so it is over: no
		// count that outlives the entries behind it, and no enabled Continue
		// that would resolve to nothing.
		await waitFor(() =>
			expect(screen.queryByText("Continue with 1 part")).toBeNull(),
		);
		expect(await screen.findByText("Select")).toBeTruthy();
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
		fireEvent.press(await screen.findByLabelText("More nutrition tools"));
		fireEvent.press(await screen.findByText("Food library"));
		fireEvent.press(await screen.findByText("Combos"));
		fireEvent.press(await screen.findByText("Breakfast"));
		await waitFor(() =>
			expect(app.getSearchParams()).toMatchObject({
				comboId: combo.id,
				date: todayIsoDate(),
			}),
		);
		testRouter.back();
		await waitFor(() => expect(app.getSearchParams().comboId).toBeUndefined());
		expect(app.getPathname()).toBe("/nutrition-library");
		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});
});
