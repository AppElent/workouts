import {
	isUuid,
	type NutritionDiarySnapshot,
	type NutritionOperationEnvelope,
} from "@workouts/core";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import { createNutritionLocalRepository } from "./nutrition-local-repository";
import {
	mintNutritionUuid,
	NutritionOperationService,
} from "./nutrition-operation-service";

const snapshot: NutritionDiarySnapshot = {
	date: "2026-09-12",
	meal: "breakfast",
	name: { en: "Apple", nl: "Appel" },
	serving: { en: "100 g", nl: "100 g" },
	quantity: 1,
	amount: 100,
	baseUnit: "g",
	provenance: { source: "oneOff" },
	nutrients: {
		energy: { kind: "value", amount: 50 },
		protein: { kind: "absent" },
		carbs: { kind: "absent" },
		fat: { kind: "absent" },
		saturatedFat: { kind: "absent" },
		fibre: { kind: "trace" },
		sugars: { kind: "absent" },
		salt: { kind: "absent" },
	},
};

describe("nutrition replay service", () => {
	it.each([
		"removeBatch",
		"moveBatch",
	] as const)("waits for a failed create before replaying %s", async (kind) => {
		jest.useFakeTimers();
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		let created = false;
		let createAttempts = 0;
		const remote = jest.fn(async (envelope: NutritionOperationEnvelope) => {
			if (envelope.operation.kind === "create") {
				if (++createAttempts === 1) throw new Error("Network unavailable");
				created = true;
			} else if (!created) {
				throw new Error("Diary entry no longer exists.");
			}
			return { entryIds: [], clientEntryIds: [], days: [] };
		});
		const service = new NutritionOperationService(repo, remote);
		try {
			service.setOnline(false);
			service.setSubject("alice");
			service.create("alice", { ...snapshot, clientEntryId: "pending-entry" });
			const targets = [
				{ kind: "serverId" as const, id: "client:pending-entry" },
			];
			if (kind === "removeBatch") service.removeBatch("alice", targets);
			else service.moveBatch("alice", targets, "2026-09-13", "lunch");
			service.setOnline(true);
			await jest.advanceTimersByTimeAsync(0);
			expect(repo.listOperations("alice")[1].lastError).toBeUndefined();
			expect(remote.mock.calls.map(([args]) => args.operation.kind)).toEqual([
				"create",
			]);
			await jest.advanceTimersByTimeAsync(5000);
			expect(remote.mock.calls.map(([args]) => args.operation.kind)).toEqual([
				"create",
				"create",
				kind,
			]);
			expect(
				repo.listOperations("alice").map((operation) => operation.status),
			).toEqual(["acknowledged", "acknowledged"]);
		} finally {
			service.dispose();
			db.closeSync();
		}
	});
	it.each([
		"removeBatch",
		"moveBatch",
	] as const)("keeps later edits behind a failed %s while allowing unrelated edits", async (kind) => {
		jest.useFakeTimers();
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network unavailable"))
			.mockResolvedValue({ entryIds: [], clientEntryIds: [], days: [] });
		const service = new NutritionOperationService(repo, remote);
		try {
			service.setOnline(false);
			service.setSubject("alice");
			const target = { kind: "serverId" as const, id: "server-entry" };
			if (kind === "removeBatch") service.removeBatch("alice", [target]);
			else service.moveBatch("alice", [target], "2026-09-13", "lunch");
			service.update("alice", target, { quantity: 2 });
			service.update(
				"alice",
				{ kind: "serverId", id: "unrelated-entry" },
				{ quantity: 3 },
			);
			service.setOnline(true);
			await jest.advanceTimersByTimeAsync(0);
			expect(
				repo.listOperations("alice").map((operation) => operation.status),
			).toEqual(["queued", "queued", "acknowledged"]);
			await jest.advanceTimersByTimeAsync(5000);
			expect(remote.mock.calls.map(([args]) => args.operation)).toEqual([
				expect.objectContaining({ kind }),
				expect.objectContaining({ kind: "update", quantity: 3 }),
				expect.objectContaining({ kind }),
				expect.objectContaining({ kind: "update", quantity: 2 }),
			]);
		} finally {
			service.dispose();
			db.closeSync();
		}
	});
	it("surfaces a missing diary entry for attention instead of retrying forever", async () => {
		jest.useFakeTimers();
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest
			.fn()
			.mockRejectedValue(new Error("Diary entry no longer exists."));
		const service = new NutritionOperationService(repo, remote);
		try {
			service.setOnline(false);
			service.setSubject("alice");
			service.removeBatch("alice", [{ kind: "serverId", id: "deleted-entry" }]);
			service.setOnline(true);
			await jest.advanceTimersByTimeAsync(60_000);
			expect(remote).toHaveBeenCalledTimes(1);
			expect(repo.listOperations("alice")[0]).toMatchObject({
				status: "needs-attention",
				lastError: "Diary entry no longer exists.",
			});
		} finally {
			service.dispose();
			db.closeSync();
		}
	});
	it("never acknowledges a missing receipt or invokes a legacy writer in production", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const legacy = jest.fn().mockResolvedValue(undefined);
		const service = new NutritionOperationService(repo, async () => undefined, {
			create: legacy,
		});
		service.setOnline(false);
		service.setSubject("alice");
		service.create("alice", snapshot);
		service.setOnline(true);
		await Promise.resolve();
		await Promise.resolve();
		expect(repo.listOperations("alice")[0].status).toBe("queued");
		expect(legacy).not.toHaveBeenCalled();
		service.dispose();
		db.closeSync();
	});
	it("does not report success or send when the local commit fails", () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest.fn();
		const service = new NutritionOperationService(repo, remote);
		service.setOnline(false);
		service.setSubject("alice");
		jest.spyOn(repo, "accept").mockImplementation(() => {
			throw new Error("Disk full");
		});
		const done = jest.fn();
		expect(() =>
			service.create("alice", snapshot, undefined, undefined, done),
		).toThrow("Disk full");
		expect(done).not.toHaveBeenCalled();
		expect(remote).not.toHaveBeenCalled();
		service.dispose();
		db.closeSync();
	});
	afterEach(() => jest.useRealTimers());
	it("generates distinct valid UUIDs without global crypto", () => {
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
		Object.defineProperty(globalThis, "crypto", {
			configurable: true,
			value: undefined,
		});
		try {
			const ids = Array.from({ length: 50 }, mintNutritionUuid);
			expect(new Set(ids).size).toBe(50);
			expect(ids.every(isUuid)).toBe(true);
		} finally {
			if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
		}
	});
	it("accepts offline locally, finishes UI immediately and normalizes pending edits/deletes", () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest.fn();
		const service = new NutritionOperationService(repo, remote);
		service.setOnline(false);
		service.setSubject("alice");
		const done = jest.fn();
		service.create(
			"alice",
			{ ...snapshot, clientEntryId: "entry-1" },
			undefined,
			undefined,
			done,
		);
		expect(done).toHaveBeenCalledTimes(1);
		expect(remote).not.toHaveBeenCalled();
		service.update(
			"alice",
			{ kind: "serverId", id: "client:entry-1" },
			{ quantity: 2 },
		);
		expect(repo.projectDay("alice", snapshot.date).entries[0].quantity).toBe(2);
		service.remove("alice", { kind: "serverId", id: "client:entry-1" });
		expect(repo.projectDay("alice", snapshot.date).entries).toHaveLength(0);
		service.dispose();
		db.closeSync();
	});
	it("groups pending entries locally and replays only after their create batch", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest.fn().mockResolvedValue({
			entryIds: [],
			clientEntryIds: [],
			days: [],
		});
		const service = new NutritionOperationService(repo, remote);
		service.setOnline(false);
		service.setSubject("alice");
		service.createBatch("alice", snapshot.date, snapshot.meal, [
			{ ...snapshot, clientEntryId: "apple-entry" },
			{
				...snapshot,
				name: { en: "Oats", nl: "Havermout" },
				clientEntryId: "oats-entry",
			},
		]);
		service.group(
			"alice",
			snapshot.date,
			snapshot.meal,
			[
				{ kind: "clientEntryId", id: "apple-entry" },
				{ kind: "clientEntryId", id: "oats-entry" },
			],
			{ id: "logged-combo-1", comboId: "combo-1", name: "Apple oats" },
		);

		expect(
			service
				.getProjectedDay("alice", snapshot.date)
				.entries.map((entry) => entry.comboGroup?.name),
		).toEqual(["Apple oats", "Apple oats"]);
		service.setOnline(true);
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(
			remote.mock.calls.map(([envelope]) => envelope.operation.kind),
		).toEqual(["createBatch", "group"]);
		service.dispose();
		db.closeSync();
	});
	it("rejects a group locally without accepting any partial grouping", () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const service = new NutritionOperationService(repo, jest.fn());
		service.setOnline(false);
		service.setSubject("alice");
		service.create("alice", { ...snapshot, clientEntryId: "apple-entry" });

		expect(() =>
			service.group(
				"alice",
				snapshot.date,
				snapshot.meal,
				[
					{ kind: "clientEntryId", id: "apple-entry" },
					{ kind: "clientEntryId", id: "missing-entry" },
				],
				{ id: "logged-combo-1", comboId: "combo-1", name: "Apple oats" },
			),
		).toThrow("available in the same Meal Slot");
		expect(repo.listOperations("alice")).toHaveLength(1);
		expect(repo.projectDay("alice", snapshot.date).entries[0].comboGroup).toBe(
			undefined,
		);
		service.dispose();
		db.closeSync();
	});
	it("rejects regrouping only part of an existing Logged Combo", () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const service = new NutritionOperationService(repo, jest.fn());
		service.setOnline(false);
		service.setSubject("alice");
		const existingGroup = {
			id: "old-group",
			comboId: "old-combo",
			name: "Old combo",
		};
		service.createBatch("alice", snapshot.date, snapshot.meal, [
			{ ...snapshot, clientEntryId: "apple-entry", comboGroup: existingGroup },
			{ ...snapshot, clientEntryId: "oats-entry", comboGroup: existingGroup },
		]);

		expect(() =>
			service.group(
				"alice",
				snapshot.date,
				snapshot.meal,
				[{ kind: "clientEntryId", id: "apple-entry" }],
				{ id: "new-group", comboId: "new-combo", name: "New combo" },
			),
		).toThrow("selected as a whole");
		expect(repo.listOperations("alice")).toHaveLength(1);
		expect(
			repo
				.projectDay("alice", snapshot.date)
				.entries.map((entry) => entry.comboGroup),
		).toEqual([existingGroup, existingGroup]);
		service.dispose();
		db.closeSync();
	});
	it("automatically retries a transient error with the same envelope", async () => {
		jest.useFakeTimers();
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest
			.fn()
			.mockRejectedValueOnce(new Error("Network unavailable"))
			.mockResolvedValue({ entryIds: [], clientEntryIds: [], days: [] });
		const service = new NutritionOperationService(repo, remote);
		service.setSubject("alice");
		service.create("alice", snapshot);
		await jest.advanceTimersByTimeAsync(3000);
		expect(remote).toHaveBeenCalledTimes(2);
		expect(remote.mock.calls[0][0]).toEqual(remote.mock.calls[1][0]);
		expect(repo.listOperations("alice")[0].status).toBe("acknowledged");
		service.dispose();
		db.closeSync();
	});
	it("stops scheduling the old account after a late response", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		let finish!: (value: {
			entryIds: string[];
			clientEntryIds: string[];
			days: [];
		}) => void;
		const remote = jest.fn(
			() =>
				new Promise<{ entryIds: string[]; clientEntryIds: string[]; days: [] }>(
					(resolve) => {
						finish = resolve;
					},
				),
		);
		const service = new NutritionOperationService(repo, remote);
		service.setOnline(false);
		service.setSubject("alice");
		service.create("alice", snapshot);
		service.create("alice", snapshot);
		service.setOnline(true);
		service.setSubject("bob");
		finish({ entryIds: [], clientEntryIds: [], days: [] });
		await Promise.resolve();
		await Promise.resolve();
		expect(remote).toHaveBeenCalledTimes(1);
		expect(repo.listOperations("alice")[1].status).toBe("queued");
		expect(() => service.create("alice", snapshot)).toThrow("Unauthorized");
		expect(repo.projectDay("bob", snapshot.date).entries).toHaveLength(0);
		service.dispose();
		db.closeSync();
	});
});
