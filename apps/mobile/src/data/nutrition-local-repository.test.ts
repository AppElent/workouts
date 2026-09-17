import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	NutritionDiarySnapshot,
	NutritionOperationEnvelope,
	NutritionProvenance,
} from "@workouts/core";
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

function envelope(
	operationId: string,
	operation: NutritionOperationEnvelope["operation"],
): NutritionOperationEnvelope {
	return { version: 1, operationId, expectedSubject: "alice", operation };
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

describe("durable nutrition local repository", () => {
	it("keeps serving estimates through create, edit, move and acknowledged cache reconciliation", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const original = {
			...snapshot("estimate"),
			clientEntryId: "estimate",
			estimated: true as const,
			baseUnit: "serving" as const,
			amount: 1,
		};
		repository.accept(
			"alice",
			envelope("create-estimate", { kind: "create", entry: original }),
		);
		expect(
			repository.projectDay("alice", original.date).entries[0],
		).toMatchObject({ estimated: true, baseUnit: "serving", amount: 1 });
		repository.accept(
			"alice",
			envelope("edit-estimate", {
				kind: "update",
				target: { kind: "clientEntryId", id: "estimate" },
				quantity: 2,
				date: "2026-09-06",
				meal: "dinner",
			}),
			{ targetEntry: { _id: "client:estimate", ...original } },
		);
		const projected = repository.projectDay("alice", "2026-09-06").entries[0];
		expect(projected).toMatchObject({
			estimated: true,
			baseUnit: "serving",
			amount: 2,
			quantity: 2,
			nutrients: { protein: { kind: "trace" }, fat: { kind: "absent" } },
		});
		expect(repository.projectDay("alice", original.date).entries).toHaveLength(
			0,
		);
		const serverEntry = { ...projected, _id: "server-estimate" };
		for (const operationId of ["create-estimate", "edit-estimate"])
			repository.acknowledge("alice", operationId, {
				entryIds: ["server-estimate"],
				clientEntryIds: ["estimate"],
				days: [
					{
						date: "2026-09-06",
						revision: 2,
						entries: [serverEntry],
						totals: {},
					},
				],
			});
		expect(repository.projectDay("alice", "2026-09-06").entries).toHaveLength(
			1,
		);
		expect(repository.getDay("alice", "2026-09-06")?.entries[0]).toMatchObject({
			estimated: true,
			baseUnit: "serving",
			amount: 2,
		});
		database.closeSync();
	});
	it("keeps the immutable envelope and local projection across a real SQLite reopen", () => {
		const directory = mkdtempSync(join(tmpdir(), "workouts-nutrition-"));
		const path = join(directory, "state.db");
		const firstDatabase = new SQLiteTestDatabase(path);
		const first = createNutritionLocalRepository(firstDatabase);
		const operation = envelope("op-1", {
			kind: "create",
			entry: { ...snapshot(), clientEntryId: "client-1" },
		});
		first.accept("alice", operation);
		first.putGoals("alice", "2026-09-05", {
			goals: [{ nutrient: "energy", direction: "max", target: 2000 }],
			basis: "effective",
			effectiveFrom: "2026-09-01",
			displayOrder: [
				"energy",
				"protein",
				"carbs",
				"fat",
				"saturatedFat",
				"fibre",
				"sugars",
				"salt",
			],
		});
		first.putGoals("alice", "2026-09-06", {
			goals: [{ nutrient: "energy", direction: "max", target: 2100 }],
			basis: "effective",
			effectiveFrom: "2026-09-06",
		});
		first.putGoalDisplayOrder("alice", [
			"protein",
			"energy",
			"carbs",
			"fat",
			"saturatedFat",
			"fibre",
			"sugars",
			"salt",
		]);
		firstDatabase.closeSync();

		const reopenedDatabase = new SQLiteTestDatabase(path);
		const reopened = createNutritionLocalRepository(reopenedDatabase);
		const saved = reopened.getOperation("alice", "op-1");
		expect(saved?.envelope).toEqual(operation);
		expect(reopened.getGoals("alice", "2026-09-05")?.goals[0].target).toBe(
			2000,
		);
		expect(reopened.getGoals("alice", "2026-09-05")?.displayOrder?.[0]).toBe(
			"protein",
		);
		expect(reopened.getGoals("alice", "2026-09-06")?.displayOrder?.[0]).toBe(
			"protein",
		);
		expect(reopened.getGoals("bob", "2026-09-05")).toBeUndefined();
		expect(reopened.projectDay("alice", "2026-09-05").entries).toHaveLength(1);
		expect(reopened.projectDay("bob", "2026-09-05").entries).toHaveLength(0);
		reopenedDatabase.closeSync();
		rmSync(directory, { recursive: true, force: true });
	});

	it("repairs version 4 databases created by either concurrent schema change", () => {
		const directory = mkdtempSync(join(tmpdir(), "workouts-nutrition-v4-"));
		const path = join(directory, "state.db");
		const oldDatabase = new SQLiteTestDatabase(path);
		createNutritionLocalRepository(oldDatabase);
		oldDatabase.execSync(`
			DROP TABLE nutrition_cached_personal_measures;
			PRAGMA user_version = 4;
		`);
		oldDatabase.closeSync();

		const upgradedDatabase = new SQLiteTestDatabase(path);
		const upgraded = createNutritionLocalRepository(upgradedDatabase);
		expect(upgraded.getPersonalMeasures("alice")).toEqual([]);
		upgraded.putPersonalMeasures("alice", [
			{ id: "glass", name: "Small glass", amount: 250, unit: "ml", order: 0 },
		]);
		expect(upgraded.getPersonalMeasures("alice")).toEqual([
			{ id: "glass", name: "Small glass", amount: 250, unit: "ml", order: 0 },
		]);
		expect(upgraded.getGoalDisplayOrder("alice")).toBeUndefined();
		upgradedDatabase.closeSync();
		rmSync(directory, { recursive: true, force: true });
	});

	it("recovers a sending operation without changing its payload or id", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const operation = envelope("op-recover", {
			kind: "create",
			entry: { ...snapshot(), clientEntryId: "recover" },
		});
		repository.accept("alice", operation);
		repository.markSending("alice", operation.operationId);
		repository.recoverSending("alice");
		const recovered = repository.getOperation("alice", operation.operationId);
		expect(recovered?.status).toBe("queued");
		expect(recovered?.envelope).toEqual(operation);
		expect(recovered?.attempts).toBe(1);
		database.closeSync();
	});

	it("projects create, edit, move and delete intents in sequence without mutating snapshots", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const original = snapshot("offline-entry");
		repository.accept(
			"alice",
			envelope("create", {
				kind: "create",
				entry: original as NutritionDiarySnapshot & { clientEntryId: string },
			}),
		);
		repository.accept(
			"alice",
			envelope("edit", {
				kind: "update",
				target: { kind: "clientEntryId", id: "offline-entry" },
				quantity: 2,
			}),
			{ targetEntry: { _id: "client:offline-entry", ...original } },
		);
		repository.accept(
			"alice",
			envelope("move", {
				kind: "update",
				target: { kind: "clientEntryId", id: "offline-entry" },
				date: "2026-09-06",
			}),
			{ targetEntry: { _id: "client:offline-entry", ...original } },
		);
		expect(repository.projectDay("alice", "2026-09-05").entries).toHaveLength(
			0,
		);
		expect(
			repository.projectDay("alice", "2026-09-06").entries[0],
		).toMatchObject({
			quantity: 2,
			date: "2026-09-06",
			amount: 270,
		});
		repository.accept(
			"alice",
			envelope("delete", {
				kind: "remove",
				target: { kind: "clientEntryId", id: "offline-entry" },
			}),
		);
		expect(repository.projectDay("alice", "2026-09-06").entries).toHaveLength(
			0,
		);
		database.closeSync();
	});

	it("projects pending entries as one Logged Combo without changing their snapshots", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const apple = snapshot("apple-entry");
		const oats = {
			...snapshot("oats-entry"),
			name: { en: "Oats", nl: "Havermout" },
		};
		repository.accept(
			"alice",
			envelope("create-parts", {
				kind: "createBatch",
				date: apple.date,
				meal: apple.meal,
				entries: [apple, oats].map(
					({ date: _date, meal: _meal, clientEntryId, ...entry }) => ({
						...entry,
						clientEntryId: clientEntryId as string,
					}),
				),
			}),
		);
		repository.accept(
			"alice",
			envelope("group-parts", {
				kind: "group",
				targets: [
					{ kind: "clientEntryId", id: "apple-entry" },
					{ kind: "clientEntryId", id: "oats-entry" },
				],
				comboGroup: {
					id: "logged-combo-1",
					comboId: "combo-1",
					name: "Apple oats",
				},
			}),
		);

		const projected = repository.projectDay("alice", apple.date);
		expect(projected.entries.map((entry) => entry._id)).toEqual([
			"client:apple-entry",
			"client:oats-entry",
		]);
		expect(projected.entries.map((entry) => entry.comboGroup)).toEqual([
			{ id: "logged-combo-1", comboId: "combo-1", name: "Apple oats" },
			{ id: "logged-combo-1", comboId: "combo-1", name: "Apple oats" },
		]);
		expect(projected.entries.map((entry) => entry.nutrients)).toEqual([
			apple.nutrients,
			oats.nutrients,
		]);
		database.closeSync();
	});

	it("detaches a projected entry when it moves out of a Logged Combo", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const grouped = {
			...snapshot("grouped-entry"),
			comboGroup: {
				id: "logged-combo-1",
				comboId: "combo-1",
				name: "Apple oats",
			},
		};
		repository.putDay("alice", cachedDay(grouped.date, [grouped], 1));
		repository.accept(
			"alice",
			envelope("move-part", {
				kind: "update",
				target: { kind: "serverId", id: "server-1" },
				meal: "dinner",
			}),
			{ targetEntry: { _id: "server-1", ...grouped } },
		);

		const [entry] = repository.projectDay("alice", grouped.date).entries;
		expect(entry).toMatchObject({ _id: "server-1", meal: "dinner" });
		expect(entry.comboGroup).toBeUndefined();
		database.closeSync();
	});

	it("retains a projected Logged Combo when an entry is edited in place", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const grouped = {
			...snapshot("grouped-entry"),
			comboGroup: {
				id: "logged-combo-1",
				comboId: "combo-1",
				name: "Apple oats",
			},
		};
		repository.putDay("alice", cachedDay(grouped.date, [grouped], 1));
		repository.accept(
			"alice",
			envelope("edit-part", {
				kind: "update",
				target: { kind: "serverId", id: "server-1" },
				date: grouped.date,
				meal: grouped.meal,
				quantity: grouped.quantity * 2,
			}),
			{ targetEntry: { _id: "server-1", ...grouped } },
		);

		const [entry] = repository.projectDay("alice", grouped.date).entries;
		expect(entry.quantity).toBe(grouped.quantity * 2);
		expect(entry.comboGroup).toEqual(grouped.comboGroup);
		database.closeSync();
	});

	it("installs only newer complete server revisions and deduplicates a subscription before ACK", () => {
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database);
		const local = snapshot("local-entry");
		repository.accept(
			"alice",
			envelope("create", {
				kind: "create",
				entry: local as NutritionDiarySnapshot & { clientEntryId: string },
			}),
		);
		repository.putDay("alice", cachedDay("2026-09-05", [], 3));
		repository.putDay("alice", cachedDay("2026-09-05", [local], 2));
		expect(repository.getDay("alice", "2026-09-05")?.revision).toBe(3);
		repository.acknowledge("alice", "create", {
			entryIds: ["server-entry"],
			clientEntryIds: ["local-entry"],
			days: [
				{
					date: "2026-09-05",
					revision: 4,
					entries: cachedDay("2026-09-05", [local], 4).entries,
					totals: {},
				},
			],
		});
		const projected = repository.projectDay("alice", "2026-09-05");
		expect(projected.entries).toHaveLength(1);
		expect(projected.entries[0]._id).toBe("server-1");
		expect(repository.getOperation("alice", "create")?.status).toBe(
			"acknowledged",
		);
		database.closeSync();
	});

	it("records direct-food recency and favorites atomically per account", () => {
		let clock = 1;
		const database = new SQLiteTestDatabase();
		const repository = createNutritionLocalRepository(database, () => clock++);
		for (let index = 0; index < 55; index += 1) {
			const id = `food-${index}`;
			repository.accept(
				"alice",
				envelope(`op-${id}`, {
					kind: "create",
					entry: { ...snapshot(id), clientEntryId: id },
				}),
				undefined,
				{
					sourceKey: `shipped:${id}`,
					portion: {
						kind: "base-unit",
						servingKey: "base",
						baseUnit: "g",
						amount: 1,
						quantity: index + 1,
						label: { en: "Gram (g)", nl: "Gram (g)" },
					},
				},
			);
		}
		repository.toggleFavorite("alice", "shipped:food-0", true);
		repository.toggleFavorite("alice", "shipped:food-54", true);
		expect(repository.listRecent("alice")).toHaveLength(50);
		expect(repository.listFavorites("alice")).toHaveLength(2);
		expect(repository.listRecent("bob")).toHaveLength(0);
		expect(repository.listFavorites("bob")).toHaveLength(0);
		expect(
			repository.getShortcut("alice", "shipped:food-54")?.portion?.quantity,
		).toBe(55);
		database.closeSync();
	});
});
