/**
 * The rules spec #68 puts on gestures, checked at the diary row.
 *
 * The whole point of these three is that a gesture is never load-bearing:
 *
 * - Delete reached through an accelerator still asks first. A swipe that could
 *   fling past the confirmation would be a swipe that could delete by accident.
 * - Every accelerator's action exists somewhere visible. Tapping the row opens
 *   the editor, and the editor carries its own Delete.
 * - A screen reader, which cannot swipe or long-press, gets the same actions as
 *   named custom actions on the row itself.
 *
 * Nothing here drives a pan gesture. What a 40pt drag does to a transform is
 * the component's business; what the user can and cannot reach is the contract.
 */
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

const value = (amount: number) => ({ kind: "value" as const, amount });

const oatmeal = {
	_id: "entry-1",
	meal: "breakfast" as const,
	name: { en: "Oatmeal", nl: "Havermout" },
	serving: { en: "Bowl × 1", nl: "Kom × 1" },
	quantity: 1,
	nutrients: {
		energy: value(180),
		protein: value(6),
		carbs: value(30),
		fat: value(3),
		saturatedFat: value(0.6),
		fibre: value(4),
		sugars: value(1),
		salt: value(0.01),
	},
};

const remove = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
	jest.clearAllMocks();
	remove.mockResolvedValue(undefined);
	jest.mocked(useQuery).mockImplementation((reference, _args?) => {
		if (getFunctionName(reference) === "nutritionGoals:list") return [];
		return { entries: [oatmeal], totals: {} };
	});
	jest
		.mocked(useMutation)
		.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "nutritionDiary:remove"
					? remove
					: jest.fn().mockResolvedValue(undefined)) as unknown as ReturnType<
					typeof useMutation
				>,
		);
});

/** The confirm dialog is appended after the screen, so its button is the last. */
function pressConfirm(label: string) {
	const buttons = screen.getAllByText(label);
	fireEvent.press(buttons[buttons.length - 1]);
}

describe("diary row accelerators", () => {
	it("asks before deleting an entry reached through the revealed swipe action", async () => {
		renderApp();
		// The revealed action is in the tree behind the row from the start; the
		// swipe uncovers it rather than creating it.
		fireEvent.press(await screen.findByLabelText("Delete"));

		expect(await screen.findByText("Delete this entry?")).toBeTruthy();
		expect(remove).not.toHaveBeenCalled();

		pressConfirm("Delete entry");
		await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
		expect(remove.mock.calls[0][0]).toMatchObject({ id: "entry-1" });
	});

	it("removes nothing when the confirmation is declined", async () => {
		renderApp();
		fireEvent.press(await screen.findByLabelText("Delete"));
		await screen.findByText("Delete this entry?");
		fireEvent.press(screen.getByText("Keep entry"));

		await waitFor(() =>
			expect(screen.queryByText("Delete this entry?")).toBeNull(),
		);
		expect(remove).not.toHaveBeenCalled();
	});

	it("offers the same actions to a long press as it does to a swipe", async () => {
		renderApp();
		const row = await screen.findByLabelText("Edit entry: Oatmeal");
		// Before the long press, each action exists once — behind the row.
		expect(screen.getAllByLabelText("Edit")).toHaveLength(1);
		expect(screen.getAllByLabelText("Delete")).toHaveLength(1);
		expect(screen.queryByLabelText("Close")).toBeNull();

		fireEvent(row, "longPress");

		// The menu offers the same two verbs and a way out of it.
		expect(await screen.findByLabelText("Close")).toBeTruthy();
		expect(screen.getAllByLabelText("Edit")).toHaveLength(2);
		expect(screen.getAllByLabelText("Delete")).toHaveLength(2);
	});

	it("gives a screen reader the row's actions without any gesture", async () => {
		renderApp();
		const row = await screen.findByLabelText("Edit entry: Oatmeal");

		expect(row.props.accessibilityActions).toEqual([
			{ name: "edit", label: "Edit" },
			{ name: "delete", label: "Delete" },
		]);

		// Invoking the custom delete action lands on the same confirmation.
		fireEvent(row, "accessibilityAction", {
			nativeEvent: { actionName: "delete" },
		});
		expect(await screen.findByText("Delete this entry?")).toBeTruthy();
		expect(remove).not.toHaveBeenCalled();
	});

	it("keeps a visible non-gesture route to both actions", async () => {
		renderApp();
		// A plain tap — no gesture — opens the editor.
		fireEvent.press(await screen.findByLabelText("Edit entry: Oatmeal"));

		expect(await screen.findByText("Edit entry")).toBeTruthy();
		// …which carries its own visible Delete, so neither action depends on
		// knowing that a swipe or a long press exists.
		expect(screen.getByText("Delete entry")).toBeTruthy();
	});
});
