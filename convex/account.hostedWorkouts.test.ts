/// <reference types="vite/client" />
import { HOSTED_LEVELS } from "@foundry/core";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { deleteHostedWorkoutData } from "./lib/hosted";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const newTest = () => convexTest(schema, modules);
type Test = ReturnType<typeof newTest>;

const GUEST_KEY = "guest-key-sam-one-0001";

/** An open Hosted Workout with one WOD block, hosted by `host`. */
async function openEvent(
	t: Test,
	host: string,
	hostParticipation: "hostOnly" | "hostAndParticipate" = "hostOnly",
) {
	const as = t.withIdentity({ subject: host });
	const id = await as.mutation(api.hostedWorkouts.createDraft, {
		title: `${host}'s lift`,
		hostParticipation,
		template: {
			strengthBlocks: [],
			wodBlocks: [
				{
					blockId: "max",
					name: "Max clean",
					type: "load",
					levels: HOSTED_LEVELS.map((level) => ({
						level,
						label: level,
						movements: [{ name: "Clean" }],
					})),
				},
			],
		},
	});
	await as.mutation(api.hostedWorkouts.open, { id });
	const mine = await as.query(api.hostedWorkouts.getMine, { id });
	if (!mine) throw new Error("Hosted workout missing");
	return { id, token: mine.hosted.joinToken };
}

const score = (load: number) => ({
	wodBlockId: "max",
	level: "rx" as const,
	load,
	loadUnit: "kg" as const,
});

/** Joins `user` to the event and submits a score from their own session. */
async function joinAndScore(
	t: Test,
	user: string,
	token: string,
	load: number,
) {
	const as = t.withIdentity({ subject: user });
	const sessionId = await as.mutation(api.hostedWorkoutParticipants.join, {
		token,
		displayName: user,
	});
	await as.mutation(api.hostedWorkoutSubmissions.submitForSession, {
		sessionId,
		...score(load),
	});
	return sessionId;
}

async function submitGuest(t: Test, token: string, load: number) {
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token,
		guestName: "Sam",
		guestKey: GUEST_KEY,
		...score(load),
	});
}

async function deleteInApp(t: Test, user: string) {
	const as = t.withIdentity({ subject: user });
	let calls = 0;
	for (;;) {
		calls += 1;
		const { done } = await as.mutation(api.account.deleteData, {
			expectedSubject: user,
		});
		if (done) return calls;
	}
}

async function board(t: Test, token: string) {
	const data = await t.query(api.hostedWorkouts.getByJoinToken, { token });
	return (data?.submissions ?? []).map(({ athleteName, load }) => ({
		athleteName,
		load,
	}));
}

/** Every row any table holds for `userId`, without ids. */
async function rowsOf(t: Test, userId: string) {
	return t.run(async (ctx) => {
		const rows: unknown[] = [];
		for (const table of Object.keys(schema.tables) as TableNames[])
			for (const row of await ctx.db.query(table).collect())
				if (
					("userId" in row && row.userId === userId) ||
					("hostUserId" in row && row.hostUserId === userId)
				)
					rows.push(row);
		return rows;
	});
}

function count(t: Test, table: TableNames) {
	return t.run(async (ctx) => (await ctx.db.query(table).collect()).length);
}

/** Row counts per table. */
function counts(t: Test) {
	return t.run(async (ctx) => {
		const out: Record<string, number> = {};
		for (const table of Object.keys(schema.tables) as TableNames[])
			out[table] = (await ctx.db.query(table).collect()).length;
		return out;
	});
}

/** The session `user` joined their first Hosted Workout with. */
async function participantSession(t: Test, user: string) {
	const participant = await t.run((ctx) =>
		ctx.db
			.query("hostedWorkoutParticipants")
			.withIndex("by_user", (q) => q.eq("userId", user))
			.first(),
	);
	if (!participant) throw new Error(`${user} joined nothing`);
	return participant.sessionId;
}

