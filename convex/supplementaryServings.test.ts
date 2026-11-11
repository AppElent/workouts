/// <reference types="vite/client" />
import { allShippedFoods } from "@foundry/core/shipped-foods";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const food = allShippedFoods()[0];
const paginationOpts = { numItems: 100, cursor: null };
it("keeps added Servings on the owning account without changing the Shipped Food", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const bob = t.withIdentity({ subject: "bob" });
	const added = await alice.mutation(api.supplementaryServings.create, {
		foodId: food.id,
		name: "My bowl",
		amount: 187.5,
		unit: food.baseUnit,
	});
	expect(added).toMatchObject({
		foodId: food.id,
		name: "My bowl",
		amount: 187.5,
	});
	expect(
		(
			await alice.query(api.supplementaryServings.list, {
				foodId: food.id,
				paginationOpts,
			})
		).page,
	).toEqual([added]);
	expect(
		(
			await bob.query(api.supplementaryServings.list, {
				foodId: food.id,
				paginationOpts,
			})
		).page,
	).toEqual([]);
	await expect(
		t.query(api.supplementaryServings.list, {
			foodId: food.id,
			paginationOpts,
		}),
	).rejects.toMatchObject({ data: { code: "unauthenticated" } });
});
it("validates food, unit, amount and name before adding a Serving", async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const input = {
		foodId: food.id,
		name: "Bowl",
		amount: 200,
		unit: food.baseUnit,
	};
	await expect(
		alice.mutation(api.supplementaryServings.create, {
			...input,
			foodId: "missing-food",
		}),
	).rejects.toMatchObject({ data: { code: "notFound", field: "foodId" } });
	await expect(
		alice.mutation(api.supplementaryServings.create, { ...input, amount: 0 }),
	).rejects.toMatchObject({ data: { code: "notPositive", field: "amount" } });
	await expect(
		alice.mutation(api.supplementaryServings.create, { ...input, name: " " }),
	).rejects.toMatchObject({ data: { code: "required", field: "name" } });
	await expect(
		alice.mutation(api.supplementaryServings.create, {
			...input,
			unit: food.baseUnit === "g" ? "ml" : "g",
		}),
	).rejects.toMatchObject({ data: { code: "invalid", field: "unit" } });
	const saved = await alice.mutation(api.supplementaryServings.create, input);
	await expect(
		alice.mutation(api.supplementaryServings.create, {
			...input,
			name: " BOWL ",
		}),
	).rejects.toMatchObject({ data: { code: "duplicate", field: "name" } });
	expect(
		(
			await alice.query(api.supplementaryServings.list, {
				foodId: food.id,
				paginationOpts,
			})
		).page,
	).toEqual([saved]);
});
