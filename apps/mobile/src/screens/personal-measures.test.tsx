import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
} from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

const mockUseMutation = jest.mocked(useMutation);
const mockUsePaginatedQuery = jest.mocked(usePaginatedQuery);
const mockUseConnectionState = jest.mocked(useConvexConnectionState);

afterEach(() => {
	mockUseConnectionState.mockReturnValue({
		isWebSocketConnected: true,
		hasInflightRequests: false,
		hasEverConnected: true,
		connectionCount: 1,
		connectionRetries: 0,
		timeOfOldestInflightRequest: null,
		inflightMutations: 0,
		inflightActions: 0,
	});
});

describe("Personal Measure management", () => {
	it("starts empty and creates the person's first exact measure", async () => {
		mockUsePaginatedQuery.mockReturnValue({
			results: [],
			status: "Exhausted",
			loadMore: jest.fn(),
		} as never);
		const create = jest.fn().mockResolvedValue({
			id: "measure-1",
			name: "Small glass",
			amount: 250,
			unit: "ml",
			order: 0,
		});
		mockUseMutation.mockImplementation(
			(reference) =>
				(getFunctionName(reference) === "personalMeasures:create"
					? create
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
		renderApp("/personal-measures");

		expect(await screen.findByText("No personal measures yet")).toBeTruthy();
		fireEvent.press(screen.getByText("Add personal measure"));
		fireEvent.changeText(screen.getByLabelText("Name"), "Small glass");
		fireEvent.changeText(screen.getByLabelText("Amount"), "250");
		fireEvent.press(screen.getByText("Millilitres"));
		fireEvent.press(screen.getByText("Save measure"));

		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				name: "Small glass",
				amount: 250,
				unit: "ml",
			}),
		);
		expect(await screen.findByText("Small glass")).toBeTruthy();
		expect(screen.getByText("250 ml")).toBeTruthy();
	});

	it("shows cached measures read-only while offline", async () => {
		mockUsePaginatedQuery.mockReturnValue({
			results: [
				{
					id: "measure-1",
					name: "Small glass",
					amount: 250,
					unit: "ml",
					order: 0,
				},
			],
			status: "Exhausted",
			loadMore: jest.fn(),
		} as never);
		mockUseConnectionState.mockReturnValue({
			isWebSocketConnected: false,
			hasInflightRequests: false,
			hasEverConnected: true,
			connectionCount: 0,
			connectionRetries: 1,
			timeOfOldestInflightRequest: null,
			inflightMutations: 0,
			inflightActions: 0,
		});

		renderApp("/personal-measures");

		expect(
			await screen.findByText("Connect to manage personal measures"),
		).toBeTruthy();
		expect(screen.getByText("Small glass")).toBeTruthy();
		expect(screen.queryByText("Add personal measure")).toBeNull();
		expect(screen.queryByText("Delete personal measure")).toBeNull();
	});

	it("warns before moving a measure to another unit", async () => {
		mockUsePaginatedQuery.mockReturnValue({
			results: [
				{
					id: "measure-1",
					name: "Scoop",
					amount: 35,
					unit: "g",
					order: 0,
				},
			],
			status: "Exhausted",
			loadMore: jest.fn(),
		} as never);
		renderApp("/personal-measures");

		fireEvent.press(await screen.findByText("Scoop"));
		fireEvent.press(screen.getByText("Millilitres"));

		expect(await screen.findByText("Change this measure's unit?")).toBeTruthy();
		expect(
			screen.getByText(
				"It will stop appearing for foods that use the previous unit. Past diary entries will not change.",
			),
		).toBeTruthy();
	});
});
