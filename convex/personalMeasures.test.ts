/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("public Personal Measure operations", () => {
	it("requires authentication and keeps each account's measures private", async () => {
		const t = convexTest(schema, modules);
		const paginationOpts = { numItems: 100, cursor: null };
		await expect(
			t.query(api.personalMeasures.list, { paginationOpts }),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
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
		const user = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
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
		).rejects.toMatchObject({ data: { code: "duplicate", field: "name" } });
		for (const [amount, code] of [
			[0, "notPositive"],
			[10_001, "tooLarge"],
			[12.34, "tooPrecise"],
			[Number.NaN, "notPositive"],
		] as const) {
			await expect(
				user.mutation(api.personalMeasures.create, {
					name: `Measure ${String(amount)}`,
					amount,
					unit: "g",
				}),
			).rejects.toMatchObject({ data: { code, field: "amount" } });
		}
		for (const [name, code] of [
			[" ", "required"],
			["x".repeat(41), "tooLong"],
		] as const) {
			await expect(
				user.mutation(api.personalMeasures.create, {
					name,
					amount: 10,
					unit: "g",
				}),
			).rejects.toMatchObject({ data: { code, field: "name" } });
		}
	});

	it("updates, reorders, and deletes only the owner's measures", async () => {
		const t = convexTest(schema, modules);
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
		).rejects.toMatchObject({ data: { code: "notFound" } });
		await expect(
			bob.mutation(api.personalMeasures.remove, { id: first.id }),
		).rejects.toMatchObject({ data: { code: "notFound" } });
		await alice.mutation(api.personalMeasures.update, {
			id: first.id,
			name: "Large glass",
			amount: 450,
			unit: "ml",
		});
		for (const ids of [[first.id, first.id], [first.id]]) {
			await expect(
				alice.mutation(api.personalMeasures.reorder, { ids }),
			).rejects.toMatchObject({ data: { code: "invalid", field: "ids" } });
		}
		await alice.mutation(api.personalMeasures.reorder, {
			ids: [second.id, first.id],
		});
		expect(
			(
				await alice.query(api.personalMeasures.list, {
					paginationOpts: { numItems: 100, cursor: null },
				})
			).page.map((measure) => measure.id),
		).toEqual([second.id, first.id]);
		await alice.mutation(api.personalMeasures.remove, { id: second.id });

		const result = await alice.query(api.personalMeasures.list, {
			paginationOpts: { numItems: 100, cursor: null },
		});
		expect(result.page).toMatchObject([
			{ id: first.id, name: "Large glass", amount: 450 },
		]);
	});
});
