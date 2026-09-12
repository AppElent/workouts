import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { OFFLINE_GRACE_MS } from "../data/stalled-offline";
import { renderApp } from "../test-support/render-app";

const mockUseQuery = jest.mocked(useQuery);
const mockUseMutation = jest.mocked(useMutation);
const mockUseConvexConnectionState = jest.mocked(useConvexConnectionState);
const asMutation = (fn: jest.Mock) =>
	fn as unknown as ReturnType<typeof useMutation>;
const emptyGoals: never[] = [];

describe("nutrition goal editor", () => {
	beforeEach(() => {
		mockUseConvexConnectionState.mockReturnValue({
			isWebSocketConnected: true,
		} as ReturnType<typeof useConvexConnectionState>);
		mockUseQuery.mockImplementation((reference, _args?) => {
			const name = getFunctionName(reference);
			if (name === "nutritionGoals:forDate") {
				return { goals: emptyGoals, basis: "reference", effectiveFrom: null };
			}
			if (name === "nutritionDiary:day") {
				return { entries: [], totals: {}, revision: 0 };
			}
			return emptyGoals;
		});
		mockUseMutation.mockReturnValue(
			asMutation(jest.fn().mockResolvedValue(undefined)),
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("opens from the day and applies a disclosed static preset", async () => {
		renderApp();
		fireEvent.press(await screen.findByText("Set up goals"));
		expect(await screen.findByText("Your nutrition goals")).toBeTruthy();
		fireEvent.press(screen.getByText("Reference intake"));
		expect(screen.getByText(/EU Regulation 1169\/2011/)).toBeTruthy();
		expect(
			screen.getByLabelText("Energy Maximum Daily amount").props.value,
		).toBe("2000");
	});

	it("clears preset provenance when a copied value is edited and saves all eight bounds", async () => {
		const save = jest.fn().mockResolvedValue(undefined);
		mockUseMutation.mockReturnValue(asMutation(save));
		renderApp("/nutrition-goals");
		await screen.findByText("Your nutrition goals");
		fireEvent.press(screen.getByText("Build muscle"));
		fireEvent.changeText(
			screen.getByLabelText("Protein Minimum Daily amount"),
			"110",
		);
		expect(screen.getByText("1 edited")).toBeTruthy();
		fireEvent.press(screen.getByText("Save goals"));
		await waitFor(() => expect(save).toHaveBeenCalled());
		const goals = save.mock.calls[0][0].goals;
		expect(goals).toHaveLength(8);
		expect(
			goals.find((goal: { nutrient: string }) => goal.nutrient === "protein")
				.sourcePreset,
		).toBeUndefined();
		expect(
			goals.find((goal: { nutrient: string }) => goal.nutrient === "energy")
				.sourcePreset,
		).toBe("buildMuscle");
	});

	it("keeps input and reports a failed save", async () => {
		mockUseMutation.mockReturnValue(
			asMutation(jest.fn().mockRejectedValue(new Error("offline"))),
		);
		renderApp("/nutrition-goals");
		await screen.findByText("Your nutrition goals");
		fireEvent.changeText(
			screen.getByLabelText("Energy Minimum Daily amount"),
			"1234",
		);
		fireEvent.press(screen.getByText("Save goals"));
		expect(
			await screen.findByText(
				"Your goals could not be saved. Your changes are still here.",
			),
		).toBeTruthy();
		expect(
			screen.getByLabelText("Energy Minimum Daily amount").props.value,
		).toBe("1234");
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
		await screen.findByText("Your nutrition goals");
		fireEvent.changeText(
			screen.getByLabelText("Energy Minimum Daily amount"),
			"1234",
		);
		const saveButton = screen.getByText("Save goals");
		fireEvent.press(saveButton);
		fireEvent.press(saveButton);

		expect(save).toHaveBeenCalledTimes(1);
		resolveSave();
		await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
	});
});
