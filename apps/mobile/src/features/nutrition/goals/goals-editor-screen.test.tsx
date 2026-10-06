import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { OFFLINE_GRACE_MS } from "../../../data/stalled-offline";
import { renderApp } from "../../../test-support/render-app";

const mockUseQuery = jest.mocked(useQuery);
const mockUseMutation = jest.mocked(useMutation);
const mockUseConvexConnectionState = jest.mocked(useConvexConnectionState);
const asMutation = (fn: jest.Mock) =>
	fn as unknown as ReturnType<typeof useMutation>;

type Goal = {
	nutrient: string;
	direction: "min" | "max";
	target: number;
	sourcePreset?: string;
};

function serveGoals(goals: Goal[], extra: Record<string, unknown> = {}) {
	mockUseQuery.mockImplementation((reference, _args?) => {
		const name = getFunctionName(reference);
		if (name === "nutritionGoals:forDate")
			return {
				goals,
				basis: goals.length ? "effective" : "reference",
				effectiveFrom: goals.length ? "2026-09-12" : null,
				nextEffectiveFrom: null,
				displayOrder: [],
				...extra,
			};
		if (name === "nutritionDiary:day")
			return { entries: [], totals: {}, revision: 0 };
		return [];
	});
}

const saved: Goal[] = [
	{ nutrient: "energy", direction: "min", target: 2300 },
	{ nutrient: "energy", direction: "max", target: 2700 },
	{ nutrient: "protein", direction: "min", target: 120 },
	{ nutrient: "fat", direction: "max", target: 80 },
];

