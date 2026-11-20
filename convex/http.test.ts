/// <reference types="vite/client" />
import { HOSTED_LEVELS } from "@foundry/core";
import { convexTest } from "convex-test";
import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { loadTestDataBaseline } from "./lib/testDataBaseline";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

/**
 * A fresh Svix signing secret per run. Never commit a literal one: secret
 * scanners flag it, even a test value.
 */
function testSecret() {
	const key = Buffer.from(crypto.getRandomValues(new Uint8Array(24)));
	return ["whsec", key.toString("base64")].join("_");
}

const SECRET = testSecret();
const OTHER_SECRET = testSecret();

async function seeded() {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		for (const userId of ["alice", "bob"]) {
			await loadTestDataBaseline(ctx, userId, "2026-10-10");
			await ctx.db.insert("nutritionGoalPreferences", {
				userId,
				displayOrder: [],
			});
		}
	});
	return t;
}

/**
 * `seeded`, plus Alice hosting an open event Bob is still in and a guest
 * scored on, and Alice and Bob both scored in Carol's closed event. Join
 * tokens are fixed so two deployments compare equal.
 */
async function withHostedWorkouts() {
	const t = await seeded();
	const events: Record<string, Id<"hostedWorkouts">> = {};
	for (const host of ["alice", "carol"]) {
		const as = t.withIdentity({ subject: host });
		const id = await as.mutation(api.hostedWorkouts.createDraft, {
			title: `${host}'s lift`,
			hostParticipation: "hostOnly",
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
		await t.run((ctx) => ctx.db.patch(id, { joinToken: `${host}-token` }));
		await as.mutation(api.hostedWorkouts.open, { id });
		events[host] = id;
	}
	const score = {
		wodBlockId: "max",
		level: "rx" as const,
		loadUnit: "kg" as const,
	};
	for (const [user, token, load] of [
		["alice", "carol-token", 100],
		["bob", "carol-token", 90],
	] as const) {
		const as = t.withIdentity({ subject: user });
		const sessionId = await as.mutation(api.hostedWorkoutParticipants.join, {
			token,
		});
		await as.mutation(api.hostedWorkoutSubmissions.submitForSession, {
			sessionId,
			...score,
			load,
		});
	}
	await t
		.withIdentity({ subject: "carol" })
		.mutation(api.hostedWorkouts.close, { id: events.carol });
	const bob = t.withIdentity({ subject: "bob" });
	await bob.mutation(api.hostedWorkoutParticipants.join, {
		token: "alice-token",
	});
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token: "alice-token",
		guestName: "Sam",
		guestKey: "guest-key-sam-one-0001",
		...score,
		load: 70,
	});
	return t;
}

/** Every row in every table, without ids, so two deployments can be compared. */
async function snapshot(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const tables = Object.keys(schema.tables) as TableNames[];
		const out: Record<string, unknown[]> = {};
		for (const table of tables) {
			const rows = await ctx.db.query(table).collect();
			out[table] = rows
				.map(({ _id, _creationTime, ...row }) => JSON.stringify(row))
				.sort();
		}
		return out;
	});
}

async function rowsOf(t: ReturnType<typeof convexTest>, userId: string) {
	const tables = await snapshot(t);
	return Object.values(tables)
		.flat()
		.filter((row) => (row as string).includes(`"userId":"${userId}"`));
}

function event(type: string, id = "alice") {
	return JSON.stringify({
		type,
		object: "event",
		data: { id, object: "user", deleted: true },
	});
}

function signed(body: string, secret = SECRET, msgId = "msg_1") {
	const timestamp = new Date();
	return {
		"svix-id": msgId,
		"svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
		"svix-signature": new Webhook(secret).sign(msgId, timestamp, body),
	};
}

function post(
	t: ReturnType<typeof convexTest>,
	body: string,
	headers: Record<string, string>,
) {
	return t.fetch("/clerk/webhook", { method: "POST", headers, body });
}

