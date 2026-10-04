import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
	useQuery,
} from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { renderApp } from "../../../test-support/render-app";

const entry = {
	_id: "entry-1",
	meal: "lunch",
	name: { en: "Milk", nl: "Melk" },
	serving: { en: "Glass × 1.25", nl: "Glas × 1,25" },
	quantity: 1.25,
	amount: 187.5,
	baseUnit: "ml",
	provenance: { source: "oneOff" },
	nutrients: {
		energy: { kind: "value", amount: 86.25 },
		protein: { kind: "value", amount: 6.5625 },
	},
};
beforeEach(() => {
	jest
		.mocked(useQuery)
		.mockImplementation((ref, _args?) =>
			getFunctionName(ref).includes("Goals")
				? []
				: { entries: [entry], totals: {} },
		);
	jest.mocked(usePaginatedQuery).mockReturnValue({
		results: [],
		status: "Exhausted",
		loadMore: jest.fn(),
	} as never);
});
it("opens a real entry in Labs and preserves its exact amount when changing representation", async () => {
	const update = jest.fn().mockResolvedValue(undefined);
	jest
		.mocked(useMutation)
		.mockImplementation(
			(ref) =>
				(getFunctionName(ref) === "nutritionDiary:update"
					? update
					: jest.fn().mockResolvedValue(undefined)) as never,
		);
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	expect(await screen.findByDisplayValue("1.25")).toBeTruthy();
	fireEvent.press(screen.getByLabelText("Choose serving"));
	fireEvent.press(await screen.findByText("Millilitre (ml)"));
	expect(await screen.findByDisplayValue("187.5")).toBeTruthy();
	fireEvent.press(screen.getByLabelText("Save changes"));
	await waitFor(() => expect(update).toHaveBeenCalled());
	expect(update.mock.calls[0][0].selection.amount).toBe(187.5);
});
it("creates a Personal Measure independently and selects it at quantity one", async () => {
	const create = jest.fn().mockResolvedValue({
		id: "measure-1",
		name: "My mug",
		amount: 330,
		unit: "ml",
		order: 0,
	});
	jest
		.mocked(useMutation)
		.mockImplementation(
			(ref) =>
				(getFunctionName(ref) === "personalMeasures:create"
					? create
					: jest.fn()) as never,
		);
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	fireEvent.press(await screen.findByLabelText("Choose serving"));
	fireEvent.press(await screen.findByText("New serving"));
	fireEvent.changeText(await screen.findByLabelText("Name"), "My mug");
	fireEvent.changeText(screen.getByLabelText("Amount"), "330");
	fireEvent.press(screen.getByText("Add"));
	await waitFor(() =>
		expect(create).toHaveBeenCalledWith({
			name: "My mug",
			amount: 330,
			unit: "ml",
		}),
	);
	expect(await screen.findByDisplayValue("1")).toBeTruthy();
	expect(screen.getByText("330 ml")).toBeTruthy();
});
it("asks before discarding a dirty draft and retains it when editing continues", async () => {
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	fireEvent.changeText(await screen.findByLabelText("Quantity"), "2");
	fireEvent.press(screen.getByLabelText("Cancel"));
	fireEvent.press(await screen.findByText("Keep editing"));
	expect(screen.getByDisplayValue("2")).toBeTruthy();
	fireEvent.press(screen.getByLabelText("Cancel"));
	fireEvent.press(await screen.findByText("Discard changes"));
	expect(await screen.findByText("Diary Entry redesign")).toBeTruthy();
});
it("opens read-only product details and retains the entry draft on return", async () => {
	jest.mocked(useQuery).mockImplementation((ref, _args?) =>
		getFunctionName(ref).includes("Goals")
			? []
			: {
					entries: [
						{
							...entry,
							baseUnit: "g",
							provenance: {
								source: "shipped",
								sourceId: "shipped:apple-w-skin-av",
							},
						},
					],
					totals: {},
				},
	);
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	fireEvent.changeText(await screen.findByLabelText("Quantity"), "2");
	fireEvent.press(screen.getByLabelText("Product details"));
	expect(await screen.findByText("Apple")).toBeTruthy();
	expect(screen.queryByLabelText("Name")).toBeNull();
	fireEvent.press(screen.getByLabelText("Go back"));
	expect(await screen.findByDisplayValue("2")).toBeTruthy();
});
it("keeps cached supplementary Servings usable offline and prevents online-only creation", async () => {
	const connection = jest.mocked(useConvexConnectionState);
	const online = connection();
	jest.mocked(useQuery).mockImplementation((ref, _args?) =>
		getFunctionName(ref).includes("Goals")
			? []
			: {
					entries: [
						{
							...entry,
							baseUnit: "g",
							provenance: {
								source: "shipped",
								sourceId: "shipped:apple-w-skin-av",
							},
						},
					],
					totals: {},
				},
	);
	connection.mockReturnValue({ ...online, isWebSocketConnected: false });
	const create = jest.fn();
	jest.mocked(useMutation).mockReturnValue(create as never);
	const app = renderApp(
		"/labs-entry?id=entry-1&meal=lunch&date=2026-10-04",
		{},
		undefined,
		({ nutritionRepository }) => {
			nutritionRepository.putSupplementaryServings(
				"test-user",
				"shipped:apple-w-skin-av",
				[
					{
						id: "cached-1",
						foodId: "shipped:apple-w-skin-av",
						name: "My bowl",
						amount: 200,
						unit: "g",
					},
				],
			);
		},
	);
	fireEvent.press(await screen.findByLabelText("Choose serving"));
	fireEvent.press(await screen.findByText("My bowl"));
	expect(screen.getByDisplayValue("0.9375")).toBeTruthy();
	fireEvent.press(screen.getByLabelText("Choose serving"));
	fireEvent.press(await screen.findByText("New serving"));
	fireEvent.changeText(await screen.findByLabelText("Name"), "My plate");
	fireEvent.press(screen.getByText("Add"));
	expect(await screen.findByText(/Connect to add/)).toBeTruthy();
	expect(create).not.toHaveBeenCalled();
	expect(
		app.nutritionRepository.getSupplementaryServings(
			"another-user",
			"shipped:apple-w-skin-av",
		),
	).toEqual([]);
	connection.mockReturnValue(online);
});

