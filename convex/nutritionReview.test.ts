/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const snapshot = (date: string, energy: number | undefined, protein: number | undefined) => ({
	date,
	meal: "breakfast" as const,
	name: { en: "Test food", nl: "Testvoeding" },
	serving: { en: "Gram (g) × 100", nl: "Gram (g) × 100" },
	quantity: 100,
	amount: 100,
	baseUnit: "g" as const,
	clientEntryId: `${date}-entry`,
	nutrients: {
		energy: energy === undefined ? { kind: "absent" as const } : { kind: "value" as const, amount: energy },
		protein: protein === undefined ? { kind: "absent" as const } : { kind: "value" as const, amount: protein },
		carbs: { kind: "value" as const, amount: 0 },
		fat: { kind: "value" as const, amount: 0 },
		saturatedFat: { kind: "value" as const, amount: 0 },
		fibre: { kind: "value" as const, amount: 0 },
		sugars: { kind: "value" as const, amount: 0 },
		salt: { kind: "value" as const, amount: 0 },
	},
	provenance: { source: "oneOff" as const },
});

describe("authenticated weekly nutrition review", () => {
	it("requires authentication", async () => {
		const t = convexTest(schema, modules);
		await expect(t.query(api.nutritionReview.week, { startDate: "2026-09-07" })).rejects.toThrow("Unauthenticated");
		await expect(t.mutation(api.nutritionReview.toggleComplete, { date: "2026-09-07", completed: true })).rejects.toThrow("Unauthenticated");
	});

	it("returns seven indexed days and averages only known days with entries", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionDiary.log, snapshot("2026-09-07", 100, 10));
		await alice.mutation(api.nutritionDiary.log, snapshot("2026-09-08", undefined, 20));
		await alice.mutation(api.nutritionReview.toggleComplete, { date: "2026-09-09", completed: true });
		const review = await alice.query(api.nutritionReview.week, { startDate: "2026-09-07" });
		expect(review.days).toHaveLength(7);
		expect(review.days.map((day) => day.date)).toEqual([
			"2026-09-07",
			"2026-09-08",
			"2026-09-09",
			"2026-09-10",
			"2026-09-11",
			"2026-09-12",
			"2026-09-13",
		]);
		expect(review.coverage).toEqual({ loggedDayCount: 2, markedCompleteCount: 1 });
		expect(review.averages.energy).toBe(100);
		expect(review.averages.energyDays).toBe(1);
		expect(review.averages.protein).toBe(15);
		expect(review.averages.proteinDays).toBe(2);
	});

	it("stores completion only for its owner, validates real dates, and toggles off", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await expect(alice.mutation(api.nutritionReview.toggleComplete, { date: "2026-02-30", completed: true })).rejects.toThrow("Invalid review date");
		await alice.mutation(api.nutritionReview.toggleComplete, { date: "2026-09-07", completed: true });
		expect((await alice.query(api.nutritionReview.week, { startDate: "2026-09-07" })).coverage.markedCompleteCount).toBe(1);
		expect((await bob.query(api.nutritionReview.week, { startDate: "2026-09-07" })).coverage.markedCompleteCount).toBe(0);
		await alice.mutation(api.nutritionReview.toggleComplete, { date: "2026-09-07", completed: false });
		expect((await alice.query(api.nutritionReview.week, { startDate: "2026-09-07" })).coverage.markedCompleteCount).toBe(0);
	});
});
