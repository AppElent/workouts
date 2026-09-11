/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("public nutrition goal operations", () => {
	it("requires authentication and keeps each user's goals private", async () => {
		const t = convexTest(schema, modules);
		await expect(t.query(api.nutritionGoals.list, {})).rejects.toThrow(
			"Unauthenticated",
		);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [{ nutrient: "energy", direction: "max", target: 2000 }],
		});
		expect(await bob.query(api.nutritionGoals.list, {})).toEqual([]);
	});

	it("atomically replaces the current set and rejects duplicate bounds", async () => {
		const t = convexTest(schema, modules).withIdentity({ subject: "alice" });
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: [
					{ nutrient: "protein", direction: "min", target: 50 },
					{ nutrient: "protein", direction: "min", target: 60 },
				],
			}),
		).rejects.toThrow("duplicate");
		await t.mutation(api.nutritionGoals.replace, {
			goals: [
				{ nutrient: "protein", direction: "min", target: 50, sourcePreset: "reference" },
			],
		});
		await t.mutation(api.nutritionGoals.replace, {
			goals: [
				{ nutrient: "protein", direction: "min", target: 55 },
				{ nutrient: "protein", direction: "max", target: 150 },
			],
		});
		const [saved, upperBound] = await t.query(api.nutritionGoals.list, {});
		expect(saved).toMatchObject({
			nutrient: "protein",
			direction: "min",
			target: 55,
		});
		expect(saved).not.toHaveProperty("sourcePreset");
		expect(upperBound).toMatchObject({
			nutrient: "protein",
			direction: "max",
			target: 150,
		});
	});
});
