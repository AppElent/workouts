import { useAuth } from "@clerk/expo";
import { act, render, waitFor } from "@testing-library/react-native";
import { foodResults, type NutrientValue } from "@workouts/core/nutrition";
import {
	useConvex,
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
	useQueries,
	useQuery,
} from "convex/react";
import { Text } from "react-native";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createNutritionLibraryStateRepository,
	libraryRecordFromFood,
} from "./nutrition-library-repository";
import type { NutritionLibraryOperationEnvelope } from "./nutrition-library-service";
import {
	createPersonalFoodRepository,
	type PersonalFoodDraft,
} from "./personal-food-repository";
import { PersonalFoodsProvider, usePersonalFoods } from "./personal-foods";

jest.mock("@clerk/expo", () => ({
	useAuth: jest.fn(() => ({ isSignedIn: true, userId: "account-a" })),
}));

const draft: PersonalFoodDraft = {
	name: { en: "Prepared oats", nl: "Voorbereide haver" },
	baseUnit: "g",
	nutrients: {
		energy: { kind: "value", amount: 12 },
		protein: { kind: "trace" },
		carbs: { kind: "absent" },
		fat: { kind: "value", amount: 1 },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "trace" },
		sugars: { kind: "value", amount: 2 },
		salt: { kind: "value", amount: 0.1 },
	} satisfies Record<string, NutrientValue>,
	servings: [],
	provenance: {
		recordOrigin: "personal",
		nutritionSource: "manual",
		locallyEdited: false,
	},
};

beforeEach(() => {
	jest
		.mocked(useAuth)
		.mockReturnValue({ isSignedIn: true, userId: "account-a" } as never);
	jest
		.mocked(useConvexConnectionState)
		.mockReturnValue({ isWebSocketConnected: true } as never);
});

