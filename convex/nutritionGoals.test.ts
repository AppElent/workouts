/// <reference types="vite/client" />

import { resolveGoalHistory } from "@foundry/core";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const energy = (target: number) => ({
	nutrient: "energy" as const,
	direction: "max" as const,
	target,
});

const defaultDisplayOrder = [
	"energy",
	"protein",
	"carbs",
	"fat",
	"saturatedFat",
	"fibre",
	"sugars",
	"salt",
] as const;

describe("public nutrition goal operations", () => {
	it("requires authentication and keeps each user's goals private", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				goals: [energy(2000)],
				effectiveFrom: "2026-01-01",
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(2000)],
			effectiveFrom: "2026-01-01",
		});
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ goals: [energy(2000)], basis: "effective" });
		expect(
			await bob.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ goals: [], basis: "reference", effectiveFrom: null });
	});

	it("stores one global display order without changing effective goal history", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1800)],
			effectiveFrom: "2026-01-01",
		});
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ displayOrder: defaultDisplayOrder });

		const reordered: Array<(typeof defaultDisplayOrder)[number]> = [
			"protein",
			"energy",
			"carbs",
			"fat",
			"saturatedFat",
			"fibre",
			"sugars",
			"salt",
		];
		await alice.mutation(api.nutritionGoals.setDisplayOrder, {
			displayOrder: reordered,
		});

		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ goals: [energy(1800)], displayOrder: reordered });
		expect(
			await bob.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({ displayOrder: defaultDisplayOrder });
		await expect(
			t.mutation(api.nutritionGoals.setDisplayOrder, {
				displayOrder: [...defaultDisplayOrder],
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
		await expect(
			alice.mutation(api.nutritionGoals.setDisplayOrder, {
				displayOrder: [
					"energy",
					"energy",
					"carbs",
					"fat",
					"saturatedFat",
					"fibre",
					"sugars",
					"salt",
				],
			}),
		).rejects.toMatchObject({
			data: { code: "invalid", field: "displayOrder" },
		});
	});

	it("appends nutrients a saved display order does not list yet", async () => {
		const t = convexTest(schema, modules);
		await t.run((ctx) =>
			ctx.db.insert("nutritionGoalPreferences", {
				userId: "alice",
				displayOrder: ["salt", "protein"],
			}),
		);
		expect(
			await t
				.withIdentity({ subject: "alice" })
				.query(api.nutritionGoals.forDate, { date: "2026-01-01" }),
		).toMatchObject({
			displayOrder: [
				"salt",
				"protein",
				"energy",
				"carbs",
				"fat",
				"saturatedFat",
				"fibre",
				"sugars",
			],
		});
	});

	it("atomically replaces the set for one effective date and rejects duplicate bounds", async () => {
		const t = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const effectiveFrom = "2026-01-01";
		await expect(
			t.mutation(api.nutritionGoals.replace, {
				effectiveFrom,
				goals: [
					{ nutrient: "protein", direction: "min", target: 50 },
					{ nutrient: "protein", direction: "min", target: 60 },
				],
			}),
		).rejects.toMatchObject({
			data: { code: "duplicate", field: "protein.min" },
		});
		expect(
			await t.query(api.nutritionGoals.forDate, { date: effectiveFrom }),
		).toMatchObject({ goals: [], basis: "reference" });
		await t.mutation(api.nutritionGoals.replace, {
			effectiveFrom,
			goals: [
				{
					nutrient: "protein",
					direction: "min",
					target: 50,
					sourcePreset: "reference",
				},
			],
		});
		await t.mutation(api.nutritionGoals.replace, {
			effectiveFrom,
			goals: [
				{ nutrient: "protein", direction: "min", target: 55 },
				{ nutrient: "protein", direction: "max", target: 150 },
			],
		});
		const {
			goals: [saved, upperBound, ...rest],
		} = await t.query(api.nutritionGoals.forDate, { date: effectiveFrom });
		expect(rest).toEqual([]);
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

	it("resolves an effective version at boundaries and keeps future versions in the future", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionGoals", {
				userId: "alice",
				...energy(2000),
			});
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
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2098-12-31" }),
		).toMatchObject({
			goals: [energy(2100)],
			nextEffectiveFrom: "2099-01-01",
		});
	});

	it("names the next dated version so an editor can say where a change ends", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(1800)],
			effectiveFrom: "2026-01-01",
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [energy(2100)],
			effectiveFrom: "2026-02-01",
		});

		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-01-15" }),
		).toMatchObject({
			effectiveFrom: "2026-01-01",
			nextEffectiveFrom: "2026-02-01",
		});
		expect(
			await alice.query(api.nutritionGoals.forDate, { date: "2026-02-01" }),
		).toMatchObject({ effectiveFrom: "2026-02-01", nextEffectiveFrom: null });
	});

	it("replaces only the same effective date and freezes the pre-version reference", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionGoals", {
				userId: "alice",
				...energy(2000),
			});
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
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await t.run(async (ctx) => {
			await ctx.db.insert("nutritionGoals", {
				userId: "alice",
				...energy(2000),
			});
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
		const t = convexTest(schema, modules).withIdentity({
			subject: "alice",
		});
		const effectiveFrom = "2026-01-01";
		const rejects = async (
			goals: Array<{
				nutrient: "energy" | "protein";
				direction: "min" | "max";
				target: number;
			}>,
			code: string,
			field: string,
		) =>
			expect(
				t.mutation(api.nutritionGoals.replace, { goals, effectiveFrom }),
			).rejects.toMatchObject({ data: { code, field } });
		await rejects([energy(0)], "notPositive", "energy.max");
		await rejects([energy(Number.NaN)], "notPositive", "energy.max");
		await rejects(
			[
				{ nutrient: "protein", direction: "min", target: 150 },
				{ nutrient: "protein", direction: "max", target: 100 },
			],
			"minAboveMax",
			"protein.range",
		);
		await rejects([energy(2000), energy(2100)], "duplicate", "energy.max");
		await rejects(
			Array.from({ length: 17 }, (_, index) => ({
				nutrient: "protein" as const,
				direction: index % 2 === 0 ? ("min" as const) : ("max" as const),
				target: index + 1,
			})),
			"tooMany",
			"goals",
		);
		for (const date of ["2026-02-30", "2026-1-01", ""]) {
			await expect(
				t.mutation(api.nutritionGoals.replace, {
					goals: [energy(2000)],
					effectiveFrom: date,
				}),
			).rejects.toMatchObject({
				data: { code: "invalid", field: "effectiveFrom" },
			});
		}
		await expect(
			t.query(api.nutritionGoals.forDate, { date: "2026-02-30" }),
		).rejects.toMatchObject({ data: { code: "invalid", field: "date" } });
		expect(
			await t.query(api.nutritionGoals.forDate, { date: effectiveFrom }),
		).toMatchObject({ goals: [], basis: "reference" });
	});
});

describe("pure goal history rules", () => {
	it("never sorts dates as instants", () => {
		expect(
			resolveGoalHistory({
				date: "2028-02-29",
				legacyGoals: [energy(2000)],
				versions: [{ effectiveFrom: "2028-03-01", goals: [energy(2100)] }],
			}),
		).toMatchObject({ basis: "reference", effectiveFrom: null });
	});
});
