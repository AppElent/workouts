/**
 * Correcting a logged entry, driven the way somebody holding the phone would
 * drive it: tap the entry, change something, save — or delete through the
 * confirmation. Nothing here asserts which mutation ran internally beyond the
 * arguments it was actually given, which is the observable contract #73's
 * acceptance criteria are about.
 */
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import {
	formatLongDate,
	shiftIsoDate,
	todayIsoDate,
} from "../data/calendar-day";
import { renderApp } from "../test-support/render-app";

const mockUseQuery = jest.mocked(useQuery);
const mockUseMutation = jest.mocked(useMutation);

const loggedEntry = {
	_id: "entry-1",
	meal: "lunch" as const,
	name: { en: "Apple", nl: "Appel" },
	serving: { en: "Piece × 1", nl: "Stuk × 1" },
	quantity: 1,
	nutrients: {
		energy: { kind: "value", amount: 76 },
		protein: { kind: "value", amount: 0.3 },
		carbs: { kind: "value", amount: 15 },
		fat: { kind: "value", amount: 0.2 },
		saturatedFat: { kind: "value", amount: 0.1 },
		fibre: { kind: "value", amount: 2.7 },
		sugars: { kind: "value", amount: 13.5 },
		salt: { kind: "value", amount: 0.01 },
	},
};

function mockDayWithLoggedEntry() {
	mockUseQuery.mockImplementation((reference, _args?) => {
		if (getFunctionName(reference) === "nutritionGoals:list") return [];
		return { entries: [loggedEntry], totals: {} };
	});
}

/** Resolves `nutritionDiary.<fn>` to `impl` and every other mutation to a no-op. */
function mockMutations(fn: string, impl: jest.Mock) {
	mockUseMutation.mockImplementation(
		(reference) =>
			(getFunctionName(reference) === `nutritionDiary:${fn}`
				? impl
				: jest.fn().mockResolvedValue(undefined)) as unknown as ReturnType<
				typeof useMutation
			>,
	);
}

async function openEditor() {
	renderApp();
	fireEvent.press(await screen.findByLabelText("Edit entry: Apple"));
	await screen.findByText("Edit entry");
}

beforeEach(() => {
	mockDayWithLoggedEntry();
});

describe("editing a diary entry", () => {
	it("opens pre-filled from the entry", async () => {
		await openEditor();

		expect(screen.getByLabelText("Quantity").props.value).toBe("1");
		expect(screen.getByText("Piece × 1")).toBeTruthy();
	});

	it("rescales the stored snapshot on a quantity edit, not the source", async () => {
		const update = jest.fn().mockResolvedValue(undefined);
		mockMutations("update", update);
		await openEditor();

		fireEvent.changeText(screen.getByLabelText("Quantity"), "2");
		fireEvent.press(screen.getByText("Save changes"));

		await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		expect(update.mock.calls[0][0]).toMatchObject({
			id: "entry-1",
			quantity: 2,
			meal: "lunch",
			date: todayIsoDate(),
		});
		// Closes back to the day.
		expect(await screen.findByText("Today")).toBeTruthy();
	});

	it("moves an entry to another meal", async () => {
		const update = jest.fn().mockResolvedValue(undefined);
		mockMutations("update", update);
		await openEditor();

		fireEvent.press(screen.getByText("Dinner"));
		fireEvent.press(screen.getByText("Save changes"));

		await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		expect(update.mock.calls[0][0]).toMatchObject({ meal: "dinner" });
	});

	it("moves an entry to another calendar date", async () => {
		const update = jest.fn().mockResolvedValue(undefined);
		mockMutations("update", update);
		await openEditor();

		fireEvent.press(screen.getByLabelText("Next day"));
		fireEvent.press(screen.getByText("Save changes"));

		await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
		expect(update.mock.calls[0][0]).toMatchObject({
			date: shiftIsoDate(todayIsoDate(), 1),
		});
	});

	it("prevents duplicate saves and keeps the entry editable after a failure", async () => {
		// A non-`Error` rejection, so the assertion is on the localized fallback
		// text rather than convexErrorMessage's Convex-specific pass-through.
		const update = jest.fn().mockRejectedValue("offline");
		mockMutations("update", update);
		await openEditor();

		const button = screen.getByText("Save changes");
		fireEvent.press(button);
		fireEvent.press(button);

		expect(
			await screen.findByText(
				"This entry could not be updated. Your changes are still here.",
			),
		).toBeTruthy();
		expect(screen.getByText("Edit entry")).toBeTruthy();
		expect(update).toHaveBeenCalledTimes(1);
	});

	it("deletes only through a named, destructive confirmation", async () => {
		const remove = jest.fn().mockResolvedValue(undefined);
		mockMutations("remove", remove);
		await openEditor();

		fireEvent.press(screen.getByText("Delete entry"));

		expect(await screen.findByText("Delete this entry?")).toBeTruthy();
		expect(
			screen.getByText(
				`Apple will be removed from Lunch on ${formatLongDate(todayIsoDate(), "en")}.`,
			),
		).toBeTruthy();

		// Cancelling keeps the entry: no mutation, dialog gone.
		fireEvent.press(screen.getByText("Keep entry"));
		expect(screen.queryByText("Delete this entry?")).toBeNull();
		expect(remove).not.toHaveBeenCalled();

		fireEvent.press(screen.getByText("Delete entry"));
		await screen.findByText("Delete this entry?");
		// The dialog's own confirm button, appended after the screen in the tree.
		const confirmButtons = screen.getAllByText("Delete entry");
		fireEvent.press(confirmButtons[confirmButtons.length - 1]);

		await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
		expect(remove.mock.calls[0][0]).toMatchObject({ id: "entry-1" });
		expect(await screen.findByText("Today")).toBeTruthy();
	});

	it("keeps the entry visible and surfaces a recoverable error when delete fails", async () => {
		const remove = jest.fn().mockRejectedValue("offline");
		mockMutations("remove", remove);
		await openEditor();

		fireEvent.press(screen.getByText("Delete entry"));
		await screen.findByText("Delete this entry?");
		const confirmButtons = screen.getAllByText("Delete entry");
		fireEvent.press(confirmButtons[confirmButtons.length - 1]);

		expect(
			await screen.findByText(
				"This entry could not be deleted. It is still in your diary.",
			),
		).toBeTruthy();
		expect(screen.getByText("Edit entry")).toBeTruthy();
		expect(remove).toHaveBeenCalledTimes(1);
	});
});
