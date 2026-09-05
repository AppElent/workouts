/**
 * The day, driven the way somebody holding the phone would drive it.
 *
 * Every assertion here is on something a user can see or a screen reader can
 * say. Nothing asserts which component rendered, which hook ran, or what the
 * placeholder data module returned — those are all replaced by #70 and #72, and
 * a test that noticed would be a test that has to be rewritten for no reason.
 */
import { fireEvent, screen } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

describe("the nutrition day", () => {
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
		// Four targeted nutrients, none of them logged against yet.
		expect(screen.getAllByText("Nothing logged")).toHaveLength(4);
	});

	it("gives each meal slot's icon-only plus a spoken name", async () => {
		renderApp();
		await screen.findByText("Breakfast");

		fireEvent.press(screen.getByLabelText("Add food to Lunch"));

		expect(
			await screen.findByText("Adding food arrives in the next update."),
		).toBeTruthy();
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

		expect(
			await screen.findByText("Nutrition figures include NEVO 2025/9.0 data."),
		).toBeTruthy();
		expect(
			screen.getByText("Salt is derived by Appelent from the source's sodium."),
		).toBeTruthy();
	});
});
