/**
 * A render that throws must not take the tab bar with it.
 *
 * The route file exports expo-router's `ErrorBoundary`, so this drives the real
 * one: a route that throws once, the recovery screen it produces, and the retry
 * that brings the day back.
 */
import { fireEvent, screen } from "expo-router/testing-library";
import * as NutritionRoute from "../../app/(app)/(coach)/nutrition";
import { NutritionDayScreen } from "../screens/nutrition-day";
import { renderApp } from "../test-support/render-app";

describe("a day whose render throws", () => {
	it("offers a retry that brings the day back", async () => {
		// Kept true across the initial render *and* React's synchronous recovery
		// attempt, so the boundary is what the user ends up looking at. The test
		// clears it before retrying, standing in for whatever transient condition
		// made the screen throw in the first place.
		let shouldThrow = true;

		renderApp("/nutrition", {
			nutrition: {
				...NutritionRoute,
				default: () => {
					if (shouldThrow) throw new Error("nutrition exploded");
					return <NutritionDayScreen />;
				},
			},
		});

		expect(
			await screen.findByText("This day could not be opened"),
		).toBeTruthy();

		shouldThrow = false;
		fireEvent.press(screen.getByText("Try again"));

		expect(await screen.findByText("Breakfast")).toBeTruthy();
	});
});
