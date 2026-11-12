/// <reference types="vite/client" />

import { canonicalJson } from "@foundry/core";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

/**
 * Installed builds older than #194 (TestFlight build 10, JS 61e1f62d) send
 * the arguments below. These tests replay those exact shapes against the
 * current functions, beside the shapes current clients send.
 */
const modules = import.meta.glob("./**/*.*s");

const nutrients = {
	energy: { kind: "value" as const, amount: 12 },
	protein: { kind: "trace" as const },
	carbs: { kind: "absent" as const },
	fat: { kind: "value" as const, amount: 1 },
	saturatedFat: { kind: "absent" as const },
	fibre: { kind: "trace" as const },
	sugars: { kind: "value" as const, amount: 2 },
	salt: { kind: "value" as const, amount: 0.1 },
};

function food(id: string) {
	return JSON.stringify({
		id,
		name: { en: "Oats", nl: "Haver" },
		baseUnit: "g",
		nutrients,
		servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 50 }],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
		},
		createdAt: 1,
		updatedAt: 1,
	});
}

function diaryEntry(clientEntryId: string) {
	return {
		date: "2026-09-05",
		meal: "lunch" as const,
		clientEntryId,
		name: { en: "Apple", nl: "Appel" },
		serving: { en: "Piece × 1", nl: "Stuk × 1" },
		quantity: 1,
		amount: 135,
		baseUnit: "g" as const,
		nutrients,
		provenance: {
			source: "shipped" as const,
			sourceId: "shipped:apple",
			dataset: "NEVO-online",
			edition: "2025/9.0",
			sourceCode: 123,
			sourceName: { en: "Apple raw", nl: "Appel rauw" },
			saltDerived: true,
		},
	};
}

function setup() {
	const t = convexTest(schema, modules);
	return { t, alice: t.withIdentity({ subject: "alice" }) };
}

describe("nutrition library with legacy clients", () => {
	const legacySave = (operationId: string, schemaVersion: 1 | 2 | 3) => ({
		version: 1 as const,
		operationId,
		expectedSubject: "alice",
		operation: {
			kind: "upsert" as const,
			record: {
				id: "oats",
				kind: "food" as const,
				payload: food("oats"),
				schemaVersion,
			},
			expectedRevision: 0,
		},
	});

	it("accepts version and schemaVersion, and stores neither", async () => {
		const { t, alice } = setup();
		const request = legacySave("legacy-save", 2);
		const saved = await alice.mutation(api.nutritionLibrary.save, request);
		expect(saved.record).toMatchObject({ id: "oats", revision: 1 });
		expect(saved.record).not.toHaveProperty("schemaVersion");
		const row = await t.run((ctx) =>
			ctx.db.query("nutritionLibraryRecords").unique(),
		);
		expect(row).not.toHaveProperty("schemaVersion");
		expect(row).not.toHaveProperty("version");
		// A retry of the same legacy request replays its first result.
		expect(await alice.mutation(api.nutritionLibrary.save, request)).toEqual(
			saved,
		);
	});

	it("still accepts the current save shape", async () => {
		const { alice } = setup();
		const saved = await alice.mutation(api.nutritionLibrary.save, {
			operationId: "current-save",
			expectedSubject: "alice",
			operation: {
				kind: "upsert",
				record: { id: "oats", kind: "food", payload: food("oats") },
				expectedRevision: 0,
			},
		});
		expect(saved.record).toMatchObject({ id: "oats", revision: 1 });
	});

	it("replays a receipt the previous server wrote, schemaVersion included", async () => {
		const { t, alice } = setup();
		const request = legacySave("in-flight", 3);
		// The literal the previous server hashed (d7310be7 `canonicalPayload`).
		const oldPayload = canonicalJson({
			version: 1,
			expectedSubject: "alice",
			operation: request.operation,
		});
		const oldResult = {
			record: {
				id: "oats",
				schemaVersion: 3,
				kind: "food",
				payload: food("oats"),
				revision: 1,
				deleted: false,
			},
		};
		await t.run((ctx) =>
			ctx.db.insert("nutritionLibraryOperationReceipts", {
				userId: "alice",
				operationId: "in-flight",
				payload: oldPayload,
				result: JSON.stringify(oldResult),
				createdAt: 1,
			}),
		);
		expect(await alice.mutation(api.nutritionLibrary.save, request)).toEqual(
			oldResult,
		);
	});

	it("accepts photoVersion on browse and getMany, with and without it", async () => {
		const { alice } = setup();
		await alice.mutation(api.nutritionLibrary.save, legacySave("seed", 2));
		const paginationOpts = { numItems: 10, cursor: null };
		const current = await alice.query(api.nutritionLibrary.browse, {
			query: "",
			paginationOpts,
		});
		const legacy = await alice.query(api.nutritionLibrary.browse, {
			query: "",
			paginationOpts,
			photoVersion: 3,
		});
		expect(legacy).toEqual(current);
		expect(current.page.map((record) => record.id)).toEqual(["oats"]);
		const many = await alice.query(api.nutritionLibrary.getMany, {
			ids: ["oats"],
			forkIds: [],
		});
		expect(
			await alice.query(api.nutritionLibrary.getMany, {
				ids: ["oats"],
				forkIds: [],
				photoVersion: 3,
			}),
		).toEqual(many);
		expect(many.map((record) => record.id)).toEqual(["oats"]);
	});

	it("still rejects photo and schema versions no build sent", async () => {
		const { alice } = setup();
		await expect(
			alice.query(api.nutritionLibrary.getMany, {
				ids: ["oats"],
				photoVersion: 2 as 3,
			}),
		).rejects.toThrow(/Validator error/);
		await expect(
			alice.mutation(
				api.nutritionLibrary.save,
				legacySave("bad-schema", 4 as 3),
			),
		).rejects.toThrow(/Validator error/);
	});
});

