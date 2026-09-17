/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

type Reading = number | "trace" | undefined;

function nutrient(reading: Reading) {
	if (reading === undefined) return { kind: "absent" as const };
	if (reading === "trace") return { kind: "trace" as const };
	return { kind: "value" as const, amount: reading };
}

const snapshot = ({ date, energy, protein, suffix = "entry" }: { date: string; energy: Reading; protein: Reading; suffix?: string }) => ({
	date,
	meal: "breakfast" as const,
	name: { en: "Test food", nl: "Testvoeding" },
	serving: { en: "Gram (g) × 100", nl: "Gram (g) × 100" },
	quantity: 100,
	amount: 100,
	baseUnit: "g" as const,
	clientEntryId: `${date}-${suffix}`,
	nutrients: {
		energy: nutrient(energy),
		protein: nutrient(protein),
		carbs: nutrient(0),
		fat: nutrient(0),
		saturatedFat: nutrient(0),
		fibre: nutrient(0),
		sugars: nutrient(0),
		salt: nutrient(0),
	},
	provenance: { source: "oneOff" as const },
});

describe("authenticated nutrition Week overview", () => {
	it("requires authentication and validates real dates", async () => {
		const t = convexTest(schema, modules);
		await expect(t.query(api.nutritionReview.week, { startDate: "2026-09-07" })).rejects.toThrow("Unauthenticated");
		const alice = t.withIdentity({ subject: "alice" });
		await expect(alice.query(api.nutritionReview.week, { startDate: "2026-02-30" })).rejects.toThrow("Invalid review date");
		await expect(alice.query(api.nutritionReview.week, { startDate: "2026-09-08" })).rejects.toThrow("must start on Monday");
	});

	it("returns seven isolated days with the goals effective on each date", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await alice.mutation(api.nutritionGoals.replace, {
			effectiveFrom: "2026-09-01",
			goals: [
				{ nutrient: "energy", direction: "max", target: 2000 },
				{ nutrient: "protein", direction: "min", target: 100 },
			],
		});
		await alice.mutation(api.nutritionGoals.replace, {
			effectiveFrom: "2026-09-10",
			goals: [
				{ nutrient: "energy", direction: "min", target: 1800 },
				{ nutrient: "energy", direction: "max", target: 2200 },
			],
		});
		await alice.mutation(api.nutritionDiary.log, snapshot({ date: "2026-09-07", energy: 1900, protein: 90 }));
		const beforeHistory = await alice.query(api.nutritionReview.week, {
			startDate: "2026-08-24",
		});
		expect(beforeHistory.days[0]).toMatchObject({
			goals: [],
			goalBasis: "reference",
			effectiveFrom: null,
		});

		const review = await alice.query(api.nutritionReview.week, { startDate: "2026-09-07" });
		expect(review.days.map((day) => day.date)).toEqual([
			"2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
		]);
		expect(review.days[0]).toMatchObject({
			entryCount: 1,
			goalBasis: "effective",
			goals: [
				{ nutrient: "energy", direction: "max", target: 2000 },
				{ nutrient: "protein", direction: "min", target: 100 },
			],
		});
		expect(review.days[3]?.goals).toEqual([
			{ nutrient: "energy", direction: "min", target: 1800 },
			{ nutrient: "energy", direction: "max", target: 2200 },
		]);
		expect(review).not.toHaveProperty("coverage");
		expect(review.days[0]).not.toHaveProperty("markedComplete");
		expect((await bob.query(api.nutritionReview.week, { startDate: "2026-09-07" })).days[0]).toMatchObject({ entryCount: 0, goals: [] });
	});

	it("keeps completeness per nutrient and includes qualified results in averages", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionDiary.log, snapshot({ date: "2026-09-07", energy: 100, protein: 10 }));
		await alice.mutation(api.nutritionDiary.log, snapshot({ date: "2026-09-08", energy: undefined, protein: 20 }));
		await alice.mutation(api.nutritionDiary.log, snapshot({ date: "2026-09-09", energy: 200, protein: "trace" }));

		const review = await alice.query(api.nutritionReview.week, { startDate: "2026-09-07" });
		expect(review.days[1]?.totals.energy.incomplete).toBe(true);
		expect(review.days[1]?.totals.protein.incomplete).toBe(false);
		expect(review.averages).toEqual({
			energy: 150,
			energyDays: 2,
			energyQualified: false,
			protein: 10,
			proteinDays: 3,
			proteinQualified: true,
		});
	});

	it("excludes upcoming days from current-week averages", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.nutritionDiary.log, snapshot({ date: "2026-09-14", energy: 100, protein: 10 }));
		await alice.mutation(api.nutritionDiary.log, snapshot({ date: "2026-09-17", energy: 900, protein: 90 }));

		const review = await alice.query(api.nutritionReview.week, {
			startDate: "2026-09-14",
			today: "2026-09-16",
		});
		expect(review.averages.energy).toBe(100);
		expect(review.averages.energyDays).toBe(1);
		expect(review.averages.protein).toBe(10);
		expect(review.averages.proteinDays).toBe(1);
	});
});
