/// <reference types="vite/client" />

import { HOSTED_LEVELS } from "@foundry/core";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const SAM_KEY = "guest-key-sam-one-0001";
const OTHER_SAM_KEY = "guest-key-sam-two-0002";

async function openWorkout() {
	const t = convexTest(schema, modules);
	const host = t.withIdentity({ subject: "host" });
	const id = await host.mutation(api.hostedWorkouts.createDraft, {
		title: "Friday lift",
		hostParticipation: "hostOnly",
		template: {
			strengthBlocks: [],
			wodBlocks: ["max", "fran"].map((blockId) => ({
				blockId,
				name: blockId,
				type: "load" as const,
				levels: HOSTED_LEVELS.map((level) => ({
					level,
					label: level,
					movements: [{ name: "Clean" }],
				})),
			})),
		},
	});
	await host.mutation(api.hostedWorkouts.open, { id });
	const mine = await host.query(api.hostedWorkouts.getMine, { id });
	if (!mine) throw new Error("Hosted workout missing");
	return { t, host, id, token: mine.hosted.joinToken };
}

function score(load: number, wodBlockId = "max") {
	return { wodBlockId, level: "rx" as const, load, loadUnit: "kg" as const };
}

async function board(t: ReturnType<typeof convexTest>, token: string) {
	const data = await t.query(api.hostedWorkouts.getByJoinToken, { token });
	return (data?.submissions ?? []).map(({ athleteName, load, wodBlockId }) => ({
		athleteName,
		load,
		wodBlockId,
	}));
}

it("keeps two same-name guests apart and lets each correct their own score", async () => {
	const { t, token } = await openWorkout();
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: SAM_KEY,
		...score(80),
	});
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: OTHER_SAM_KEY,
		...score(100),
	});
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: SAM_KEY,
		...score(85),
	});
	expect(await board(t, token)).toEqual(
		expect.arrayContaining([
			{ athleteName: "Sam", load: 85, wodBlockId: "max" },
			{ athleteName: "Sam", load: 100, wodBlockId: "max" },
		]),
	);
	expect(await board(t, token)).toHaveLength(2);
});

it("never overwrites a guest score sent without a guest key", async () => {
	const { t, token } = await openWorkout();
	for (const load of [80, 90])
		await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
			token,
			guestName: "Sam",
			...score(load),
		});
	expect(await board(t, token)).toHaveLength(2);
});

it("rejects a malformed guest key and never returns keys to clients", async () => {
	const { t, host, id, token } = await openWorkout();
	await expect(
		t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
			token,
			guestName: "Sam",
			guestKey: "short",
			...score(80),
		}),
	).rejects.toThrow();
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: SAM_KEY,
		...score(80),
	});
	const mine = await host.query(api.hostedWorkouts.getMine, { id });
	expect(mine?.submissions[0]).not.toHaveProperty("guestKey");
	const open = await t.query(api.hostedWorkouts.getByJoinToken, { token });
	expect(open?.submissions[0]).not.toHaveProperty("guestKey");
});

it("lets a guest who signs up claim their scores into their own history", async () => {
	const { t, token } = await openWorkout();
	for (const [guestKey, load, block] of [
		[SAM_KEY, 80, "max"],
		[SAM_KEY, 60, "fran"],
		[OTHER_SAM_KEY, 100, "max"],
	] as const)
		await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
			token,
			guestName: "Sam",
			guestKey,
			...score(load, block),
		});
	expect(
		await t.query(api.hostedWorkoutSubmissions.countGuestSubmissions, {
			token,
			guestKey: SAM_KEY,
		}),
	).toBe(2);

	const sam = t.withIdentity({ subject: "sam" });
	const result = await sam.mutation(
		api.hostedWorkoutSubmissions.claimGuestSubmissions,
		{ token, guestKey: SAM_KEY },
	);
	expect(result).toMatchObject({ claimed: 2, skipped: 0 });

	// The scores are now Sam's own WOD Results in the joined session.
	const results = await t.run((ctx) =>
		ctx.db
			.query("wodResults")
			.withIndex("by_user", (q) => q.eq("userId", "sam"))
			.collect(),
	);
	expect(results.map((row) => row.load).sort()).toEqual([60, 80]);
	expect(results.every((row) => row.sessionId === result.sessionId)).toBe(true);

	// The leaderboard keeps the name, now from the participant, and the other
	// Sam stays a guest.
	const rows = await t.run((ctx) =>
		ctx.db.query("hostedWorkoutSubmissions").collect(),
	);
	const claimed = rows.filter((row) => row.participantId);
	expect(claimed).toHaveLength(2);
	expect(claimed.every((row) => !row.guestKey && !row.guestName)).toBe(true);
	expect(claimed.every((row) => row.wodResultId)).toBe(true);
	expect(await board(t, token)).toEqual(
		expect.arrayContaining([
			{ athleteName: "Sam", load: 80, wodBlockId: "max" },
			{ athleteName: "Sam", load: 60, wodBlockId: "fran" },
			{ athleteName: "Sam", load: 100, wodBlockId: "max" },
		]),
	);

	// Nothing is left to claim, and a re-submit as a guest no longer touches
	// the claimed row.
	expect(
		await t.query(api.hostedWorkoutSubmissions.countGuestSubmissions, {
			token,
			guestKey: SAM_KEY,
		}),
	).toBe(0);
	await expect(
		sam.mutation(api.hostedWorkoutSubmissions.claimGuestSubmissions, {
			token,
			guestKey: SAM_KEY,
		}),
	).rejects.toThrow();
});

it("keeps an athlete's signed-in score when they also scored as a guest", async () => {
	const { t, token } = await openWorkout();
	const sam = t.withIdentity({ subject: "sam" });
	const sessionId = await sam.mutation(api.hostedWorkoutParticipants.join, {
		token,
		displayName: "Sam",
	});
	await sam.mutation(api.hostedWorkoutSubmissions.submitForSession, {
		sessionId,
		...score(90),
	});
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: SAM_KEY,
		...score(80),
	});
	const result = await sam.mutation(
		api.hostedWorkoutSubmissions.claimGuestSubmissions,
		{ token, guestKey: SAM_KEY },
	);
	expect(result).toEqual({ sessionId, claimed: 0, skipped: 1 });
	const results = await t.run((ctx) =>
		ctx.db
			.query("wodResults")
			.withIndex("by_user", (q) => q.eq("userId", "sam"))
			.collect(),
	);
	expect(results.map((row) => row.load)).toEqual([90]);
});

it("claims into a finished session once the workout has closed", async () => {
	const { t, host, id, token } = await openWorkout();
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: SAM_KEY,
		...score(80),
	});
	await host.mutation(api.hostedWorkouts.close, { id });
	const sam = t.withIdentity({ subject: "sam" });
	const { sessionId, claimed } = await sam.mutation(
		api.hostedWorkoutSubmissions.claimGuestSubmissions,
		{ token, guestKey: SAM_KEY },
	);
	expect(claimed).toBe(1);
	const session = await t.run((ctx) => ctx.db.get(sessionId));
	expect(session?.status).toBe("completed");
});