describe("PersonalFoodsProvider library journal", () => {
	it("resumes an explicit device claim after local interruption without recopying acknowledged records", async () => {
		jest
			.mocked(useAuth)
			.mockReturnValue({ isSignedIn: true, userId: "account-a" } as never);
		jest
			.mocked(useConvexConnectionState)
			.mockReturnValue({ isWebSocketConnected: true } as never);
		const original = createPersonalFoodRepository(new SQLiteTestDatabase());
		const food = original.create(draft);
		const cache = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const remote = jest.fn(
			async (envelope: NutritionLibraryOperationEnvelope) => {
				if (envelope.operation.kind !== "upsert")
					throw new Error("Expected upsert");
				return {
					record: { ...envelope.operation.record, revision: 1, deleted: false },
				};
			},
		);
		jest.mocked(useMutation).mockReturnValue(remote as never);
		let value!: ReturnType<typeof usePersonalFoods>;
		function Reader() {
			value = usePersonalFoods();
			return <Text>{value.account.hasLegacy ? "Claim" : "Owned"}</Text>;
		}
		const screen = render(
			<PersonalFoodsProvider
				repository={cache}
				legacyRepository={original}
				libraryState={state}
			>
				<Reader />
			</PersonalFoodsProvider>,
		);
		jest.spyOn(cache, "replaceFromBackup").mockImplementationOnce(() => {
			throw new Error("Local interruption");
		});
		expect(() => value.account.importLegacy()).toThrow("Local interruption");
		expect(state.legacyClaimedBy()).toBe("account-a");
		expect(original.find(food.id)).toEqual(food);
		await act(async () => {
			value.account.importLegacy();
			await Promise.resolve();
		});
		await waitFor(() => expect(state.listOperations("account-a")).toEqual([]));
		expect(cache.find(`device:${food.id}`)?.name.en).toBe("Prepared oats");
		await act(async () => {
			value.account.importLegacy();
			await Promise.resolve();
		});
		expect(remote).toHaveBeenCalledTimes(1);
		expect(original.find(food.id)).toEqual(food);
		expect(state.claimLegacy("account-b")).toBe(false);
		screen.unmount();
	});
	it("loads the visible library without opening settings", async () => {
		jest.mocked(useMutation).mockReturnValue(jest.fn() as never);
		jest
			.mocked(useAuth)
			.mockReturnValue({ isSignedIn: true, userId: "account-a" } as never);
		const previousQuery = jest
			.mocked(usePaginatedQuery)
			.getMockImplementation();
		const remoteFoods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const remoteFood = remoteFoods.create(draft);
		const page = {
			page: [libraryRecordFromFood(remoteFood, 1)],
			isDone: true,
			continueCursor: "",
		};
		jest.mocked(usePaginatedQuery).mockReturnValue({
			results: page.page,
			status: "Exhausted",
			loadMore: jest.fn(),
			isLoading: false,
		} as never);
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		state.setEnabled("account-a", true);
		function Reader() {
			const personal = usePersonalFoods({ browse: {} });
			return (
				<Text>
					{personal
						.list()
						.map((food) => food.name.en)
						.join(", ")}
				</Text>
			);
		}
		try {
			const screen = render(
				<PersonalFoodsProvider repository={foods} libraryState={state}>
					<Reader />
				</PersonalFoodsProvider>,
			);
			await waitFor(() =>
				expect(screen.getByText("Prepared oats")).toBeTruthy(),
			);
			expect(foods.list()).toHaveLength(1);
		} finally {
			if (previousQuery)
				jest.mocked(usePaginatedQuery).mockImplementation(previousQuery);
		}
	});

	it("ordinary saves await the server and disconnected input stays unsaved", async () => {
		jest
			.mocked(useAuth)
			.mockReturnValue({ isSignedIn: true, userId: "account-a" } as never);
		let connected = true;
		jest
			.mocked(useConvexConnectionState)
			.mockImplementation(() => ({ isWebSocketConnected: connected }) as never);
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		let acknowledge!: (result: {
			record: ReturnType<typeof libraryRecordFromFood>;
		}) => void;
		const remote = jest.fn(
			(_envelope: NutritionLibraryOperationEnvelope) =>
				new Promise<{ record: ReturnType<typeof libraryRecordFromFood> }>(
					(resolve) => {
						acknowledge = resolve;
					},
				),
		);
		jest.mocked(useMutation).mockReturnValue(remote as never);
		let value!: ReturnType<typeof usePersonalFoods>;
		function Reader() {
			value = usePersonalFoods();
			return (
				<Text>
					{value
						.list()
						.map((food) => food.name.en)
						.join(", ") || "Empty"}
				</Text>
			);
		}
		const screen = render(
			<PersonalFoodsProvider repository={foods} libraryState={state}>
				<Reader />
			</PersonalFoodsProvider>,
		);
		let save!: Promise<unknown>;
		act(() => {
			save = value.create(draft);
		});
		expect(screen.getByText("Empty")).toBeTruthy();
		expect(state.listOperations("account-a")).toEqual([]);
		const envelope = remote.mock.calls[0][0];
		if (envelope.operation.kind !== "upsert")
			throw new Error("Expected upsert");
		const record = envelope.operation.record;
		await act(async () => {
			acknowledge({ record: { ...record, revision: 1, deleted: false } });
			await save;
		});
		expect(screen.getByText("Prepared oats")).toBeTruthy();
		connected = false;
		screen.rerender(
			<PersonalFoodsProvider repository={foods} libraryState={state}>
				<Reader />
			</PersonalFoodsProvider>,
		);
		await expect(value.create(draft)).rejects.toThrow("connection");
		expect(value.list()).toHaveLength(1);
		expect(state.listOperations("account-a")).toEqual([]);
	});
});

