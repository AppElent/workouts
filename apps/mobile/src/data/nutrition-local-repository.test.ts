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
		});
		firstDatabase.closeSync();

		const reopenedDatabase = new SQLiteTestDatabase(path);
		const reopened = createNutritionLocalRepository(reopenedDatabase);
		const saved = reopened.getOperation("alice", "op-1");
		expect(saved?.envelope).toEqual(operation);
		expect(reopened.getGoals("alice", "2026-09-05")?.goals[0].target).toBe(
			2000,
		);
		expect(reopened.getGoals("bob", "2026-09-05")).toBeUndefined();
		expect(reopened.projectDay("alice", "2026-09-05").entries).toHaveLength(1);
		expect(reopened.projectDay("bob", "2026-09-05").entries).toHaveLength(0);
		reopenedDatabase.closeSync();
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