describe("nutrition diary with legacy clients", () => {
	const legacyApply = (operationId: string) => ({
		version: 1 as const,
		operationId,
		expectedSubject: "alice",
		operation: { kind: "create" as const, entry: diaryEntry("entry-1") },
		includeDays: false,
	});

	it("accepts version and includeDays, and returns the days list old builds read", async () => {
		const { alice } = setup();
		const request = legacyApply("legacy-apply");
		const result = await alice.mutation(
			api.nutritionDiary.applyOperation,
			request,
		);
		expect(result).toMatchObject({
			clientEntryIds: ["entry-1"],
			days: [],
		});
		expect(result.entryIds).toHaveLength(1);
		expect(
			(await alice.query(api.nutritionDiary.day, { date: "2026-09-05" }))
				.entries,
		).toHaveLength(1);
		expect(
			await alice.mutation(api.nutritionDiary.applyOperation, request),
		).toEqual(result);
	});

	it("keeps the current result shape for current clients", async () => {
		const { alice } = setup();
		const result = await alice.mutation(api.nutritionDiary.applyOperation, {
			operationId: "current-apply",
			expectedSubject: "alice",
			operation: { kind: "create", entry: diaryEntry("entry-2") },
		});
		expect(result).not.toHaveProperty("days");
		expect(result.clientEntryIds).toEqual(["entry-2"]);
	});

	it("replays a receipt the previous server wrote, days included", async () => {
		const { t, alice } = setup();
		const request = legacyApply("in-flight");
		// The literal the previous server hashed; it left out `includeDays`.
		const oldPayload = canonicalJson({
			version: 1,
			expectedSubject: "alice",
			operation: request.operation,
		});
		const oldResult = {
			entryIds: [],
			clientEntryIds: ["entry-1"],
			days: [{ date: "2026-09-05", revision: 1, entries: [] }],
		};
		await t.run((ctx) =>
			ctx.db.insert("nutritionDiaryOperationReceipts", {
				userId: "alice",
				operationId: "in-flight",
				payload: oldPayload,
				result: JSON.stringify(oldResult),
				createdAt: 1,
			}),
		);
		expect(
			await alice.mutation(api.nutritionDiary.applyOperation, request),
		).toEqual(oldResult);
	});
});