it("moves an entry to a different meal and date through the diary operation", async () => {
	const update = jest.fn().mockResolvedValue(undefined);
	jest.mocked(useMutation).mockReturnValue(update as never);
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	fireEvent.press(await screen.findByLabelText("Meal"));
	fireEvent.press(await screen.findByText("Dinner"));
	fireEvent.press(screen.getByLabelText("Date"));
	fireEvent.press(await screen.findByText("Tomorrow"));
	fireEvent.press(screen.getByLabelText("Save changes"));
	await waitFor(() => expect(update).toHaveBeenCalled());
	expect(update.mock.calls[0][0]).toMatchObject({
		meal: "dinner",
		quantity: 1.25,
	});
	expect(update.mock.calls[0][0].date).not.toBe("2026-10-04");
});

it("retains invalid input and recovers after a failed creation", async () => {
	const create = jest.fn().mockRejectedValue(new Error("network unavailable"));
	jest.mocked(useMutation).mockReturnValue(create as never);
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	fireEvent.press(await screen.findByLabelText("Choose serving"));
	fireEvent.press(await screen.findByText("New serving"));
	fireEvent.press(screen.getByText("Add"));
	expect(await screen.findByText(/Enter a name/)).toBeTruthy();
	expect(create).not.toHaveBeenCalled();
	fireEvent.changeText(screen.getByLabelText("Name"), "Travel mug");
	fireEvent.press(screen.getByText("Add"));
	expect(await screen.findByText(/Could not add/)).toBeTruthy();
	expect(screen.getByDisplayValue("Travel mug")).toBeTruthy();
	create.mockResolvedValue({
		id: "measure-2",
		name: "Travel mug",
		amount: 250,
		unit: "ml",
		order: 0,
	});
	fireEvent.press(screen.getByText("Add"));
	expect(await screen.findByDisplayValue("1")).toBeTruthy();
	expect(screen.getByText("250 ml")).toBeTruthy();
});

it("closes a clean entry without asking and cancels creation without a write", async () => {
	const create = jest.fn();
	jest.mocked(useMutation).mockReturnValue(create as never);
	renderApp("/labs-entry?id=entry-1&meal=lunch&date=2026-10-04");
	fireEvent.press(await screen.findByLabelText("Choose serving"));
	fireEvent.press(await screen.findByText("New serving"));
	fireEvent.changeText(screen.getByLabelText("Name"), "Abandoned mug");
	fireEvent.press(screen.getAllByLabelText("Cancel")[1]);
	expect(screen.queryByDisplayValue("Abandoned mug")).toBeNull();
	fireEvent.press(screen.getByLabelText("Cancel"));
	expect(await screen.findByText("Diary Entry redesign")).toBeTruthy();
	expect(screen.queryByText("Discard changes?")).toBeNull();
	expect(create).not.toHaveBeenCalled();
});