it("keeps a newer subscription revision when an older save acknowledgement arrives", async () => {
	const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
	const state = createNutritionLibraryStateRepository(new SQLiteTestDatabase());
	const original = foods.create(draft);
	state.commitServerRecord("account-a", libraryRecordFromFood(original, 1));
	let acknowledge!: (result: {
		record: ReturnType<typeof libraryRecordFromFood>;
	}) => void;
	jest.mocked(useMutation).mockReturnValue(
		jest.fn(
			() =>
				new Promise((resolve) => {
					acknowledge = resolve;
				}),
		) as never,
	);
	let value!: ReturnType<typeof usePersonalFoods>;
	function Reader() {
		value = usePersonalFoods();
		return <Text>{value.find(original.id)?.name.en}</Text>;
	}
	const view = render(
		<PersonalFoodsProvider repository={foods} libraryState={state}>
			<Reader />
		</PersonalFoodsProvider>,
	);
	let pending!: Promise<unknown>;
	act(() => {
		pending = value.update(original.id, {
			...draft,
			name: { en: "Older edit", nl: "Older edit" },
		});
	});
	const latest = { ...original, name: { en: "Newer edit", nl: "Newer edit" } };
	act(() =>
		value.account.receiveServerPage([libraryRecordFromFood(latest, 3)]),
	);
	await act(async () => {
		acknowledge({
			record: libraryRecordFromFood(
				{ ...original, name: { en: "Older edit", nl: "Older edit" } },
				2,
			),
		});
		await pending;
	});
	expect(view.getByText("Newer edit")).toBeTruthy();
	expect(state.getRecord("account-a", original.id)?.revision).toBe(3);
	view.unmount();
});
it("does not return a cached barcode after the server removes it", async () => {
	const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
	const food = foods.create({
		...draft,
		provenance: { ...draft.provenance, barcode: "12345678" },
	});
	const state = createNutritionLibraryStateRepository(new SQLiteTestDatabase());
	state.commitServerRecord("account-a", libraryRecordFromFood(food, 1));
	const current = { ...food, provenance: { ...draft.provenance } };
	const query = jest.fn(async () => [
		{ ...libraryRecordFromFood(current, 2), subject: "account-a" },
	]);
	jest.mocked(useConvex).mockReturnValue({ query } as never);
	jest.mocked(useMutation).mockReturnValue(jest.fn() as never);
	let value!: ReturnType<typeof usePersonalFoods>;
	function Reader() {
		value = usePersonalFoods();
		return <Text>Ready</Text>;
	}
	const view = render(
		<PersonalFoodsProvider repository={foods} libraryState={state}>
			<Reader />
		</PersonalFoodsProvider>,
	);
	let found: unknown;
	await act(async () => {
		found = await value.lookupBarcode("12345678");
	});
	expect(query.mock.calls[0]).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ ids: [food.id], barcode: "12345678" }),
		]),
	);
	expect(found).toBeUndefined();
	view.unmount();
});
it("resolves a cached correction identity so server deletion stops shadowing its source", async () => {
	const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
	const food = foods.create({
		...draft,
		provenance: { ...draft.provenance, forkedFrom: "shipped:apple" },
	});
	const state = createNutritionLibraryStateRepository(new SQLiteTestDatabase());
	state.commitServerRecord("account-a", libraryRecordFromFood(food, 1));
	const get = jest.fn((_ref, args) =>
		args !== "skip" && args.ids.includes(food.id)
			? [
					{
						id: food.id,
						kind: "food",
						revision: 2,
						payload: null,
						deleted: true,
						subject: "account-a",
					},
				]
			: [],
	);
	jest.mocked(useQuery).mockImplementation(get as never);
	jest.mocked(useMutation).mockReturnValue(jest.fn() as never);
	let value!: ReturnType<typeof usePersonalFoods>;
	function Reader() {
		value = usePersonalFoods({ forkIds: ["shipped:apple"] });
		return <Text>{value.forks().length}</Text>;
	}
	const view = render(
		<PersonalFoodsProvider repository={foods} libraryState={state}>
			<Reader />
		</PersonalFoodsProvider>,
	);
	await waitFor(() => expect(value.forks()).toEqual([]));
	view.unmount();
});

it("loads corrections beyond the first hundred shipped matches in bounded pages on a fresh cache", async () => {
	const candidates = foodResults({
		query: "",
		locale: "en",
		scope: "all",
		localMatches: [],
		localFoods: [],
		limit: 200,
	}).flatMap((result) => (result.kind === "shipped" ? [result.food.id] : []));
	const source = createPersonalFoodRepository(new SQLiteTestDatabase());
	const correction = source.create({
		...draft,
		name: { en: "Renamed correction", nl: "Hersteld" },
		provenance: { ...draft.provenance, forkedFrom: candidates.sort()[150] },
	});
	const extra = jest.fn((queries) =>
		Object.fromEntries(
			Object.entries(queries).map(([key, item]) => [
				key,
				(item as { args: { forkIds: string[] } }).args.forkIds.includes(
					correction.provenance.forkedFrom ?? "",
				)
					? [{ ...libraryRecordFromFood(correction, 1), subject: "account-a" }]
					: [],
			]),
		),
	);
	jest.mocked(useQueries).mockImplementation(extra as never);
	jest.mocked(useQuery).mockReturnValue([]);
	jest.mocked(usePaginatedQuery).mockReturnValue({
		results: [],
		status: "Exhausted",
		loadMore: jest.fn(),
	} as never);
	jest.mocked(useMutation).mockReturnValue(jest.fn() as never);
	let value!: ReturnType<typeof usePersonalFoods>;
	function Reader() {
		value = usePersonalFoods({
			browse: {},
			forkSearch: { locale: "en", limit: 200 },
		});
		return <Text>{value.forks().length}</Text>;
	}
	const view = render(
		<PersonalFoodsProvider
			repository={createPersonalFoodRepository(new SQLiteTestDatabase())}
			libraryState={createNutritionLibraryStateRepository(
				new SQLiteTestDatabase(),
			)}
		>
			<Reader />
		</PersonalFoodsProvider>,
	);
	await waitFor(() =>
		expect(value.findForkOf(correction.provenance.forkedFrom ?? "")?.id).toBe(
			correction.id,
		),
	);
	for (const [queries] of extra.mock.calls)
		for (const item of Object.values(queries))
			expect(
				(item as { args: { forkIds: string[] } }).args.forkIds.length,
			).toBeLessThanOrEqual(100);
	view.unmount();
});

