import { useAuth } from "@clerk/expo";
import { act, render } from "@testing-library/react-native";
import type { NutrientValue } from "@workouts/core/nutrition";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { Text } from "react-native";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createNutritionLibraryStateRepository,
	type NutritionLibraryStateRepository,
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

describe("PersonalFoodsProvider library journal", () => {
	it("retains the prepared journal when the local food write succeeded but outbox commit fails", () => {
		jest
			.mocked(useAuth)
			.mockReturnValue({ isSignedIn: true, userId: "account-a" } as never);
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		state.setEnabled("account-a", true);
		const failing: NutritionLibraryStateRepository = {
			...state,
			commitPrepared: () => {
				throw new Error("journal write failed");
			},
		};
		function Writer() {
			const personal = usePersonalFoods();
			useEffect(() => {
				try {
					personal.create(draft);
				} catch {
					/* expected after local commit */
				}
			}, [personal]);
			return <Text>writer</Text>;
		}
		render(
			<PersonalFoodsProvider repository={foods} libraryState={failing}>
				<Writer />
			</PersonalFoodsProvider>,
		);
		act(() => {});
		expect(foods.list()).toHaveLength(1);
		expect(state.listPrepared("account-a")).toHaveLength(1);
	});

	it("drains an offline write after a connection change without disposing its service", async () => {
		jest
			.mocked(useAuth)
			.mockReturnValue({ isSignedIn: true, userId: "account-a" } as never);
		let connected = false;
		jest.mocked(useConvexConnectionState).mockImplementation(
			() =>
				({
					isWebSocketConnected: connected,
					hasInflightRequests: false,
					hasEverConnected: connected,
					connectionCount: connected ? 1 : 0,
					connectionRetries: 0,
					timeOfOldestInflightRequest: null,
					inflightMutations: 0,
					inflightActions: 0,
				}) as never,
		);
		const apply = jest.fn(
			async (envelope: NutritionLibraryOperationEnvelope) => {
				if (envelope.operation.kind !== "upsert")
					throw new Error("Expected food write");
				return {
					record: {
						id: envelope.operation.record.id,
						kind: envelope.operation.record.kind,
						payload: envelope.operation.record.payload,
						revision: 1,
						deleted: false,
					},
				};
			},
		);
		jest.mocked(useMutation).mockReturnValue(apply as never);
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		state.setEnabled("account-a", true);
		function Writer({ write }: { write: boolean }) {
			const personal = usePersonalFoods();
			const wrote = useRef(false);
			useEffect(() => {
				if (write && !wrote.current) {
					wrote.current = true;
					personal.create(draft);
				}
			}, [personal, write]);
			return <Text>writer</Text>;
		}
		const rendered = render(
			<PersonalFoodsProvider repository={foods} libraryState={state}>
				<Writer write={false} />
			</PersonalFoodsProvider>,
		);
		await act(async () => {
			rendered.rerender(
				<PersonalFoodsProvider repository={foods} libraryState={state}>
					<Writer write />
				</PersonalFoodsProvider>,
			);
			await Promise.resolve();
		});
		expect(apply).not.toHaveBeenCalled();
		expect(state.listOperations("account-a")).toHaveLength(1);
		connected = true;
		await act(async () => {
			rendered.rerender(
				<PersonalFoodsProvider repository={foods} libraryState={state}>
					<Writer write />
				</PersonalFoodsProvider>,
			);
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(apply).toHaveBeenCalledTimes(1);
		expect(state.listOperations("account-a")).toEqual([]);
	});

	it("queues Account B's existing isolated library after Account A claimed legacy data", () => {
		jest
			.mocked(useAuth)
			.mockReturnValue({ isSignedIn: true, userId: "account-b" } as never);
		jest.mocked(useConvexConnectionState).mockReturnValue({
			isWebSocketConnected: false,
			hasInflightRequests: false,
			hasEverConnected: false,
			connectionCount: 0,
			connectionRetries: 0,
			timeOfOldestInflightRequest: null,
			inflightMutations: 0,
			inflightActions: 0,
		} as never);
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		state.claimLegacy("account-a");
		foods.create(draft);
		function EnableAfterWriting() {
			const personal = usePersonalFoods();
			useEffect(() => {
				if (!personal.backup.enabled) personal.backup.enable();
			}, [personal]);
			return <Text>writer</Text>;
		}
		render(
			<PersonalFoodsProvider repository={foods} libraryState={state}>
				<EnableAfterWriting />
			</PersonalFoodsProvider>,
		);
		act(() => {});
		expect(foods.list()).toHaveLength(1);
		expect(state.listOperations("account-b")).toHaveLength(1);
		expect(state.legacyClaimedBy()).toBe("account-a");
	});
});
