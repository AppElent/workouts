import { canonicalJson } from "@workouts/core";
import type { NUTRIENT_KEYS, NutrientValue } from "@workouts/core/nutrition";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createNutritionLibraryStateRepository,
	type LibraryRecord,
	libraryRecordFromFood,
} from "./nutrition-library-repository";
import {
	type NutritionLibraryOperationEnvelope,
	NutritionLibraryService,
} from "./nutrition-library-service";
import { mintNutritionUuid } from "./nutrition-operation-service";
import {
	type ComboDraft,
	createPersonalFoodRepository,
	type PersonalFoodDraft,
} from "./personal-food-repository";

const nutrients: Record<(typeof NUTRIENT_KEYS)[number], NutrientValue> = {
	energy: { kind: "value", amount: 12 },
	protein: { kind: "trace" },
	carbs: { kind: "absent" },
	fat: { kind: "value", amount: 1 },
	saturatedFat: { kind: "absent" },
	fibre: { kind: "trace" },
	sugars: { kind: "value", amount: 2 },
	salt: { kind: "value", amount: 0.1 },
};

function foodDraft(name = "Oats"): PersonalFoodDraft {
	return {
		name: { en: name, nl: `${name} nl` },
		baseUnit: "g",
		nutrients,
		servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 50 }],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
	};
}

function comboDraft(foodId: string): ComboDraft {
	return {
		name: "Breakfast",
		parts: [
			{
				reference: { kind: "personal", foodId },
				snapshot: {
					name: { en: "Oats", nl: "Haver" },
					serving: { en: "Bowl", nl: "Kom" },
					quantity: 1,
					amount: 50,
					baseUnit: "g",
					nutrients,
					provenance: {
						source: "personal",
						sourceId: foodId,
						nutritionSource: "manual",
						locallyEdited: false,
					},
				},
			},
		],
	};
}

function remoteServer() {
	const records = new Map<string, LibraryRecord>();
	const receipts = new Map<string, { record: LibraryRecord }>();
	let failNext = false;
	const apply = async (envelope: NutritionLibraryOperationEnvelope) => {
		if (failNext) {
			failNext = false;
			throw new Error("Network unavailable");
		}
		const receipt = receipts.get(envelope.operationId);
		if (receipt) return receipt;
		const operation = envelope.operation;
		const id =
			operation.kind === "upsert" ? operation.record.id : operation.recordId;
		const kind =
			operation.kind === "upsert"
				? operation.record.kind
				: operation.recordKind;
		const current = records.get(id);
		const expected = operation.expectedRevision;
		if ((current?.revision ?? 0) !== expected)
			throw new Error("Conflict: changed elsewhere");
		const record: LibraryRecord = {
			id,
			kind,
			payload: operation.kind === "upsert" ? operation.record.payload : null,
			revision: expected + 1,
			deleted: operation.kind === "remove",
		};
		records.set(id, record);
		const result = { record };
		receipts.set(envelope.operationId, result);
		return result;
	};
	return {
		records,
		apply,
		failOnce: () => {
			failNext = true;
		},
	};
}

function device(subject: string, remote: ReturnType<typeof remoteServer>) {
	const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
	const state = createNutritionLibraryStateRepository(new SQLiteTestDatabase());
	const service = new NutritionLibraryService(
		subject,
		state,
		foods,
		remote.apply,
	);
	service.setOnline(true);
	return {
		foods,
		service,
		state,
	};
}