beforeEach(() => {
	vi.stubEnv("CLERK_WEBHOOK_SECRET", SECRET);
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("POST /clerk/webhook signature", () => {
	it("purges on a validly signed user.deleted", async () => {
		const t = await seeded();
		const body = event("user.deleted");
		const response = await post(t, body, signed(body));
		expect(response.status).toBe(200);
		expect(await rowsOf(t, "alice")).toEqual([]);
		expect((await rowsOf(t, "bob")).length).toBeGreaterThan(0);
	});

	it("refuses missing, invalid, stale and foreign signatures without side effects", async () => {
		const t = await seeded();
		const before = await snapshot(t);
		const body = event("user.deleted");
		const good = signed(body);

		const missing = await post(t, body, {});
		expect(missing.status).toBe(400);
		const noSignature = await post(t, body, {
			"svix-id": good["svix-id"],
			"svix-timestamp": good["svix-timestamp"],
		});
		expect(noSignature.status).toBe(400);

		const tampered = await post(t, event("user.deleted", "bob"), good);
		expect(tampered.status).toBe(401);
		const garbage = await post(t, body, {
			...good,
			"svix-signature": "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
		});
		expect(garbage.status).toBe(401);
		const foreign = await post(t, body, signed(body, OTHER_SECRET));
		expect(foreign.status).toBe(401);
		const stale = await post(t, body, {
			...good,
			"svix-timestamp": String(Math.floor(Date.now() / 1000) - 60 * 60),
		});
		expect(stale.status).toBe(401);

		expect(await snapshot(t)).toEqual(before);
	});

	it("does nothing while the secret is not configured", async () => {
		vi.stubEnv("CLERK_WEBHOOK_SECRET", "");
		const t = await seeded();
		const before = await snapshot(t);
		const body = event("user.deleted");
		const response = await post(t, body, signed(body));
		expect(response.status).toBe(503);
		expect(await snapshot(t)).toEqual(before);
	});
});

describe("POST /clerk/webhook purge", () => {
	it("deletes exactly what in-app deletion deletes", async () => {
		// Seeded timestamps come from the clock; both deployments share one.
		vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-19T10:00Z") });
		const inApp = await seeded();
		const alice = inApp.withIdentity({ subject: "alice" });
		while (
			!(
				await alice.mutation(api.account.deleteData, {
					expectedSubject: "alice",
				})
			).done
		);

		const webhook = await seeded();
		const body = event("user.deleted");
		expect((await post(webhook, body, signed(body))).status).toBe(200);

		expect(await snapshot(webhook)).toEqual(await snapshot(inApp));
	});

	it("is idempotent: a repeated delivery and an unknown user are no-ops", async () => {
		const t = await seeded();
		const body = event("user.deleted");
		expect((await post(t, body, signed(body))).status).toBe(200);
		const after = await snapshot(t);
		expect((await post(t, body, signed(body, SECRET, "msg_2"))).status).toBe(
			200,
		);
		const stranger = event("user.deleted", "user_never_used_foundry");
		expect((await post(t, stranger, signed(stranger))).status).toBe(200);
		expect(await snapshot(t)).toEqual(after);
	});

	it("acknowledges other events without doing anything", async () => {
		const t = await seeded();
		const before = await snapshot(t);
		for (const type of ["user.created", "user.updated", "session.ended"]) {
			const body = event(type);
			expect((await post(t, body, signed(body))).status).toBe(200);
		}
		const malformed = "not json";
		expect((await post(t, malformed, signed(malformed))).status).toBe(200);
		expect(await snapshot(t)).toEqual(before);
	});

	it("purges a running Activity, which nobody can finish any more", async () => {
		const t = await seeded();
		await t
			.withIdentity({ subject: "alice" })
			.mutation(api.workoutSessions.create, {});
		const body = event("user.deleted");
		expect((await post(t, body, signed(body))).status).toBe(200);
		expect(await rowsOf(t, "alice")).toEqual([]);
	});

	it("deletes Hosted Workouts exactly as in-app deletion does", async () => {
		vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-19T10:00Z") });
		const inApp = await withHostedWorkouts();
		const alice = inApp.withIdentity({ subject: "alice" });
		while (
			!(
				await alice.mutation(api.account.deleteData, {
					expectedSubject: "alice",
				})
			).done
		);

		const webhook = await withHostedWorkouts();
		const body = event("user.deleted");
		expect((await post(webhook, body, signed(body))).status).toBe(200);

		const after = await snapshot(webhook);
		expect(after).toEqual(await snapshot(inApp));
		expect(await rowsOf(webhook, "alice")).toEqual([]);
		// Alice's own event is gone with its guest; Carol's keeps Bob only.
		expect(after.hostedWorkouts).toHaveLength(1);
		expect(after.hostedWorkoutParticipants).toHaveLength(1);
		expect(after.hostedWorkoutSubmissions).toHaveLength(1);
		expect(after.hostedWorkoutSubmissions[0]).not.toContain("guestName");
	});

	it("continues a large account in scheduled batches", async () => {
		vi.useFakeTimers();
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			for (let date = 0; date < 2500; date++)
				await ctx.db.insert("bodyMetrics", {
					userId: "alice",
					date,
					weight: 80,
					unit: "kg",
				});
		});
		const body = event("user.deleted");
		expect((await post(t, body, signed(body))).status).toBe(200);
		expect((await rowsOf(t, "alice")).length).toBe(500);
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await rowsOf(t, "alice")).toEqual([]);
	});
});