it("keeps the latest subscription value when a delayed barcode lookup resolves", async () => {
	const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
	const food = foods.create({
		...draft,
		provenance: { ...draft.provenance, barcode: "12345678" },
	});
	const state = createNutritionLibraryStateRepository(new SQLiteTestDatabase());
	state.commitServerRecord("account-a", libraryRecordFromFood(food, 1));
	let resolve!: (records: unknown[]) => void;
	const query = jest.fn(
		() =>
			new Promise((done) => {
				resolve = done;
			}),
	);
	jest.mocked(useConvex).mockReturnValue({ query } as never);
	jest.mocked(useMutation).mockReturnValue(jest.fn() as never);
	let value!: ReturnType<typeof usePersonalFoods>;
	function Reader() {
		value = usePersonalFoods();
		return <Text>{value.find(food.id)?.name.en}</Text>;
	}
	const view = render(
		<PersonalFoodsProvider repository={foods} libraryState={state}>
			<Reader />
		</PersonalFoodsProvider>,
	);
	let lookup!: Promise<unknown>;
	act(() => {
		lookup = value.lookupBarcode("12345678");
	});
	const latest = {
		...food,
		name: { en: "Latest barcode edit", nl: "Laatste" },
	};
	act(() =>
		value.account.receiveServerPage([libraryRecordFromFood(latest, 3)]),
	);
	let found: unknown;
	await act(async () => {
		resolve([{ ...libraryRecordFromFood(food, 2), subject: "account-a" }]);
		found = await lookup;
	});
	expect(found).toEqual(latest);
	expect(view.getByText("Latest barcode edit")).toBeTruthy();
	expect(state.getRecord("account-a", food.id)?.revision).toBe(3);
	view.unmount();
});

it("checks cached fork deletions even when a hundred shortcut identities fill the first request", async () => {
	const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
	const correction = foods.create({
		...draft,
		provenance: { ...draft.provenance, forkedFrom: "shipped:apple" },
	});
	const state = createNutritionLibraryStateRepository(new SQLiteTestDatabase());
	state.commitServerRecord("account-a", libraryRecordFromFood(correction, 1));
	const tombstone = {
		id: correction.id,
		kind: "food",
		revision: 2,
		payload: null,
		deleted: true,
		subject: "account-a",
	};
	const response = (args: { ids: string[] }) =>
		args.ids.includes(correction.id) ? [tombstone] : [];
	jest
		.mocked(useQuery)
		.mockImplementation((_ref, args = "skip") =>
			args === "skip" ? [] : response(args as { ids: string[] }),
		);
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					response(request.args as { ids: string[] }),
				]),
			),
		);
	jest.mocked(useMutation).mockReturnValue(jest.fn() as never);
	let value!: ReturnType<typeof usePersonalFoods>;
	function Reader() {
		value = usePersonalFoods({
			ids: Array.from({ length: 100 }, (_, i) => `shortcut:${i}`),
			forkIds: ["shipped:apple"],
		});
		return <Text>{value.forks().length}</Text>;
	}
	const view = render(
		<PersonalFoodsProvider repository={foods} libraryState={state}>
			<Reader />
		</PersonalFoodsProvider>,
	);
	await waitFor(() => expect(value.forks()).toEqual([]));
	expect(state.getRecord("account-a", correction.id)?.deleted).toBe(true);
	view.unmount();
});
