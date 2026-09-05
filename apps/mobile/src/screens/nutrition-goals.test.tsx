import { useMutation, useQuery } from "convex/react";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

const mockUseQuery = jest.mocked(useQuery);
const mockUseMutation = jest.mocked(useMutation);
const asMutation = (fn: jest.Mock) =>
	fn as unknown as ReturnType<typeof useMutation>;

describe("nutrition goal editor", () => {
	beforeEach(() => {
		mockUseQuery.mockReturnValue([]);
		mockUseMutation.mockReturnValue(
			asMutation(jest.fn().mockResolvedValue(undefined)),
		);
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
});
