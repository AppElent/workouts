import { act, render } from "@testing-library/react-native";
import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
} from "convex/react";
import { AppState, Text } from "react-native";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { createNutritionDraftRepository } from "./nutrition-draft-repository";
import {
	NutritionDraftsProvider,
	useNutritionDrafts,
} from "./nutrition-drafts";
import { createNutritionLocalRepository } from "./nutrition-local-repository";
import { NutritionOperationsProvider } from "./nutrition-operation-service";

describe("Capture Draft online save", () => {
	it("manual upload joins an automatic saved-note migration and reports completion only after acknowledgement", async () => {
		const repository = createNutritionDraftRepository(new SQLiteTestDatabase());
		const original = repository.create("alice", {
			date: "2026-10-07",
			meal: "lunch",
			note: "Local soup",
		});
		let acknowledge!: (draft: typeof original) => void;
		jest.mocked(useMutation).mockReturnValue(
			jest.fn(
				() =>
					new Promise((resolve) => {
						acknowledge = resolve;
					}),
			) as never,
		);
		jest
			.mocked(useConvexConnectionState)
			.mockReturnValue({ isWebSocketConnected: true } as never);
		let notes!: ReturnType<typeof useNutritionDrafts>;
		function Reader() {
			notes = useNutritionDrafts();
			return <Text>Notes</Text>;
		}
		const view = render(
			<NutritionOperationsProvider
				subject="alice"
				repository={createNutritionLocalRepository(new SQLiteTestDatabase())}
			>
				<NutritionDraftsProvider repository={repository}>
					<Reader />
				</NutritionDraftsProvider>
			</NutritionOperationsProvider>,
		);
		let complete = false;
		const upload = notes.uploadPending().then(() => {
			complete = true;
		});
		await Promise.resolve();
		expect(complete).toBe(false);
		await act(async () => {
			acknowledge(original);
			await upload;
		});
		expect(notes.pendingMigrationCount).toBe(0);
		expect(repository.get("alice", original.id)).toEqual(original);
		view.unmount();
	});
	it("retries an interrupted legacy upload with the same identity and retains the original", async () => {
		const repository = createNutritionDraftRepository(new SQLiteTestDatabase());
		const original = repository.create("alice", {
			date: "2026-10-07",
			meal: "lunch",
			note: "Legacy soup",
		});
		const operations = createNutritionLocalRepository(new SQLiteTestDatabase());
		const remote = jest
			.fn()
			.mockRejectedValueOnce(new Error("Disconnected after sending"))
			.mockResolvedValue({ ...original, updatedAt: 20 });
		jest.mocked(useMutation).mockReturnValue(remote as never);
		jest
			.mocked(useConvexConnectionState)
			.mockReturnValue({ isWebSocketConnected: true } as never);
		let notes!: ReturnType<typeof useNutritionDrafts>;
		function Reader() {
			notes = useNutritionDrafts();
			return <Text>{notes.migrationError ?? "Ready"}</Text>;
		}
		const tree = (
			<NutritionOperationsProvider subject="alice" repository={operations}>
				<NutritionDraftsProvider repository={repository}>
					<Reader />
				</NutritionDraftsProvider>
			</NutritionOperationsProvider>
		);
		const screen = render(tree);
		await act(async () => {
			await Promise.resolve();
		});
		expect(repository.pendingMigrations("alice")).toEqual([original]);
		expect(notes.migrationError).toContain("Disconnected");
		await act(async () => {
			notes.retryMigration();
			await Promise.resolve();
		});
		expect(remote.mock.calls[1][0]).toEqual(remote.mock.calls[0][0]);
		expect(repository.pendingMigrations("alice")).toEqual([]);
		expect(repository.get("alice", original.id)).toEqual(original);
		expect(repository.pendingMigrations("bob")).toEqual([]);
		screen.unmount();
	});

	it("keeps unsaved input out of saved notes until acknowledgement and rejects disconnected saves", async () => {
		const repository = createNutritionDraftRepository(new SQLiteTestDatabase());
		const operations = createNutritionLocalRepository(new SQLiteTestDatabase());
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
			<NutritionOperationsProvider subject="alice" repository={operations}>
				<NutritionDraftsProvider repository={repository}>
					<Reader />
				</NutritionDraftsProvider>
			</NutritionOperationsProvider>
		);
		const screen = render(tree);
		let pending!: Promise<unknown>;
		act(() => {
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
		screen.rerender(
			<NutritionOperationsProvider subject="alice" repository={operations}>
				<NutritionDraftsProvider repository={repository}>
					<Reader />
				</NutritionDraftsProvider>
			</NutritionOperationsProvider>,
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
	const view = render(
		<NutritionOperationsProvider
			subject="alice"
			repository={createNutritionLocalRepository(new SQLiteTestDatabase())}
		>
			<NutritionDraftsProvider
				repository={createNutritionDraftRepository(new SQLiteTestDatabase())}
			>
				<Reader />
			</NutritionDraftsProvider>
		</NutritionOperationsProvider>,
	);
	expect(view.getByText("Soup")).toBeTruthy();
	act(() => change("background"));
	expect(notes.listForDate(draft.date)).toEqual([draft]);
	act(() => change("active"));
	expect(view.getByText("Soup")).toBeTruthy();
	view.unmount();
});