describe("NutritionLibraryService", () => {
	it("syncs stable food and Combo identities to a second device without touching diary data", async () => {
		const remote = remoteServer();
		const first = device("account-a", remote);
		const food = first.foods.create(foodDraft());
		const combo = first.foods.createCombo(comboDraft(food.id));
		first.service.recordFood(food);
		first.service.recordCombo(combo);
		await first.service.replay();

		const second = device("account-a", remote);
		second.service.receiveServerPage([...remote.records.values()]);
		expect(second.foods.find(food.id)?.id).toBe(food.id);
		expect(second.foods.findCombo(combo.id)?.id).toBe(combo.id);
		expect(second.foods.findCombo(combo.id)?.parts[0]?.reference).toEqual({
			kind: "personal",
			foodId: food.id,
		});
	});

	it("retains an offline update and deletion across a failed retry, then keeps the tombstone authoritative", async () => {
		const remote = remoteServer();
		const first = device("account-a", remote);
		const food = first.foods.create(foodDraft());
		first.service.recordFood(food);
		await first.service.replay();
		const original = remote.records.get(food.id);
		if (!original) throw new Error("Expected synced food");

		first.service.setOnline(false);
		const updated = first.foods.update(food.id, foodDraft("Edited oats"));
		first.service.recordFood(updated);
		remote.failOnce();
		first.service.setOnline(true);
		await first.service.replay();
		expect(first.service.getOperations()[0]?.status).toBe("queued");
		await first.service.replay();
		expect(remote.records.get(food.id)?.revision).toBe(2);

		first.foods.remove(food.id);
		first.service.remove(food.id, "food");
		await first.service.replay();
		const tombstone = remote.records.get(food.id);
		expect(tombstone).toMatchObject({
			deleted: true,
			revision: 3,
			payload: null,
		});
		first.service.receiveServerPage([original]);
		expect(first.foods.find(food.id)).toBeUndefined();
	});

	it("isolates account state and exposes a conflict instead of last-write-wins", async () => {
		const remote = remoteServer();
		const first = device("account-a", remote);
		const food = first.foods.create(foodDraft());
		first.service.recordFood(food);
		await first.service.replay();
		const second = device("account-a", remote);
		second.service.receiveServerPage([...remote.records.values()]);
		const otherAccount = device("account-b", remote);
		expect(otherAccount.foods.list()).toEqual([]);

		const firstEdit = first.foods.update(food.id, foodDraft("First edit"));
		first.service.recordFood(firstEdit);
		await first.service.replay();
		const secondEdit = second.foods.update(food.id, foodDraft("Second edit"));
		second.service.recordFood(secondEdit);
		await second.service.replay();
		expect(second.service.getOperations()[0]?.status).toBe("needs-attention");
		second.service.receiveServerPage([...remote.records.values()]);
		const conflict = second.service.getConflicts()[0];
		expect(conflict?.serverRevision).toBe(2);
		expect(second.foods.find(food.id)?.name.en).toBe("Second edit");
		if (!conflict) throw new Error("Expected an explicit conflict");
		second.service.keepDeviceCopy(conflict);
		await second.service.replay();
		expect(remote.records.get(food.id)?.revision).toBe(3);
	});

	it("recovers a prepared account-library write after a crash between databases", async () => {
		const remote = remoteServer();
		const first = device("account-a", remote);
		first.service.setOnline(false);
		const id = "c3e1fc54-e7b3-4729-a2ce-24633d784899";
		const transaction = first.service.prepareUpsert(id, "food");
		first.foods.create(foodDraft("Crash-safe oats"), id);
		// Simulates process death after the food SQLite commit and before commitPrepared.
		const restarted = new NutritionLibraryService(
			"account-a",
			first.state,
			first.foods,
			remote.apply,
		);
		restarted.setOnline(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(remote.records.get(id)).toMatchObject({
			id,
			revision: 1,
			deleted: false,
		});
		expect(first.state.listPrepared("account-a")).toEqual([]);
		expect(transaction).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("uses distinct RFC 4122-shaped fallback operation IDs without crypto APIs", () => {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
		const random = jest.spyOn(Math, "random");
		let value = 0;
		random.mockImplementation(() => {
			value = (value + 0.03125) % 1;
			return value;
		});
		Object.defineProperty(globalThis, "crypto", {
			configurable: true,
			value: undefined,
		});
		try {
			const first = mintNutritionUuid();
			const second = mintNutritionUuid();
			expect(first).not.toBe(second);
			expect(first).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
			);
		} finally {
			random.mockRestore();
			if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
		}
	});

	it("keeps a lost-ack retry byte-identical after a remote page arrives", async () => {
		const sent: string[] = [];
		let first = true;
		const remote = async (envelope: NutritionLibraryOperationEnvelope) => {
			sent.push(canonicalJson(envelope));
			if (first) {
				first = false;
				throw new Error("Network dropped after server receipt");
			}
			if (envelope.operation.kind !== "upsert")
				throw new Error("Expected upsert");
			return {
				record: {
					id: envelope.operation.record.id,
					kind: envelope.operation.record.kind,
					payload: envelope.operation.record.payload,
					revision: 1,
					deleted: false,
				},
			};
		};
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const service = new NutritionLibraryService(
			"account-a",
			state,
			foods,
			remote,
		);
		service.setOnline(false);
		const food = foods.create(foodDraft());
		service.recordFood(food);
		service.setOnline(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		service.receiveServerPage([
			{
				id: food.id,
				kind: "food",
				payload: JSON.stringify(food),
				revision: 1,
				deleted: false,
			},
		]);
		await service.replay();
		expect(sent).toHaveLength(2);
		expect(sent[1]).toBe(sent[0]);
	});

	it("associates a legacy device library with exactly one account", () => {
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		expect(state.claimLegacy("account-a")).toBe(true);
		expect(state.legacyClaimedBy()).toBe("account-a");
		expect(state.claimLegacy("account-b")).toBe(false);
	});

	it("adopts a server conflict by updating metadata and clearing every pending operation", async () => {
		const remote = remoteServer();
		const first = device("account-a", remote);
		const food = first.foods.create(foodDraft());
		first.service.recordFood(food);
		await first.service.replay();
		const second = device("account-a", remote);
		second.service.receiveServerPage([...remote.records.values()]);
		const firstEdit = first.foods.update(food.id, foodDraft("Server edit"));
		first.service.recordFood(firstEdit);
		await first.service.replay();
		const localEdit = second.foods.update(food.id, foodDraft("Local edit"));
		second.service.recordFood(localEdit);
		await second.service.replay();
		second.service.receiveServerPage([...remote.records.values()]);
		const conflict = second.service.getConflicts()[0];
		if (!conflict) throw new Error("Expected conflict");
		second.service.resolveServerConflict(conflict);
		expect(second.foods.find(food.id)?.name.en).toBe("Server edit");
		expect(second.state.getRecord("account-a", food.id)).toMatchObject({
			revision: 2,
			deleted: false,
		});
		expect(second.service.getOperations()).toEqual([]);
		expect(second.service.getConflicts()).toEqual([]);
	});

	it("keeps a local deletion as a deletion when resolving a conflict", async () => {
		const remote = remoteServer();
		const first = device("account-a", remote);
		const food = first.foods.create(foodDraft());
		first.service.recordFood(food);
		await first.service.replay();
		const second = device("account-a", remote);
		second.service.receiveServerPage([...remote.records.values()]);
		const serverEdit = first.foods.update(food.id, foodDraft("Server edit"));
		first.service.recordFood(serverEdit);
		await first.service.replay();
		second.foods.remove(food.id);
		second.service.remove(food.id, "food");
		await second.service.replay();
		second.service.receiveServerPage([...remote.records.values()]);
		const conflict = second.service.getConflicts()[0];
		if (!conflict) throw new Error("Expected deletion conflict");
		second.service.keepDeviceCopy(conflict);
		await second.service.replay();
		expect(remote.records.get(food.id)).toMatchObject({
			deleted: true,
			payload: null,
			revision: 3,
		});
	});

	it("preserves later local edits and tombstones while acknowledging an earlier operation", () => {
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const original = foods.create(foodDraft("Original"));
		state.queueUpsert("account-a", libraryRecordFromFood(original), "first");
		state.markSending("account-a", "first");
		const later = foods.update(original.id, foodDraft("Later local edit"));
		state.queueUpsert("account-a", libraryRecordFromFood(later), "second");
		state.acknowledge("account-a", "first", {
			...libraryRecordFromFood(original),
			revision: 1,
		});
		expect(
			JSON.parse(state.getRecord("account-a", original.id)?.payload ?? "{}"),
		).toMatchObject({
			name: { en: "Later local edit" },
		});
		expect(state.getRecord("account-a", original.id)).toMatchObject({
			revision: 1,
			deleted: false,
		});
		expect(state.listOperations("account-a")).toMatchObject([
			{ operationId: "second", expectedRevision: 1 },
		]);

		const deleteFoods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const deleteState = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const toDelete = deleteFoods.create(foodDraft("To delete"));
		deleteState.queueUpsert(
			"account-a",
			libraryRecordFromFood(toDelete),
			"create",
		);
		deleteState.markSending("account-a", "create");
		deleteFoods.remove(toDelete.id);
		deleteState.queueRemove(
			"account-a",
			libraryRecordFromFood(toDelete),
			"remove",
		);
		deleteState.acknowledge("account-a", "create", {
			...libraryRecordFromFood(toDelete),
			revision: 1,
		});
		expect(deleteState.getRecord("account-a", toDelete.id)).toMatchObject({
			revision: 1,
			deleted: true,
			payload: null,
		});
		expect(deleteState.listOperations("account-a")).toMatchObject([
			{ operationId: "remove", expectedRevision: 1 },
		]);
	});

	it("does not advance inbound metadata until the account-library apply succeeds", () => {
		const remote = remoteServer();
		const current = device("account-a", remote);
		const food = current.foods.create(foodDraft());
		const serverRecord = { ...libraryRecordFromFood(food), revision: 1 };
		const replace = jest
			.spyOn(current.foods, "replaceFromBackup")
			.mockImplementationOnce(() => {
				throw new Error("SQLite write failed");
			});
		expect(() => current.service.receiveServerPage([serverRecord])).toThrow(
			"SQLite write failed",
		);
		expect(current.state.getRecord("account-a", food.id)).toBeUndefined();
		replace.mockRestore();
		current.service.receiveServerPage([serverRecord]);
		expect(current.state.getRecord("account-a", food.id)).toMatchObject({
			revision: 1,
		});
	});

	it("clears a stale conflict when its final local operation is acknowledged", () => {
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const food = foods.create(foodDraft());
		state.queueUpsert("account-a", libraryRecordFromFood(food), "only");
		state.markSending("account-a", "only");
		const serverRecord = { ...libraryRecordFromFood(food), revision: 1 };
		expect(state.acceptServerRecord("account-a", serverRecord)).toBe(
			"conflict",
		);
		expect(state.listConflicts("account-a")).toHaveLength(1);
		state.acknowledge("account-a", "only", serverRecord);
		expect(state.listConflicts("account-a")).toEqual([]);
	});

	it("requeues an interrupted send when an account service is recreated", async () => {
		const remote = remoteServer();
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const food = foods.create(foodDraft());
		state.queueUpsert("account-a", libraryRecordFromFood(food), "interrupted");
		state.markSending("account-a", "interrupted");
		const restarted = new NutritionLibraryService(
			"account-a",
			state,
			foods,
			remote.apply,
		);
		expect(state.listOperations("account-a")).toMatchObject([
			{ operationId: "interrupted", status: "queued", attempts: 1 },
		]);
		restarted.setOnline(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(remote.records.get(food.id)).toMatchObject({ revision: 1 });
	});

	it("queues pre-existing records from an account-scoped library when backup is enabled", async () => {
		const remote = remoteServer();
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const food = foods.create(foodDraft("Account B food"));
		const combo = foods.createCombo(comboDraft(food.id));
		const service = new NutritionLibraryService(
			"account-b",
			state,
			foods,
			remote.apply,
		);
		expect(state.listOperations("account-b")).toHaveLength(2);
		service.setOnline(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(remote.records.get(food.id)).toMatchObject({
			id: food.id,
			revision: 1,
		});
		expect(remote.records.get(combo.id)).toMatchObject({
			id: combo.id,
			revision: 1,
		});
	});

	it("blocks a later same-record operation after an earlier retry fails", async () => {
		const calls: string[] = [];
		const remote = async (envelope: NutritionLibraryOperationEnvelope) => {
			calls.push(envelope.operationId);
			throw new Error("Network unavailable");
		};
		const foods = createPersonalFoodRepository(new SQLiteTestDatabase());
		const state = createNutritionLibraryStateRepository(
			new SQLiteTestDatabase(),
		);
		const service = new NutritionLibraryService(
			"account-a",
			state,
			foods,
			remote,
		);
		service.setOnline(false);
		const food = foods.create(foodDraft());
		state.queueUpsert("account-a", libraryRecordFromFood(food, 1), "first");
		state.markSending("account-a", "first");
		state.markQueued("account-a", "first", "lost ACK");
		const later = foods.update(food.id, foodDraft("Later edit"));
		state.queueUpsert("account-a", libraryRecordFromFood(later, 1), "second");
		service.setOnline(true);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(calls).toEqual(["first"]);
		expect(
			state
				.listOperations("account-a")
				.find((item) => item.operationId === "second")?.status,
		).toBe("queued");
	});
});
