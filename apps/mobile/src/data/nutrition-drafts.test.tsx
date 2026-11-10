import { act, render } from "@testing-library/react-native";
import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
} from "convex/react";
import { AppState, Text } from "react-native";
import { AccountWriteProvider } from "./account-write";
import {
	NutritionDraftsProvider,
	useNutritionDrafts,
} from "./nutrition-drafts";

describe("Capture Draft online save", () => {
	it("keeps unsaved input out of saved notes until acknowledgement and rejects disconnected saves", async () => {
		let connected = true;
		jest
			.mocked(useConvexConnectionState)
			.mockImplementation(() => ({ isWebSocketConnected: connected }) as never);
		let acknowledge!: (draft: {
			id: string;
			subject: string;
			date: string;
			meal: "lunch";
			note: string;
			createdAt: number;
			updatedAt: number;
		}) => void;
		const saveRemote = jest.fn(
			() =>
				new Promise((resolve) => {
					acknowledge = resolve;
				}),
		);
		jest.mocked(useMutation).mockReturnValue(saveRemote as never);
		let notes!: ReturnType<typeof useNutritionDrafts>;
		function Reader() {
			notes = useNutritionDrafts({
				startDate: "2026-10-07",
				endDate: "2026-10-07",
			});
			return (
				<Text>
					{notes
						.listForDate("2026-10-07")
						.map((d) => d.note)
						.join(", ") || "Empty"}
				</Text>
			);
		}
		const tree = (
			<AccountWriteProvider subject="alice">
				<NutritionDraftsProvider>
					<Reader />
				</NutritionDraftsProvider>
			</AccountWriteProvider>
		);
		const screen = await render(tree);
		let pending!: Promise<unknown>;
		await act(() => {
			pending = notes.create({
				date: "2026-10-07",
				meal: "lunch",
				note: "Soup",
			});
		});
		expect(screen.getByText("Empty")).toBeTruthy();
		await act(async () => {
			acknowledge({
				id: "note",
				subject: "alice",
				date: "2026-10-07",
				meal: "lunch",
				note: "Soup",
				createdAt: 1,
				updatedAt: 1,
			});
			await pending;
		});
		expect(screen.getByText("Soup")).toBeTruthy();
		connected = false;
		await await screen.rerender(
			<AccountWriteProvider subject="alice">
				<NutritionDraftsProvider>
					<Reader />
				</NutritionDraftsProvider>
			</AccountWriteProvider>,
		);
		await expect(
			notes.create({
				date: "2026-10-07",
				meal: "lunch",
				note: "Retry this input",
			}),
		).rejects.toThrow("connection");
		expect(notes.listForDate("2026-10-07")).toHaveLength(1);
	});
});

it("retains acknowledged notes while a date subscription is skipped in the background", async () => {
	const draft = {
		id: "saved",
		subject: "alice",
		date: "2026-10-07",
		meal: "lunch",
		note: "Soup",
		createdAt: 1,
		updatedAt: 1,
	};
	jest.mocked(usePaginatedQuery).mockImplementation(
		(_ref, args) =>
			({
				results: args === "skip" ? [] : [draft],
				status: "Exhausted",
				loadMore: jest.fn(),
			}) as never,
	);
	let change!: (state: "background" | "active") => void;
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, listener) => {
			change = listener;
			return { remove: jest.fn() };
		});
	let notes!: ReturnType<typeof useNutritionDrafts>;
	function Reader() {
		notes = useNutritionDrafts({ startDate: draft.date, endDate: draft.date });
		return (
			<Text>
				{notes
					.listForDate(draft.date)
					.map((d) => d.note)
					.join(",")}
			</Text>
		);
	}
	const view = await render(
		<AccountWriteProvider subject="alice">
			<NutritionDraftsProvider>
				<Reader />
			</NutritionDraftsProvider>
		</AccountWriteProvider>,
	);
	expect(view.getByText("Soup")).toBeTruthy();
	await act(() => change("background"));
	expect(notes.listForDate(draft.date)).toEqual([draft]);
	await act(() => change("active"));
	expect(view.getByText("Soup")).toBeTruthy();
	await view.unmount();
});