describe("training with legacy clients", () => {
	const exerciseId = "shipped:exercise:barbell-bench-press";
	const squat = "shipped:exercise:barbell-back-squat";

	async function sessionWithSet(alice: ReturnType<typeof setup>["alice"]) {
		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		await alice.mutation(api.sets.add, {
			operationId: crypto.randomUUID(),
			sessionId,
			exerciseId,
			setNumber: 1,
			reps: 5,
			weight: 100,
			unit: "kg",
			setType: "working",
		});
		return sessionId;
	}

	it("finishes a session with or without discardUnfinished", async () => {
		const { alice } = setup();
		const legacy = await sessionWithSet(alice);
		await alice.mutation(api.workoutSessions.finish, {
			id: legacy,
			discardUnfinished: true,
		});
		const current = await sessionWithSet(alice);
		await alice.mutation(api.workoutSessions.finish, { id: current });
		for (const id of [legacy, current])
			expect(
				await alice.query(api.workoutSessions.getById, { id }),
			).toMatchObject({ status: "completed" });
	});

	it("serves the latest other session's sets for that exercise, by set number", async () => {
		const { t, alice } = setup();
		const log = async (
			sessionId: Awaited<ReturnType<typeof sessionWithSet>>,
			values: { setNumber: number; weight: number; exercise?: string },
		) =>
			alice.mutation(api.sets.add, {
				operationId: crypto.randomUUID(),
				sessionId,
				exerciseId: values.exercise ?? exerciseId,
				setNumber: values.setNumber,
				reps: 5,
				weight: values.weight,
				unit: "kg",
				setType: "working",
			});
		const older = await sessionWithSet(alice);
		await alice.mutation(api.workoutSessions.finish, { id: older });
		const latest = await alice.mutation(api.workoutSessions.create, {});
		await log(latest, { setNumber: 2, weight: 110 });
		await log(latest, { setNumber: 1, weight: 105 });
		await log(latest, { setNumber: 1, weight: 60, exercise: squat });
		await alice.mutation(api.workoutSessions.finish, { id: latest });
		// Pin the order: the older session logged first.
		await t.run(async (ctx) => {
			for (const set of await ctx.db.query("sets").collect())
				await ctx.db.patch(set._id, {
					loggedAt: set.sessionId === older ? 1_000 : 2_000,
				});
		});
		const current = await alice.mutation(api.workoutSessions.create, {});
		expect(
			await alice.query(api.sets.getPreviousForExercise, {
				exerciseId,
				sessionId: current,
			}),
		).toMatchObject([
			{ sessionId: latest, setNumber: 1, weight: 105, exerciseId },
			{ sessionId: latest, setNumber: 2, weight: 110, exerciseId },
		]);
		// The session being logged is skipped, so it gets the one before it.
		expect(
			await alice.query(api.sets.getPreviousForExercise, {
				exerciseId,
				sessionId: latest,
			}),
		).toMatchObject([{ sessionId: older, setNumber: 1, weight: 100 }]);
		await expect(
			t.query(api.sets.getPreviousForExercise, {
				exerciseId,
				sessionId: current,
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
		expect(
			await t
				.withIdentity({ subject: "bob" })
				.query(api.sets.getPreviousForExercise, {
					exerciseId,
					sessionId: current,
				}),
		).toEqual([]);
	});

	it("buckets weekly volume in UTC when no offset is sent, as the old server did", async () => {
		const { t, alice } = setup();
		await sessionWithSet(alice);
		// Late Sunday of 2026-W45 in UTC, already Monday of W46 at UTC+1.
		await t.run(async (ctx) => {
			const set = await ctx.db.query("sets").unique();
			if (set)
				await ctx.db.patch(set._id, {
					loggedAt: Date.UTC(2026, 10, 8, 23, 30),
				});
		});
		expect(
			await alice.query(api.progress.weeklyVolume, { exerciseId }),
		).toEqual([{ week: "2026-W45", volume: 500 }]);
		expect(
			await alice.query(api.progress.weeklyVolume, {
				exerciseId,
				utcOffsetMinutes: 60,
			}),
		).toEqual([{ week: "2026-W46", volume: 500 }]);
	});
});
