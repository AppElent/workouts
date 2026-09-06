/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function localDayRange(instant: number) {
	const start = new Date(instant);
	start.setHours(0, 0, 0, 0);
	const from = start.getTime();
	return { from, to: from + 86_400_000 };
}

describe("the training marker's only connection to Activity", () => {
	it("requires authentication", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.query(api.nutritionActivityMarker.hasCompletedActivity, localDayRange(Date.now())),
		).rejects.toThrow("Unauthenticated");
	});

	it("is false with no workout sessions at all", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		expect(
			await alice.query(api.nutritionActivityMarker.hasCompletedActivity, localDayRange(Date.now())),
		).toBe(false);
	});

	it("stays false while the session is only active, and turns true once it is completed", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const today = localDayRange(Date.now());

		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		expect(
			await alice.query(api.nutritionActivityMarker.hasCompletedActivity, today),
		).toBe(false);

		await alice.mutation(api.workoutSessions.finish, { id: sessionId });
		expect(
			await alice.query(api.nutritionActivityMarker.hasCompletedActivity, today),
		).toBe(true);
	});

	it("does not report a completed session on a day it did not happen on", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const today = localDayRange(Date.now());
		const yesterday = { from: today.from - 86_400_000, to: today.from };

		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		await alice.mutation(api.workoutSessions.finish, { id: sessionId });

		expect(
			await alice.query(api.nutritionActivityMarker.hasCompletedActivity, yesterday),
		).toBe(false);
	});

	it("never reports another user's completed session", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		const today = localDayRange(Date.now());

		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		await alice.mutation(api.workoutSessions.finish, { id: sessionId });

		expect(
			await bob.query(api.nutritionActivityMarker.hasCompletedActivity, today),
		).toBe(false);
	});

	it("returns a bare boolean — nothing a caller could use to compute expenditure", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const today = localDayRange(Date.now());
		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		await alice.mutation(api.workoutSessions.finish, { id: sessionId });

		const result = await alice.query(api.nutritionActivityMarker.hasCompletedActivity, today);
		expect(typeof result).toBe("boolean");
	});

	it("never changes Nutrition totals or goals, whether or not a completed Activity exists on the day", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const date = "2026-09-05";
		const snapshot = {
			date,
			meal: "lunch" as const,
			name: { en: "Apple", nl: "Appel" },
			serving: { en: "Piece × 1", nl: "Stuk × 1" },
			quantity: 1,
			amount: 135,
			baseUnit: "g" as const,
			nutrients: {
				energy: { kind: "value" as const, amount: 75.6 },
				protein: { kind: "trace" as const },
				carbs: { kind: "value" as const, amount: 15.12 },
				fat: { kind: "absent" as const },
				saturatedFat: { kind: "value" as const, amount: 0.135 },
				fibre: { kind: "value" as const, amount: 2.7 },
				sugars: { kind: "value" as const, amount: 13.5 },
				salt: { kind: "value" as const, amount: 0.01 },
			},
			provenance: {
				source: "shipped" as const,
				sourceId: "shipped:apple",
				dataset: "NEVO-online",
				edition: "2025/9.0",
				sourceCode: 123,
				sourceName: { en: "Apple raw", nl: "Appel rauw" },
				saltDerived: true,
			},
		};
		await alice.mutation(api.nutritionDiary.log, snapshot);
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [{ nutrient: "energy", direction: "max", target: 2000 }],
		});

		const before = await alice.query(api.nutritionDiary.day, { date });
		const goalsBefore = await alice.query(api.nutritionGoals.list, {});

		// A completed Activity appears on the same local day the food was logged.
		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		await alice.mutation(api.workoutSessions.finish, { id: sessionId });
		expect(
			await alice.query(api.nutritionActivityMarker.hasCompletedActivity, localDayRange(Date.now())),
		).toBe(true);

		const after = await alice.query(api.nutritionDiary.day, { date });
		const goalsAfter = await alice.query(api.nutritionGoals.list, {});

		expect(after).toEqual(before);
		expect(goalsAfter).toEqual(goalsBefore);
	});
});
