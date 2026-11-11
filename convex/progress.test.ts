/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const TUESDAY_W45 = Date.UTC(2026, 10, 3, 12);
/** Sunday of 2026-W45 in UTC; already Monday of W46 at UTC+1. */
const SUNDAY_LATE_W45 = Date.UTC(2026, 10, 8, 23, 30);

async function setup() {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity({ subject: "alice" });
	const exerciseId = await alice.mutation(api.exercises.create, {
		name: "Press",
		muscleGroups: ["chest"],
		category: "compound",
		equipment: "barbell",
	});
	await t.run(async (ctx) => {
		const sessionId = await ctx.db.insert("workoutSessions", {
			userId: "alice",
			date: TUESDAY_W45,
			startTime: TUESDAY_W45,
			status: "completed",
		});
		const sets = [
			{ weight: 100, unit: "kg", setType: "working", loggedAt: TUESDAY_W45 },
			{ weight: 40, unit: "kg", setType: "warmup", loggedAt: TUESDAY_W45 },
			{ weight: 100, unit: "lbs", setType: "drop", loggedAt: SUNDAY_LATE_W45 },
		] as const;
		for (const [index, set] of sets.entries())
			await ctx.db.insert("sets", {
				userId: "alice",
				sessionId,
				exerciseId,
				setNumber: index + 1,
				reps: 5,
				...set,
			});
	});
	return { alice, exerciseId };
}

it("sums work volume in kg per week, without warm-ups", async () => {
	const { alice, exerciseId } = await setup();
	expect(
		await alice.query(api.progress.weeklyVolume, {
			exerciseId,
			utcOffsetMinutes: 0,
		}),
	).toEqual([{ week: "2026-W45", volume: 500 + 227 }]);
});

it("buckets sets by the caller's calendar week", async () => {
	const { alice, exerciseId } = await setup();
	expect(
		await alice.query(api.progress.weeklyVolume, {
			exerciseId,
			utcOffsetMinutes: 60,
		}),
	).toEqual([
		{ week: "2026-W45", volume: 500 },
		{ week: "2026-W46", volume: 227 },
	]);
	await expect(
		alice.query(api.progress.weeklyVolume, {
			exerciseId,
			utcOffsetMinutes: 15 * 60,
		}),
	).rejects.toMatchObject({
		data: { code: "invalid", field: "utcOffsetMinutes" },
	});
});
