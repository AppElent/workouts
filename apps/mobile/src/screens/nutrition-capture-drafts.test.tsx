/**
 * Capture Drafts, driven the way they are used: a note is filed under a meal,
 * sits in the diary until it becomes food, and never pretends to be intake.
 */
import { useMutation } from "convex/react";
import {
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { shiftIsoDate, todayIsoDate } from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);

beforeEach(() => {
	mockUseMutation.mockReturnValue(
		jest.fn().mockResolvedValue(undefined) as unknown as ReturnType<
			typeof useMutation
		>,
	);
});

describe("Capture Drafts in the diary", () => {
	it("shows a note under its meal without counting it as intake", async () => {
		renderApp(undefined, undefined, undefined, ({ draftRepository }) =>
			draftRepository.create("test-user", {
				date: todayIsoDate(),
				meal: "lunch",
				note: "Wrap from the station",
			}),
		);

		expect(await screen.findByText("Wrap from the station")).toBeTruthy();
		expect(screen.getByText("Note · on this device")).toBeTruthy();
		// Lunch has a row, so no "nothing logged" — but also no kcal subtotal.
		expect(
			screen.getAllByText("Nothing logged yet. Use + to add a food."),
		).toHaveLength(3);
		expect(screen.queryByText(/^\d+ kcal$/)).toBeNull();
	});

	it("saves the search text as a note and lands back on the diary", async () => {
		const app = renderApp();
		fireEvent.press(await screen.findByLabelText("Add food to Lunch"));
		// Saving a note lives in the + menu now. With nothing typed there is
		// nothing to file, so the menu does not offer it.
		fireEvent.press(await screen.findByLabelText("More food actions"));
		expect(screen.queryByText("Save as note")).toBeNull();

		fireEvent.changeText(
			screen.getByPlaceholderText("Search foods"),
			"  wrap from the station ",
		);
		fireEvent.press(await screen.findByText("Save as note"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		expect(await screen.findByText("  wrap from the station ")).toBeTruthy();
		expect(
			app.draftRepository.listForDate("test-user", todayIsoDate()),
		).toMatchObject([{ meal: "lunch", note: "  wrap from the station " }]);
	});

	function seedLunchNote(note = "apple") {
		return renderApp(undefined, undefined, undefined, ({ draftRepository }) =>
			draftRepository.create("test-user", {
				date: todayIsoDate(),
				meal: "lunch",
				note,
			}),
		);
	}

	it("tapping a note reopens the search with the note as the query", async () => {
		const app = seedLunchNote("apple");
		fireEvent.press(await screen.findByLabelText("Resolve note: apple"));

		await waitFor(() => expect(app.getPathname()).toBe("/nutrition-food"));
		expect(app.getSearchParams()).toMatchObject({
			meal: "lunch",
			date: todayIsoDate(),
			query: "apple",
		});
		expect(screen.getByPlaceholderText("Search foods").props.value).toBe(
			"apple",
		);
		expect(await screen.findByText("Apple")).toBeTruthy();
		// Resolving a note never offers to file the same text as a second note.
		fireEvent.press(screen.getByLabelText("More food actions"));
		expect(screen.queryByText("Save as note")).toBeNull();
	});

	it("removes the note once the resolving session logged something for that meal", async () => {
		const app = seedLunchNote("apple");
		fireEvent.press(await screen.findByLabelText("Resolve note: apple"));
		fireEvent.press(await screen.findByText("Apple"));
		fireEvent.press(await screen.findByText("Add & continue"));
		// The serving sheet closing is the signal the log landed; there is no
		// confirmation line on the browser any more.
		await waitFor(() =>
			expect(screen.queryByText("Add & continue")).toBeNull(),
		);

		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));

		await waitFor(() =>
			expect(
				app.draftRepository.listForDate("test-user", todayIsoDate()),
			).toEqual([]),
		);
		expect(screen.queryByLabelText("Resolve note: apple")).toBeNull();
	});

	it("keeps the note when the resolving session logged nothing", async () => {
		const app = seedLunchNote("apple");
		fireEvent.press(await screen.findByLabelText("Resolve note: apple"));
		await screen.findByText("Apple");

		testRouter.back();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));

		expect(await screen.findByLabelText("Resolve note: apple")).toBeTruthy();
	});

	it("points at unresolved notes on other days and jumps to the oldest", async () => {
		renderApp(undefined, undefined, undefined, ({ draftRepository }) => {
			draftRepository.create("test-user", {
				date: shiftIsoDate(todayIsoDate(), -1),
				meal: "dinner",
				note: "Pizza",
			});
			draftRepository.create("test-user", {
				date: shiftIsoDate(todayIsoDate(), -3),
				meal: "snacks",
				note: "Stroopwafel",
			});
		});
		await screen.findByText("Today");
		expect(screen.queryByText("Pizza")).toBeNull();

		fireEvent.press(
			await screen.findByText("2 unresolved notes on other days"),
		);

		expect(await screen.findByText("Stroopwafel")).toBeTruthy();
		expect(screen.getByText("1 unresolved note on another day")).toBeTruthy();
	});
});
