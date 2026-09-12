/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { nutritionGoalTables } from "./nutritionGoalTables";
import {
	resolveGoalHistory,
	validateNutritionGoals,
	utcTodayIsoDate,
} from "./nutritionGoalModel";

const modules = import.meta.glob("./**/*.*s");
const legacyGoalsTable = defineTable({
	userId: v.string(),
	nutrient: v.string(),
	direction: v.string(),
	target: v.number(),
	sourcePreset: v.optional(v.string()),
}).index("by_user", ["userId"]);
const testSchema = defineSchema({
	nutritionGoals: legacyGoalsTable,
	...nutritionGoalTables,
});

const energy = (target: number) => ({
	nutrient: "energy" as const,
	direction: "max" as const,
	target,
});

describe("public nutrition goal operations", () => {
	it("requires authentication and keeps each user's goals private", async () => {
		const t = convexTest(testSchema, modules);
		await expect(t.query(api.nutritionGoals.list, {})).rejects.toThrow(
			"Unauthenticated",
		);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await alice.mutation(api.nutritionGoals.replace, { goals: [energy(2000)] });
		expect(await bob.query(api.nutritionGoals.list, {})).toEqual([]);
	});

	it("atomically replaces the current set and rejects duplicate bounds", async () => {
		const t = convexTest(testSchema, modules).withIdentity({ subject: "alice" });
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

	it("resolves an effective version at boundaries and keeps future versions out of list", async () => {
		const t = convexTest(testSchema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionGoals", { userId: "alice", ...energy(2000) });
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1800)],
			effectiveFrom: "2026-01-01",
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(2100)],
			effectiveFrom: "2026-02-01",
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(2400)],
			effectiveFrom: "2099-01-01",
		});

		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2025-12-31" }),
		).toMatchObject({
			goals: [energy(2000)],
			basis: "reference",
			effectiveFrom: null,
		});
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ basis: "effective", effectiveFrom: "2026-01-01" });
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-31" }),
		).toMatchObject({ goals: [energy(1800)] });
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-02-01" }),
		).toMatchObject({ goals: [energy(2100)] });
		const listed = await alice.query(api.nutritionGoals.list, {});
		expect(listed).not.toEqual([energy(2400)]);
	});

	it("replaces only the same effective date and freezes the pre-version reference", async () => {
		const t = convexTest(testSchema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionGoals", { userId: "alice", ...energy(2000) });
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1800)],
			effectiveFrom: "2026-01-01",
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [],
			effectiveFrom: "2026-02-01",
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1900)],
			effectiveFrom: "2026-01-01",
		});
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2025-01-01" }),
		).toMatchObject({ goals: [energy(2000)], basis: "reference" });
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ goals: [energy(1900)] });
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-02-01" }),
		).toMatchObject({ goals: [], basis: "effective" });
	});

	it("carries the frozen reference when a new earliest version is backdated", async () => {
		const t = convexTest(testSchema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionGoals", { userId: "alice", ...energy(2000) });
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1800)],
			effectiveFrom: "2026-01-01",
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1700)],
			effectiveFrom: "2025-01-01",
		});

		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2024-12-31" }),
		).toMatchObject({
			goals: [energy(2000)],
			basis: "reference",
			effectiveFrom: null,
		});
	});

	it("rejects invalid dates, non-positive/non-finite targets, duplicates, and crossed bounds", async () => {
		const t = convexTest(testSchema, modules).withIdentity({ subject: "alice" });
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: [energy(0)],
			}),
		).rejects.toThrow("greater than zero");
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: [
					{ nutrient: "protein", direction: "min", target: 150 },
					{ nutrient: "protein", direction: "max", target: 100 },
				],
			}),
		).rejects.toThrow("minimum");
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: [energy(2000), energy(2100)],
			}),
		).rejects.toThrow("duplicate");
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: [energy(2000)],
				effectiveFrom: "2026-02-30",
			}),
		).rejects.toThrow("effective date");
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: Array.from({ length: 17 }, (_, index) => ({
					nutrient: "protein" as const,
					direction: index % 2 === 0 ? ("min" as const) : ("max" as const),
					target: index + 1,
				})),
			}),
		).rejects.toThrow("maximum of 16");
	});
});

describe("pure goal history rules", () => {
	it("validates the UTC fallback and never sorts dates as instants", () => {
		expect(utcTodayIsoDate(new Date("2026-09-12T23:59:00-07:00"))).toBe(
			"2026-09-13",
		);
		expect(
			resolveGoalHistory({
				date: "2028-02-29",
				legacyGoals: [energy(2000)],
				versions: [{ effectiveFrom: "2028-03-01", goals: [energy(2100)] }],
			}),
		).toMatchObject({ basis: "reference", effectiveFrom: null });
		expect(() =>
			validateNutritionGoals([
				{ nutrient: "energy", direction: "max", target: Number.NaN },
			]),
		).toThrow("greater than zero");
	});
});
