/**
 * What the day shows before its data arrives.
 *
 * The requirement is a skeleton that matches the layout it stands in for, not a
 * spinner and not a blank screen — so the assertion is that a screen reader
 * hears one "loading the day", and that the meal slots have not yet been
 * claimed by content that does not exist.
 */
import { screen } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

jest.mock("../data/nutrition-day", () => {
	const actual = jest.requireActual("../data/nutrition-day");
	return { ...actual, useNutritionDay: () => ({ status: "loading" as const }) };
});

describe("a day that is still loading", () => {
	it("shows a skeleton of the day rather than a spinner or a blank", () => {
		renderApp();

		expect(screen.getByLabelText("Loading the day")).toBeTruthy();
		expect(screen.queryByText("Breakfast")).toBeNull();
	});

	it("keeps the date navigation usable while it waits", () => {
		renderApp();

		expect(screen.getByLabelText("Previous day")).toBeTruthy();
		expect(screen.getByLabelText("Next day")).toBeTruthy();
	});
});
