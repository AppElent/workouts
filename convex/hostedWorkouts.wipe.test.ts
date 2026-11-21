/// <reference types="vite/client" />

import { HOSTED_LEVELS } from "@foundry/core";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const template = {
	strengthBlocks: [],
	wodBlocks: [
		{
			blockId: "max",
			name: "Max clean",
			type: "load" as const,
			levels: HOSTED_LEVELS.map((level) => ({
				level,
				label: level,
				movements: [{ name: "Clean" }],
			})),
		},
	],
};
const score = {
	wodBlockId: "max",
	level: "rx" as const,
	load: 100,
	loadUnit: "kg" as const,
};

/**
 * An open workout the host takes part in, with Sam joined and scored, Pat
 * joined without a score, a guest score, and a second, draft workout:
 * 2 workouts, 3 participants, 3 submissions, 3 running sessions.
 */
async function seed() {
	const t = convexTest(schema, modules);
	const host = t.withIdentity({ subject: "host" });
	const sam = t.withIdentity({ subject: "sam" });
	const pat = t.withIdentity({ subject: "pat" });
	const id = await host.mutation(api.hostedWorkouts.createDraft, {
		title: "Friday lift",
		hostParticipation: "hostAndParticipate",
		template,
	});
	await host.mutation(api.hostedWorkouts.createDraft, {
		title: "Next week",
		hostParticipation: "hostOnly",
		template,
	});
	await host.mutation(api.hostedWorkouts.open, { id });
	const mine = await host.query(api.hostedWorkouts.getMine, { id });
	if (!mine) throw new Error("Hosted workout missing");
	const token = mine.hosted.joinToken;
	const hostSession = mine.participants[0].sessionId;
	const samSession = await sam.mutation(api.hostedWorkoutParticipants.join, {
		token,
	});
	const patSession = await pat.mutation(api.hostedWorkoutParticipants.join, {
		token,
	});
	for (const [athlete, sessionId] of [
		[host, hostSession],
		[sam, samSession],
	] as const)
		await athlete.mutation(api.hostedWorkoutSubmissions.submitForSession, {
			sessionId,
			...score,
		});
	// The host also logged a set in their own session.
	await t.run((ctx) =>
		ctx.db.insert("sets", {
			userId: "host",
			sessionId: hostSession,
			exerciseId: "back-squat",
			setNumber: 1,
			reps: 5,
			weight: 100,
			unit: "kg",
			setType: "working",
			loggedAt: 1,
		}),
	);
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Lee",
		guestKey: "guest-key-lee-0000001",
		...score,
	});
	return { t, samSession, patSession };
}

type T = Awaited<ReturnType<typeof seed>>["t"];

function snapshot(t: T) {
	return t.run(async (ctx) => ({
		hostedWorkouts: (await ctx.db.query("hostedWorkouts").collect()).length,
		hostedWorkoutParticipants: (
			await ctx.db.query("hostedWorkoutParticipants").collect()
		).length,
		hostedWorkoutSubmissions: (
			await ctx.db.query("hostedWorkoutSubmissions").collect()
		).length,
		workoutSessions: await ctx.db.query("workoutSessions").collect(),
		sets: await ctx.db.query("sets").collect(),
		wods: await ctx.db.query("wods").collect(),
		wodResults: await ctx.db.query("wodResults").collect(),
	}));
}

it("counts every hosted row and running session in a dry run without deleting", async () => {
	const { t } = await seed();
	const before = await snapshot(t);
	expect(
		await t.mutation(internal.hostedWorkouts.wipeAll, { dryRun: true }),
	).toEqual({
		dryRun: true,
		counts: {
			hostedWorkouts: 2,
			hostedWorkoutParticipants: 3,
			hostedWorkoutSubmissions: 3,
			runningSessions: 3,
		},
		atLeast: false,
	});
	expect(await snapshot(t)).toEqual(before);
});

it("wipes everything over several batches, ends running sessions, and keeps personal records", async () => {
	vi.useFakeTimers();
	const { t, samSession, patSession } = await seed();
	const before = await snapshot(t);
	const first = await t.mutation(internal.hostedWorkouts.wipeAll, {
		dryRun: false,
		batchSize: 2,
	});
	expect(first).toMatchObject({ done: false });
	await t.finishAllScheduledFunctions(vi.runAllTimers);

	const after = await snapshot(t);
	expect(after).toMatchObject({
		hostedWorkouts: 0,
		hostedWorkoutParticipants: 0,
		hostedWorkoutSubmissions: 0,
	});
	expect(console.log).toHaveBeenCalledWith("hostedWorkouts.wipeAll done", {
		hostedWorkouts: 2,
		hostedWorkoutParticipants: 3,
		hostedWorkoutSubmissions: 3,
		runningSessions: 3,
	});
	// Sessions, sets, WODs, and WOD Results stay; running sessions end like a
	// host delete ends them: scored ones complete, empty ones cancel.
	expect(after.sets).toHaveLength(1);
	expect(after.sets).toEqual(before.sets);
	expect(after.wods).toEqual(before.wods);
	expect(after.wodResults).toEqual(before.wodResults);
	expect(after.wodResults).toHaveLength(2);
	expect(after.workoutSessions.map(({ _id }) => _id)).toEqual(
		before.workoutSessions.map(({ _id }) => _id),
	);
	const status = Object.fromEntries(
		after.workoutSessions.map((s) => [s._id, s.status]),
	);
	expect(status[samSession]).toBe("completed");
	expect(status[patSession]).toBe("cancelled");
	expect(after.workoutSessions.every((s) => s.endTime !== undefined)).toBe(
		true,
	);

	// A repeat run finds nothing, changes nothing, and schedules nothing.
	expect(
		await t.mutation(internal.hostedWorkouts.wipeAll, { dryRun: false }),
	).toEqual({
		dryRun: false,
		deleted: {
			hostedWorkouts: 0,
			hostedWorkoutParticipants: 0,
			hostedWorkoutSubmissions: 0,
			runningSessions: 0,
		},
		totals: {
			hostedWorkouts: 0,
			hostedWorkoutParticipants: 0,
			hostedWorkoutSubmissions: 0,
			runningSessions: 0,
		},
		done: true,
	});
	expect(await snapshot(t)).toEqual(after);
	expect(
		await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
	).not.toContainEqual(expect.objectContaining({ state: { kind: "pending" } }));
});

it("leaves a session that already ended untouched", async () => {
	const { t, samSession } = await seed();
	await t.run((ctx) =>
		ctx.db.patch(samSession, { status: "completed", endTime: 1 }),
	);
	await t.mutation(internal.hostedWorkouts.wipeAll, { dryRun: false });
	const session = await t.run((ctx) => ctx.db.get(samSession));
	expect(session).toMatchObject({ status: "completed", endTime: 1 });
});

it("refuses a batch size outside 1 to 1000", async () => {
	const t = convexTest(schema, modules);
	await expect(
		t.mutation(internal.hostedWorkouts.wipeAll, {
			dryRun: false,
			batchSize: 0,
		}),
	).rejects.toThrow();
});
