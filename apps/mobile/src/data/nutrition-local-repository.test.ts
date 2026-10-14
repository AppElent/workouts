import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	NutritionDiarySnapshot,
	NutritionProvenance,
} from "@foundry/core";
import { SQLiteTestDatabase } from "../test-support/sqlite-test-database";
import {
	createNutritionLocalRepository,
	type NutritionCachedDay,
} from "./nutrition-local-repository";

const provenance: NutritionProvenance = {
	source: "shipped",
	sourceId: "shipped:apple",
	dataset: "NEVO",
	edition: "2025/9.0",
	sourceCode: 1,
	sourceName: { en: "Apple", nl: "Appel" },
	saltDerived: true,
};

function snapshot(
	clientEntryId = "client-1",
	date = "2026-09-05",
): NutritionDiarySnapshot {
	return {
		clientEntryId,
		date,
		meal: "lunch",
		name: { en: "Apple", nl: "Appel" },
		serving: { en: "Piece × 1", nl: "Stuk × 1" },
		quantity: 1,
		amount: 135,
		baseUnit: "g",
		nutrients: {
			energy: { kind: "value", amount: 75.6 },
			protein: { kind: "trace" },
			carbs: { kind: "value", amount: 15.12 },
			fat: { kind: "absent" },
			saturatedFat: { kind: "value", amount: 0.135 },
			fibre: { kind: "value", amount: 2.7 },
			sugars: { kind: "value", amount: 13.5 },
			salt: { kind: "value", amount: 0.01 },
		},
		provenance,
	};
}

function cachedDay(
	date: string,
	entries: readonly NutritionDiarySnapshot[],
	revision: number,
): NutritionCachedDay {
	return {
		subject: "alice",
		date,
		revision,
		complete: true,
		entries: entries.map((entry, index) => ({
			_id: `server-${index + 1}`,
			...entry,
		})),
		updatedAt: Date.now(),
	};
}

describe("optional nutrition defaults and session snapshots", () => {
	it("reloads account data from the server after reopening while keeping last-used preferences", () => {
		const directory = mkdtempSync(join(tmpdir(), "nutrition-read-cache-"));
		const path = join(directory, "state.db");
		try {
			const first = createNutritionLocalRepository(
				new SQLiteTestDatabase(path),
			);
			first.putDay("alice", cachedDay("2026-09-05", [snapshot()], 1));
			first.putGoals("alice", "2026-09-05", {
				goals: [],
				basis: "reference",
				effectiveFrom: null,
			});
			first.putGoalDisplayOrder("alice", ["protein", "energy"]);
			first.toggleFavorite("alice", "shipped:apple", true);
			first.close();
			const reopened = createNutritionLocalRepository(
				new SQLiteTestDatabase(path),
			);
			expect(reopened.getDay("alice", "2026-09-05")).toBeUndefined();
			expect(reopened.getGoals("alice", "2026-09-05")).toBeUndefined();
			expect(reopened.getGoalDisplayOrder("alice")).toEqual([
				"protein",
				"energy",
			]);
			expect(reopened.getShortcut("alice", "shipped:apple")?.favorite).toBe(
				true,
			);
			reopened.close();
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("keeps last-used portions and favorites per account only after a save is acknowledged", () => {
		const db = new SQLiteTestDatabase();
		const store = createNutritionLocalRepository(db, () => 10);
		const portion = {
			kind: "authored" as const,
			servingKey: "slice",
			baseUnit: "g" as const,
			amount: 30,
			quantity: 2,
			label: { en: "Slice", nl: "Sneetje" },
		};
		store.recordAcknowledged(
			"alice",
			{
				version: 1,
				operationId: "saved",
				expectedSubject: "alice",
				operation: {
					kind: "create",
					entry: { ...snapshot(), clientEntryId: "saved-entry" },
				},
			},
			{ entryIds: ["server"], clientEntryIds: [], days: [] },
			{ sourceKey: "apple", portion },
		);
		store.toggleFavorite("alice", "apple", true);
		const reopened = createNutritionLocalRepository(db);
		expect(reopened.getShortcut("alice", "apple")).toEqual({
			sourceKey: "apple",
			lastUsedAt: 10,
			portion,
			favorite: true,
		});
		expect(reopened.listRecent("bob")).toEqual([]);
		expect(reopened.listOperations("alice")).toEqual([]);
		db.closeSync();
	});

	it("keeps the newest complete server snapshot in memory without projecting unsaved entries", () => {
		const db = new SQLiteTestDatabase();
		const store = createNutritionLocalRepository(db);
		store.putDay("alice", cachedDay("2026-09-05", [snapshot()], 2));
		store.putDay("alice", cachedDay("2026-09-05", [], 1));
		expect(store.projectDay("alice", "2026-09-05").entries).toHaveLength(1);
		expect(store.projectDay("alice", "2026-09-05").pendingOperationIds).toEqual(
			[],
		);
		expect(store.projectDay("bob", "2026-09-05").complete).toBe(false);
		db.closeSync();
	});
});

it("refuses to retire an unacknowledged legacy journal and leaves it available for the old uploader", () => {
	const database = new SQLiteTestDatabase();
	database.execSync(
		"CREATE TABLE nutrition_operations(status TEXT); INSERT INTO nutrition_operations VALUES ('queued'); PRAGMA user_version = 6;",
	);
	expect(() => createNutritionLocalRepository(database)).toThrow(
		"Upload legacy diary changes",
	);
	expect(() => createNutritionLocalRepository(database)).toThrow(
		"Upload legacy diary changes",
	);
	database.execSync("UPDATE nutrition_operations SET status = 'acknowledged'");
	expect(
		createNutritionLocalRepository(database).listOperations("alice"),
	).toEqual([]);
	database.closeSync();
});

it("retains acknowledged server state even when optional last-used defaults cannot be written", () => {
	const database = new SQLiteTestDatabase();
	const store = createNutritionLocalRepository(database);
	jest.spyOn(database, "runSync").mockImplementation(() => {
		throw new Error("disk full");
	});
	expect(() =>
		store.recordAcknowledged(
			"alice",
			{
				version: 1,
				operationId: "ack",
				expectedSubject: "alice",
				operation: {
					kind: "create",
					entry: { ...snapshot(), clientEntryId: "client-1" },
				},
			},
			{
				entryIds: ["server"],
				clientEntryIds: [],
				days: [
					{
						date: "2026-09-05",
						revision: 1,
						entries: cachedDay("2026-09-05", [snapshot()], 1).entries,
						totals: {},
					},
				],
			},
			{
				sourceKey: "apple",
				portion: {
					kind: "base-unit",
					servingKey: "g",
					baseUnit: "g",
					amount: 100,
					quantity: 1,
					label: { en: "g", nl: "g" },
				},
			},
		),
	).not.toThrow();
	expect(store.getDay("alice", "2026-09-05")?.entries).toHaveLength(1);
	database.closeSync();
});