describe("nutrition goal editor", () => {
	beforeEach(() => {
		mockUseConvexConnectionState.mockReturnValue({
			isWebSocketConnected: true,
		} as ReturnType<typeof useConvexConnectionState>);
		serveGoals(saved);
		mockUseMutation.mockReturnValue(
			asMutation(jest.fn().mockResolvedValue(undefined)),
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("starts without goals from a chosen starting point and saves its provenance", async () => {
		serveGoals([]);
		const save = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(asMutation(save));
		renderApp("/nutrition-goals");

		fireEvent.press(await screen.findByText("Choose a starting point"));
		fireEvent.press(screen.getByLabelText(/^Build muscle,/));
		expect(screen.getByText("Build muscle applied")).toBeTruthy();
		expect(screen.getByLabelText("Protein minimum").props.value).toBe("100");

		fireEvent.press(screen.getByLabelText("Save goals"));
		await waitFor(() => expect(save).toHaveBeenCalled());
		const goals = save.mock.calls[0][0].goals as Goal[];
		expect(goals).toHaveLength(8);
		expect(goals.every((goal) => goal.sourcePreset === "buildMuscle")).toBe(
			true,
		);
	});

	it("keeps ✓ off until something changes", async () => {
		renderApp("/nutrition-goals");
		expect(await screen.findByLabelText("Save goals")).toBeDisabled();
		fireEvent.changeText(screen.getByLabelText("Fat maximum"), "75");
		expect(screen.getByLabelText("Save goals")).not.toBeDisabled();
	});

	it("replaces the number on the first keystroke and keeps it when left untouched", async () => {
		renderApp("/nutrition-goals");
		const protein = await screen.findByLabelText("Protein minimum");
		fireEvent(protein, "focus");
		expect(screen.getByLabelText("Protein minimum").props.value).toBe("");
		expect(screen.getByLabelText("Protein minimum").props.placeholder).toBe(
			"120",
		);
		fireEvent(screen.getByLabelText("Protein minimum"), "blur");
		expect(screen.getByLabelText("Protein minimum").props.value).toBe("120");
		expect(screen.getByLabelText("Save goals")).toBeDisabled();

		fireEvent(screen.getByLabelText("Protein minimum"), "focus");
		fireEvent.changeText(screen.getByLabelText("Protein minimum"), "13");
		fireEvent(screen.getByLabelText("Protein minimum"), "blur");
		expect(screen.getByLabelText("Protein minimum").props.value).toBe("13");
	});

	it("changes a goal's kind from its menu", async () => {
		renderApp("/nutrition-goals");
		fireEvent.press(await screen.findByLabelText("Goal type for Protein"));
		fireEvent.press(screen.getAllByText("Range").at(-1) as never);
		expect(screen.getByLabelText("Protein minimum").props.value).toBe("120");
		expect(screen.getByLabelText("Protein maximum").props.value).toBe("120");
	});

	it("adds a nutrient at its reference value in its default direction", async () => {
		renderApp("/nutrition-goals");
		expect(await screen.findByText("reference max. 20 g")).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Add Saturated fat goal"));
		expect(screen.getByLabelText("Saturated fat maximum").props.value).toBe(
			"20",
		);
	});

	it("shows a crossed range inline and does not save", async () => {
		const save = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(asMutation(save));
		renderApp("/nutrition-goals");
		fireEvent.changeText(
			await screen.findByLabelText("Energy minimum"),
			"2800",
		);
		fireEvent.press(screen.getByLabelText("Save goals"));
		expect(
			await screen.findByText("Minimum is higher than maximum."),
		).toBeTruthy();
		expect(screen.getByText("1 goal needs a fix")).toBeTruthy();
		expect(save).not.toHaveBeenCalled();
	});

	it("removes every goal in the draft with undo", async () => {
		renderApp("/nutrition-goals");
		fireEvent.press(await screen.findByText("Remove all goals"));
		expect(
			screen.getByText("No goals. The diary shows totals only."),
		).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Undo"));
		expect(screen.getByLabelText("Fat maximum").props.value).toBe("80");
	});

	it("says which days a backdated change covers", async () => {
		serveGoals(saved, { nextEffectiveFrom: null });
		renderApp("/nutrition-goals?date=2026-09-28");
		expect(
			await screen.findByText(/Also applies to .*28.* through today\./),
		).toBeTruthy();
		expect(screen.getByText(/Opened from the diary of/)).toBeTruthy();
	});

	it("keeps input and offers a retry when saving fails", async () => {
		mockUseMutation.mockReturnValue(
			asMutation(jest.fn().mockRejectedValue(new Error("offline"))),
		);
		renderApp("/nutrition-goals");
		fireEvent.changeText(await screen.findByLabelText("Fat maximum"), "75");
		fireEvent.press(screen.getByLabelText("Save goals"));
		expect(
			await screen.findByText(
				"Your goals could not be saved. Your changes are still here.",
			),
		).toBeTruthy();
		expect(screen.getByLabelText("Retry")).toBeTruthy();
		expect(screen.getByLabelText("Fat maximum").props.value).toBe("75");
	});

	it("shows a localized retry state when goals stall offline", async () => {
		jest.useFakeTimers();
		mockUseConvexConnectionState.mockReturnValue({
			isWebSocketConnected: false,
		} as ReturnType<typeof useConvexConnectionState>);
		mockUseQuery.mockReturnValue(undefined);

		renderApp("/nutrition-goals");
		await act(async () => {
			jest.advanceTimersByTime(OFFLINE_GRACE_MS);
		});

		expect(
			await screen.findByText("Your goals are not available offline yet."),
		).toBeTruthy();
		expect(screen.getByText("Try again")).toBeTruthy();
	});

	it("submits at most once while a save is in flight", async () => {
		let resolveSave!: () => void;
		const save = jest.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				}),
		);
		mockUseMutation.mockReturnValue(asMutation(save));
		renderApp("/nutrition-goals");
		fireEvent.changeText(await screen.findByLabelText("Fat maximum"), "75");
		const saveButton = screen.getByLabelText("Save goals");
		fireEvent.press(saveButton);
		fireEvent.press(saveButton);

		expect(save).toHaveBeenCalledTimes(1);
		await act(async () => resolveSave());
	});
});
