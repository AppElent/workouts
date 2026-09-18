/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { personalMeasureTables } from "./personalMeasureTables";

const modules = import.meta.glob("./**/*.*s");
const testSchema = defineSchema(personalMeasureTables);

describe("public Personal Measure operations", () => {
	it("requires authentication and keeps each account's measures private", async () => {
		const t = convexTest(testSchema, modules);
		const paginationOpts = { numItems: 100, cursor: null };
		await expect(
			t.query(api.personalMeasures.list, { paginationOpts }),
		).rejects.toThrow(
			"Unauthenticated",
		);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await alice.mutation(api.personalMeasures.create, {
			name: "Small glass",
			amount: 250,
			unit: "ml",
		});

		expect(
			(await bob.query(api.personalMeasures.list, { paginationOpts })).page,
		).toEqual([]);
		expect(
			(await alice.query(api.personalMeasures.list, { paginationOpts })).page,
		).toMatchObject([
			{ name: "Small glass", amount: 250, unit: "ml", order: 0 },
		]);
	});

	it("validates names and amounts and enforces case-insensitive uniqueness", async () => {
		const user = convexTest(testSchema, modules).withIdentity({ subject: "alice" });
		await user.mutation(api.personalMeasures.create, {
			name: " Small glass ",
			amount: 250,
			unit: "ml",
		});
		await expect(
			user.mutation(api.personalMeasures.create, {
				name: "small GLASS",
				amount: 300,
				unit: "ml",
			}),
		).rejects.toThrow("already exists");
		for (const amount of [0, 10_001, 12.34, Number.NaN]) {
			await expect(
				user.mutation(api.personalMeasures.create, {
					name: `Measure ${String(amount)}`,
					amount,
					unit: "g",
				}),
			).rejects.toThrow("Amount");
		}
	});

	it("updates, reorders, and deletes only the owner's measures", async () => {
		const t = convexTest(testSchema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const first = await alice.mutation(api.personalMeasures.create, {
			name: "Small glass",
			amount: 250,
			unit: "ml",
		});
		const second = await alice.mutation(api.personalMeasures.create, {
			name: "Scoop",
			amount: 35,
			unit: "g",
		});

		await expect(
			bob.mutation(api.personalMeasures.update, {
				id: first.id,
				name: "Stolen",
				amount: 1,
				unit: "g",
			}),
		).rejects.toThrow("not found");
		await alice.mutation(api.personalMeasures.update, {
			id: first.id,
			name: "Large glass",
			amount: 450,
			unit: "ml",
		});
		await alice.mutation(api.personalMeasures.reorder, {
			ids: [second.id, first.id],
		});
		await alice.mutation(api.personalMeasures.remove, { id: second.id });

		const result = await alice.query(api.personalMeasures.list, {
			paginationOpts: { numItems: 100, cursor: null },
		});
		expect(result.page).toMatchObject([
			{ id: first.id, name: "Large glass", amount: 450 },
		]);
	});
});