describe("account deletion with Hosted Workouts", () => {
	it("no longer reports Hosted Workout involvement as a blocker", async () => {
		const t = newTest();
		await openEvent(t, "alice");
		expect(
			await t
				.withIdentity({ subject: "alice" })
				.query(api.account.deletionBlocker, {}),
		).toBeNull();
	});

	it("removes a participant and their scores from another host's event", async () => {
		const t = newTest();
		const { id, token } = await openEvent(t, "host");
		await joinAndScore(t, "alice", token, 100);
		await joinAndScore(t, "bob", token, 90);
		await submitGuest(t, token, 70);
		const host = t.withIdentity({ subject: "host" });
		await host.mutation(api.hostedWorkouts.close, { id });
		const bobBefore = await rowsOf(t, "bob");

		await deleteInApp(t, "alice");

		expect(await rowsOf(t, "alice")).toEqual([]);
		expect(await board(t, token)).toEqual([
			{ athleteName: "bob", load: 90 },
			{ athleteName: "Sam", load: 70 },
		]);
		const event = await host.query(api.hostedWorkouts.getMine, { id });
		expect(event?.participants.map((row) => row.userId)).toEqual(["bob"]);
		expect(await rowsOf(t, "bob")).toEqual(bobBefore);
	});

	it("deletes a host's whole event, guests included, and leaves participants' own records", async () => {
		const t = newTest();
		const { token } = await openEvent(t, "alice", "hostAndParticipate");
		const other = await openEvent(t, "carol");
		await joinAndScore(t, "bob", other.token, 95);
		await t
			.withIdentity({ subject: "carol" })
			.mutation(api.hostedWorkouts.close, { id: other.id });
		// Bob is mid-event when the host's account goes.
		const bobSession = await joinAndScore(t, "bob", token, 90);
		await submitGuest(t, token, 70);
		// The host's own session runs while the event is open; finish it so the
		// in-app path is not refused for a running Activity.
		const alice = t.withIdentity({ subject: "alice" });
		await alice.mutation(api.workoutSessions.cancel, {
			id: await participantSession(t, "alice"),
		});
		const bob = t.withIdentity({ subject: "bob" });
		const bobRecords = await t.run(async (ctx) => ({
			wods: (await ctx.db.query("wods").collect()).filter(
				(row) => row.userId === "bob",
			),
			results: (await ctx.db.query("wodResults").collect()).filter(
				(row) => row.userId === "bob",
			),
		}));
		expect(bobRecords.results).toHaveLength(2);

		await deleteInApp(t, "alice");

		expect(await rowsOf(t, "alice")).toEqual([]);
		expect(await t.query(api.hostedWorkouts.getByJoinToken, { token })).toBe(
			null,
		);
		// Only Carol's event, with Bob's score, is left.
		expect(await count(t, "hostedWorkouts")).toBe(1);
		expect(await count(t, "hostedWorkoutParticipants")).toBe(1);
		expect(await board(t, other.token)).toEqual([
			{ athleteName: "bob", load: 95 },
		]);
		// Bob keeps their WODs and results; the session ended with the event,
		// completed because he scored, and opens as an ordinary session.
		expect(
			await t.run(async (ctx) => ({
				wods: (await ctx.db.query("wods").collect()).filter(
					(row) => row.userId === "bob",
				),
				results: (await ctx.db.query("wodResults").collect()).filter(
					(row) => row.userId === "bob",
				),
			})),
		).toEqual(bobRecords);
		expect(
			await bob.query(api.workoutSessions.getById, { id: bobSession }),
		).toMatchObject({ status: "completed" });
		expect(
			await bob.query(api.hostedWorkoutParticipants.getBySession, {
				sessionId: bobSession,
			}),
		).toBeNull();
	});

	it("deletes a large event across several bounded batches and repeats as a no-op", async () => {
		const t = newTest();
		const { id, token } = await openEvent(t, "alice");
		const elsewhere = await openEvent(t, "carol");
		await joinAndScore(t, "alice", elsewhere.token, 80);
		await t.run(async (ctx) => {
			for (let index = 0; index < 3500; index++)
				await ctx.db.insert("hostedWorkoutSubmissions", {
					hostedWorkoutId: id,
					guestName: `Guest ${index}`,
					wodBlockId: "max",
					level: "rx",
					load: index,
					loadUnit: "kg",
					submittedAt: index,
				});
		});
		await t
			.withIdentity({ subject: "alice" })
			.mutation(api.workoutSessions.cancel, {
				id: await participantSession(t, "alice"),
			});
		expect(
			await t.run((ctx) => deleteHostedWorkoutData(ctx, "alice", 1000)),
		).toBeNull();
		expect(await count(t, "hostedWorkoutSubmissions")).toBe(2501);

		expect(await deleteInApp(t, "alice")).toBeGreaterThan(1);
		expect(await rowsOf(t, "alice")).toEqual([]);
		expect(await count(t, "hostedWorkoutSubmissions")).toBe(0);
		expect(await board(t, token)).toEqual([]);

		const after = await counts(t);
		expect(await deleteInApp(t, "alice")).toBe(1);
		expect(
			await t.run((ctx) => deleteHostedWorkoutData(ctx, "alice", 10)),
		).toBe(10);
		expect(await counts(t)).toEqual(after);
	});
});
