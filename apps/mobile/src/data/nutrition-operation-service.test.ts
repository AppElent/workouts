import { isUuid, type NutritionDiarySnapshot } from "@foundry/core";
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
	it("does not retain a replay journal after a server-acknowledged save", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest
			.fn()
			.mockResolvedValue({ entryIds: ["saved"], clientEntryIds: [], days: [] });
		const service = new NutritionOperationService(repo, remote);
		service.setSubject("alice");
		service.setOnline(true);
		const saved = jest.fn();
		service.create("alice", snapshot, undefined, undefined, saved);
		await Promise.resolve();
		expect(saved).toHaveBeenCalledTimes(1);
		const reopened = createNutritionLocalRepository(db);
		expect(reopened.listOperations("alice")).toEqual([]);
		service.dispose();
		db.closeSync();
	});
	it("online saves report success only after acknowledgement and never queue disconnected input", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		let acknowledge!: (value: {
			entryIds: string[];
			clientEntryIds: string[];
			days: [];
		}) => void;
		const remote = jest.fn(
			() =>
				new Promise<{ entryIds: string[]; clientEntryIds: string[]; days: [] }>(
					(resolve) => {
						acknowledge = resolve;
					},
				),
		);
		const service = new NutritionOperationService(repo, remote);
		const saved = jest.fn();
		try {
			service.setSubject("alice");
			service.setOnline(true);
			service.create("alice", snapshot, undefined, undefined, saved);
			expect(saved).not.toHaveBeenCalled();
			expect(repo.listOperations("alice")).toEqual([]);
			acknowledge({ entryIds: ["entry"], clientEntryIds: [], days: [] });
			await Promise.resolve();
			expect(saved).toHaveBeenCalledTimes(1);
			service.setOnline(false);
			expect(() => service.create("alice", snapshot)).toThrow("connection");
			expect(remote).toHaveBeenCalledTimes(1);
			expect(
				repo
					.listOperations("alice")
					.every((operation) => operation.status === "acknowledged"),
			).toBe(true);
		} finally {
			service.dispose();
			db.closeSync();
		}
	});
	it("a failed online save remains retryable without a projected entry or late success for another account", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest
			.fn()
			.mockRejectedValueOnce(new Error("Invalid save"))
			.mockResolvedValue({ entryIds: [], clientEntryIds: [], days: [] });
		const service = new NutritionOperationService(repo, remote);
		const failed = jest.fn();
		const saved = jest.fn();
		try {
			service.setSubject("alice");
			service.setOnline(true);
			service.create("alice", snapshot, undefined, failed, saved);
			await Promise.resolve();
			await Promise.resolve();
			expect(failed).toHaveBeenCalledTimes(1);
			expect(saved).not.toHaveBeenCalled();
			expect(service.getProjectedDay("alice", snapshot.date).entries).toEqual(
				[],
			);
			service.create("alice", snapshot, undefined, failed, saved);
			service.setSubject("bob");
			await Promise.resolve();
			expect(saved).not.toHaveBeenCalled();
			expect(repo.listOperations("alice")[0].status).toBe("acknowledged");
			expect(repo.listOperations("bob")).toEqual([]);
		} finally {
			service.dispose();
			db.closeSync();
		}
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
	it("reuses an ambiguous online save until acknowledged, then allows another identical log", async () => {
		const db = new SQLiteTestDatabase();
		const repo = createNutritionLocalRepository(db);
		const remote = jest
			.fn()
			.mockRejectedValueOnce(new Error("Receipt lost"))
			.mockResolvedValue({ entryIds: [], clientEntryIds: [], days: [] });
		const service = new NutritionOperationService(repo, remote);
		service.setSubject("alice");
		service.setOnline(true);
		const failed = jest.fn();
		service.create("alice", snapshot, undefined, failed);
		await Promise.resolve();
		await Promise.resolve();
		expect(failed).toHaveBeenCalledTimes(1);
		expect(repo.listOperations("alice")).toEqual([]);
		service.create("alice", snapshot);
		await Promise.resolve();
		await Promise.resolve();
		expect(remote.mock.calls[1][0]).toEqual(remote.mock.calls[0][0]);
		service.create("alice", snapshot);
		await Promise.resolve();
		expect(remote.mock.calls[2][0].operationId).not.toBe(
			remote.mock.calls[0][0].operationId,
		);
		service.dispose();
		db.closeSync();
	});
});
