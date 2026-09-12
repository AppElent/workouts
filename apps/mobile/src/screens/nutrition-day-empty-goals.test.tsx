/**
 * The day a brand-new account opens: no goals set yet.
 *
 * The placeholder seam ships a goal set so the goals-first hierarchy is visible
 * before #70 builds the editor. This file replaces the seam with the state that
 * actually greets a new user, and checks the screen offers a way forward rather
 * than an empty box. When #70 lands, the mock goes and the fixture becomes a
 * user with no target rows.
 */
import { fireEvent, screen } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

jest.mock("../data/nutrition-day", () => {
	const actual = jest.requireActual("../data/nutrition-day");
	return {
		...actual,
		useNutritionDay: (date: string) => ({
			status: "ready" as const,
			day: {
				date,
				goals: [],
				totals: {},
				entries: { breakfast: [], lunch: [], dinner: [], snacks: [] },
			},
		}),
	};
});

describe("a day with no goals", () => {
	it("offers a way to set them instead of showing an empty box", async () => {
		renderApp();

		expect(await screen.findByText("No goals yet")).toBeTruthy();

		fireEvent.press(screen.getByText("Set up goals"));

		expect(await screen.findByText("Your nutrition goals")).toBeTruthy();
	});

	it("still shows every nutrient, since none of them is targeted", async () => {
		renderApp();
		await screen.findByText("Other nutrients");

		fireEvent.press(screen.getByLabelText("Show other nutrients"));

		expect(await screen.findByText("Energy")).toBeTruthy();
		expect(screen.getAllByText("Protein").length).toBeGreaterThan(0);
		expect(screen.getByText("Salt")).toBeTruthy();
	});
});
