/// <reference types="vite/client" />

import { SHIPPED_EXERCISES } from "@foundry/core/exercises";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

it("returns the first result when a body metric write is retried", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const input = { operationId: "op-1", weight: 80, unit: "kg" as const };
	const first = await alice.mutation(api.bodyMetrics.add, input);
	const retry = await alice.mutation(api.bodyMetrics.add, input);
	expect(retry).toBe(first);
	expect(await alice.query(api.bodyMetrics.list, {})).toHaveLength(1);
	await expect(
		alice.mutation(api.bodyMetrics.add, { ...input, weight: 81 }),
	).rejects.toThrow("operationConflict");
});

it("scopes operation IDs to their owner", async () => {
	const t = convexTest(schema, modules);
	const input = { operationId: "shared", weight: 70, unit: "kg" as const };
	const alice = await t
		.withIdentity({ subject: "alice" })
		.mutation(api.bodyMetrics.add, input);
	const bob = await t
		.withIdentity({ subject: "bob" })
		.mutation(api.bodyMetrics.add, input);
	expect(bob).not.toBe(alice);
});

it("deduplicates manual one-rep maxes and WOD results", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const oneRepMax = {
		operationId: "orm-1",
		exerciseId: SHIPPED_EXERCISES[0]._id,
		value: 140,
		unit: "kg" as const,
		date: 1,
	};
	expect(await alice.mutation(api.oneRepMaxes.addManual, oneRepMax)).toBe(
		await alice.mutation(api.oneRepMaxes.addManual, oneRepMax),
	);

	const wodId = await t.run((ctx) =>
		ctx.db.insert("wods", {
			userId: "alice",
			name: "Fran",
			type: "forTime",
			movements: [],
			isDefault: false,
		}),
	);
	const result = {
		operationId: "wod-1",
		wodId,
		rxScaled: "rx" as const,
		timeSeconds: 300,
		date: 1,
	};
	expect(await alice.mutation(api.wodResults.log, result)).toBe(
		await alice.mutation(api.wodResults.log, result),
	);
	expect(await alice.query(api.wodResults.listForWod, { wodId })).toHaveLength(
		1,
	);
});

it("returns the first Routine when its create is retried", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const input = {
		operationId: "mcp:routine-1",
		name: "Push day",
		exercises: [
			{
				exerciseId: SHIPPED_EXERCISES[0]._id,
				defaultSets: 3,
				defaultReps: 8,
				defaultWeight: 60,
			},
		],
	};
	const first = await alice.mutation(api.routines.create, input);
	expect(await alice.mutation(api.routines.create, input)).toBe(first);
	expect(await alice.query(api.routines.list, {})).toHaveLength(1);
	await expect(
		alice.mutation(api.routines.create, { ...input, name: "Pull day" }),
	).rejects.toThrow("operationConflict");
	// The same key belongs to each owner separately.
	const bobs = await t
		.withIdentity({ subject: "bob" })
		.mutation(api.routines.create, input);
	expect(bobs).not.toBe(first);

	// A retry reports the first Routine even after the user deleted it.
	await alice.mutation(api.routines.remove, { id: first });
	expect(await alice.mutation(api.routines.create, input)).toBe(first);
	expect(await alice.query(api.routines.list, {})).toHaveLength(0);
});

it("keeps Routine creates without an operation ID independent", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const input = {
		name: "Push day",
		exercises: [
			{
				exerciseId: SHIPPED_EXERCISES[0]._id,
				defaultSets: 3,
				defaultReps: 8,
			},
		],
	};
	const first = await alice.mutation(api.routines.create, input);
	expect(await alice.mutation(api.routines.create, input)).not.toBe(first);
	expect(
		await t.run((ctx) => ctx.db.query("operationReceipts").collect()),
	).toEqual([]);
});

it("refuses an unknown or foreign Exercise and stores no receipt", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const { id: bobs } = await t
		.withIdentity({ subject: "bob" })
		.mutation(api.exercises.ensurePersonal, {
			name: "Sled Push",
			muscleGroups: ["quads"],
			category: "compound",
			equipment: "other",
		});
	const create = (exerciseId: string) =>
		alice.mutation(api.routines.create, {
			operationId: "mcp:routine-2",
			name: "Legs",
			exercises: [{ exerciseId, defaultSets: 3, defaultReps: 8 }],
		});
	for (const exerciseId of [bobs, "nope"])
		await expect(create(exerciseId)).rejects.toThrow("notFound");
	expect(await alice.query(api.routines.list, {})).toEqual([]);
	// The refused key is still free for the corrected input.
	await create(SHIPPED_EXERCISES[0]._id);
	expect(await alice.query(api.routines.list, {})).toHaveLength(1);
});

it("keeps writes without an operation ID unchanged", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const input = { weight: 80, unit: "kg" as const };
	await alice.mutation(api.bodyMetrics.add, input);
	await alice.mutation(api.bodyMetrics.add, input);
	expect(await alice.query(api.bodyMetrics.list, {})).toHaveLength(2);
});
