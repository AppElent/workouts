import { isUuid, type NutritionDiarySnapshot } from "@workouts/core";
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
