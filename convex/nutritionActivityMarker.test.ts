/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

type Client = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;
type Range = { from: number; to: number };

function localDayRange(instant: number): Range {
	const start = new Date(instant);
	start.setHours(0, 0, 0, 0);
	const from = start.getTime();
	return { from, to: from + 86_400_000 };
}

async function completeSession(client: Client) {
	const sessionId = await client.mutation(api.workoutSessions.create, {});
	await client.mutation(api.sets.add, {
		operationId: "squat-1",
		sessionId,
		exerciseId: "shipped:exercise:barbell-back-squat",
		setNumber: 1,
		weight: 60,
		reps: 8,
		unit: "kg",
		setType: "working",
	});
	await client.mutation(api.workoutSessions.finish, { id: sessionId });
	return sessionId;
}

async function completedOn(client: Client, day: Range) {
	const [completed, ...rest] = await client.query(
		api.nutritionActivityMarker.completedActivityDays,
		{ days: [day] },
	);
	expect(rest).toEqual([]);
	return completed;
}

describe("the training marker's only connection to Activity", () => {
	it("requires authentication", async () => {
		const t = convexTest(schema, modules);
		await expect(
			t.query(api.nutritionActivityMarker.completedActivityDays, {
				days: [localDayRange(Date.now())],
			}),
		).rejects.toMatchObject({ data: { code: "unauthenticated" } });
	});

	it("is false with no workout sessions at all", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		expect(await completedOn(alice, localDayRange(Date.now()))).toBe(false);
	});

	it("stays false while the session is only active, and turns true once it is completed", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const today = localDayRange(Date.now());

		const sessionId = await alice.mutation(api.workoutSessions.create, {});
		await alice.mutation(api.sets.add, {
			operationId: "squat-1",
			sessionId,
			exerciseId: "shipped:exercise:barbell-back-squat",
			setNumber: 1,
			weight: 60,
			reps: 8,
			unit: "kg",
			setType: "working",
		});
		expect(await completedOn(alice, today)).toBe(false);

		await alice.mutation(api.workoutSessions.finish, { id: sessionId });
		expect(await completedOn(alice, today)).toBe(true);
	});

	it("does not report a completed session on a day it did not happen on", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const today = localDayRange(Date.now());
		await completeSession(alice);
		expect(
			await completedOn(alice, {
				from: today.from - 86_400_000,
				to: today.from,
			}),
		).toBe(false);
		expect(
			await completedOn(alice, { from: today.to, to: today.to + 86_400_000 }),
		).toBe(false);
	});

	it("never reports another user's completed session", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const bob = t.withIdentity({ subject: "bob" });
		await completeSession(alice);
		expect(await completedOn(bob, localDayRange(Date.now()))).toBe(false);
	});

	it("returns bare booleans — nothing a caller could use to compute expenditure", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		await completeSession(alice);
		const result = await alice.query(
			api.nutritionActivityMarker.completedActivityDays,
			{ days: [localDayRange(Date.now())] },
		);
		expect(result).toEqual([true]);
	});

	it("never changes Nutrition totals or goals, whether or not a completed Activity exists on the day", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const date = "2026-09-05";
		const entry = {
			date,
			meal: "lunch" as const,
			name: { en: "Apple", nl: "Appel" },
			serving: { en: "Piece × 1", nl: "Stuk × 1" },
			quantity: 1,
			amount: 135,
			baseUnit: "g" as const,
			clientEntryId: "apple",
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
		await alice.mutation(api.nutritionDiary.applyOperation, {
			operationId: "log-apple",
			expectedSubject: "alice",
			operation: { kind: "create", entry },
		});
		await alice.mutation(api.nutritionGoals.replace, {
			goals: [{ nutrient: "energy", direction: "max", target: 2000 }],
			effectiveFrom: date,
		});

		const before = await alice.query(api.nutritionDiary.day, { date });
		const goalsBefore = await alice.query(api.nutritionGoals.forDate, {
			date,
		});
		expect(goalsBefore.goals).toHaveLength(1);

		// A completed Activity appears on the same local day the food was logged.
		await completeSession(alice);
		expect(await completedOn(alice, localDayRange(Date.now()))).toBe(true);

		const after = await alice.query(api.nutritionDiary.day, { date });
		const goalsAfter = await alice.query(api.nutritionGoals.forDate, { date });

		expect(after).toEqual(before);
		expect(goalsAfter).toEqual(goalsBefore);
	});

	it("answers per local day for the week strip, in order, and validates the days", async () => {
		const t = convexTest(schema, modules);
		const alice = t.withIdentity({ subject: "alice" });
		const today = localDayRange(Date.now());
		const yesterday = { from: today.from - 86_400_000, to: today.from };
		await completeSession(alice);
		expect(
			await alice.query(api.nutritionActivityMarker.completedActivityDays, {
				days: [yesterday, today],
			}),
		).toEqual([false, true]);
		await expect(
			alice.query(api.nutritionActivityMarker.completedActivityDays, {
				days: Array.from({ length: 32 }, () => today),
			}),
		).rejects.toMatchObject({ data: { code: "tooLarge", field: "days" } });
		for (const day of [
			{ from: today.to, to: today.from },
			{ from: today.from, to: today.from },
			{ from: 0.5, to: today.to },
		]) {
			await expect(
				alice.query(api.nutritionActivityMarker.completedActivityDays, {
					days: [today, day],
				}),
			).rejects.toMatchObject({ data: { code: "invalid", field: "days" } });
		}
	});
});
