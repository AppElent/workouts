/**
 * The day, driven the way somebody holding the phone would drive it.
 *
 * Every assertion here is on something a user can see or a screen reader can
 * say. Nothing asserts which component rendered, which hook ran, or what the
 * placeholder data module returned — those are all replaced by #70 and #72, and
 * a test that noticed would be a test that has to be rewritten for no reason.
 */
import { useQuery, useQuery_experimental } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen } from "expo-router/testing-library";
import {
	formatLongDate,
	shiftIsoDate,
	todayIsoDate,
} from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseQuery = jest.mocked(useQuery);
const mockUseTrainingMarkerQuery = jest.mocked(useQuery_experimental);

describe("the nutrition day", () => {
	it("opens the calendar from the date and can browse another month", async () => {
		renderApp();
		await screen.findByText("Today");
		fireEvent.press(screen.getByLabelText("Choose date"));
		fireEvent.press(await screen.findByLabelText("Next month"));
		const today = new Date();
		const next = new Date(today.getFullYear(), today.getMonth() + 1, 1, 12);
		expect(
			await screen.findByText(
				next.toLocaleDateString("en", { month: "long", year: "numeric" }),
			),
		).toBeTruthy();
	});
	it("opens on today, with the four meal slots in order", async () => {
		renderApp();

		expect(await screen.findByText("Today")).toBeTruthy();
		for (const meal of ["Breakfast", "Lunch", "Dinner", "Snacks"]) {
			expect(screen.getByText(meal)).toBeTruthy();
		}
	});

	it("puts the goals above the meal slots", async () => {
		renderApp();

		expect(await screen.findByText("Goals")).toBeTruthy();
		expect(screen.getByText("No goals yet")).toBeTruthy();
	});

	it("gives each meal slot's icon-only plus a spoken name", async () => {
		renderApp();
		await screen.findByText("Breakfast");

		fireEvent.press(screen.getByLabelText("Add food to Lunch"));

		expect(await screen.findByLabelText("Find food for Lunch")).toBeTruthy();
	});

	it("explains an empty meal slot rather than leaving it blank", async () => {
		renderApp();

		expect(
			await screen.findAllByText("Nothing logged yet. Use + to add a food."),
		).toHaveLength(4);
	});

	it("steps back a day and returns to today", async () => {
		renderApp();
		await screen.findByText("Today");

		fireEvent.press(screen.getByLabelText("Previous day"));
		expect(await screen.findByText("Yesterday")).toBeTruthy();

		fireEvent.press(screen.getByText("Go to today"));
		expect(await screen.findByText("Today")).toBeTruthy();
	});

	it("steps forward a day", async () => {
		renderApp();
		await screen.findByText("Today");

		fireEvent.press(screen.getByLabelText("Next day"));

		expect(await screen.findByText("Tomorrow")).toBeTruthy();
	});

	it("carries the selected date into Find Food", async () => {
		renderApp();
		await screen.findByText("Today");
		fireEvent.press(screen.getByLabelText("Previous day"));
		fireEvent.press(screen.getByLabelText("Add food to Breakfast"));

		expect(
			await screen.findByText(
				formatLongDate(shiftIsoDate(todayIsoDate(), -1), "en"),
			),
		).toBeTruthy();
	});

	it("keeps the non-targeted nutrients collapsed until asked for them", async () => {
		renderApp();
		await screen.findByText("Other nutrients");

		expect(screen.queryByText("Saturated fat")).toBeNull();

		fireEvent.press(screen.getByLabelText("Show other nutrients"));

		expect(await screen.findByText("Saturated fat")).toBeTruthy();
		expect(screen.getByText("Fibre")).toBeTruthy();
		expect(screen.getByText("Sugars")).toBeTruthy();
		expect(screen.getByText("Salt")).toBeTruthy();
	});

	it("carries the NEVO and derived-salt disclosures on the day itself", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("More nutrition tools"));
		fireEvent.press(await screen.findByText("Data sources"));

		expect(
			await screen.findByText("Nutrition figures include NEVO 2025/9.0 data."),
		).toBeTruthy();
		expect(
			screen.getByText("Salt is derived by Appelent from the source's sodium."),
		).toBeTruthy();
	});

	it("shows a logged snapshot immediately and qualifies incomplete totals", async () => {
		mockUseQuery.mockImplementation((reference, _args?) => {
			if (getFunctionName(reference) === "nutritionGoals:forDate") {
				return {
					goals: [{ nutrient: "energy", direction: "max", target: 2000 }],
					basis: "reference",
					effectiveFrom: null,
				};
			}
			return {
				entries: [
					{
						_id: "entry-1",
						meal: "lunch",
						name: { en: "Apple", nl: "Appel" },
						serving: { en: "Piece × 1", nl: "Stuk × 1" },
						nutrients: {
							energy: { kind: "value", amount: 76 },
							protein: { kind: "trace" },
							carbs: { kind: "value", amount: 15 },
							fat: { kind: "absent" },
							saturatedFat: { kind: "value", amount: 0.1 },
							fibre: { kind: "value", amount: 2.7 },
							sugars: { kind: "value", amount: 13.5 },
							salt: { kind: "value", amount: 0.01 },
						},
					},
				],
				totals: {
					energy: {
						amount: 76,
						entryCount: 1,
						valueCount: 1,
						traceCount: 0,
						absentCount: 0,
						incomplete: false,
						qualified: false,
					},
					protein: {
						amount: 0,
						entryCount: 1,
						valueCount: 0,
						traceCount: 1,
						absentCount: 0,
						incomplete: false,
						qualified: true,
					},
					fat: {
						amount: 0,
						entryCount: 1,
						valueCount: 0,
						traceCount: 0,
						absentCount: 1,
						incomplete: true,
						qualified: true,
					},
				},
			};
		});
		renderApp();

		expect(await screen.findByText("Apple")).toBeTruthy();
		expect(screen.getByText("Piece × 1")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Show other nutrients"));
		expect((await screen.findAllByText("~ 0 g")).length).toBeGreaterThan(0);
		expect(screen.getByText("≥ 0 g")).toBeTruthy();
	});

	it("does not reserve space for the training marker on a day without a completed Activity", async () => {
		renderApp();

		await screen.findByText("Today");
		expect(
			screen.queryByLabelText("You completed a training session on this day."),
		).toBeNull();
		expect(screen.queryByText("Trained")).toBeNull();
	});

	it("shows the training marker on a day with a completed Activity, without changing goals or totals", async () => {
		mockUseTrainingMarkerQuery.mockReturnValue({
			status: "success",
			data: true,
		});
		mockUseQuery.mockImplementation((reference, _args?) => {
			if (getFunctionName(reference) === "nutritionGoals:forDate") {
				return {
					goals: [{ nutrient: "energy", direction: "max", target: 2000 }],
					basis: "reference",
					effectiveFrom: null,
				};
			}
			return {
				entries: [
					{
						_id: "entry-1",
						meal: "lunch",
						name: { en: "Apple", nl: "Appel" },
						serving: { en: "Piece × 1", nl: "Stuk × 1" },
						nutrients: {
							energy: { kind: "value", amount: 76 },
							protein: { kind: "trace" },
							carbs: { kind: "value", amount: 15 },
							fat: { kind: "absent" },
							saturatedFat: { kind: "value", amount: 0.1 },
							fibre: { kind: "value", amount: 2.7 },
							sugars: { kind: "value", amount: 13.5 },
							salt: { kind: "value", amount: 0.01 },
						},
					},
				],
				totals: {
					energy: {
						amount: 76,
						entryCount: 1,
						valueCount: 1,
						traceCount: 0,
						absentCount: 0,
						incomplete: false,
						qualified: false,
					},
				},
			};
		});

		renderApp();

		// Present: the marker itself, accessibly described.
		expect(
			await screen.findByLabelText(
				"You completed a training session on this day.",
			),
		).toBeTruthy();
		expect(screen.getByText("Trained")).toBeTruthy();
		// Unchanged: the same goal progress and food entry a day with no
		// Activity at all would show for this exact diary and goal data — the
		// completed session contributes nothing to either number.
		expect(await screen.findByText("Apple")).toBeTruthy();
		expect(screen.getByText("1924 kcal remaining")).toBeTruthy();
		expect(screen.getByText("76 logged / 2000 target")).toBeTruthy();
	});
});
