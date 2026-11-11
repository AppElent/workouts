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

it("keeps writes without an operation ID unchanged", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const input = { weight: 80, unit: "kg" as const };
	await alice.mutation(api.bodyMetrics.add, input);
	await alice.mutation(api.bodyMetrics.add, input);
	expect(await alice.query(api.bodyMetrics.list, {})).toHaveLength(2);
});
