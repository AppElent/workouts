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
});
