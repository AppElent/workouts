/// <reference types="vite/client" />
import { HOSTED_LEVELS } from "@foundry/core";
import { convexTest } from "convex-test";
import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
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

	it("keeps data that a Hosted Workout shares with other accounts", async () => {
		const t = await seeded();
		await t
			.withIdentity({ subject: "alice" })
			.mutation(api.hostedWorkouts.createDraft, {
				title: "Friday lift",
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
		const before = await snapshot(t);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const body = event("user.deleted");
		expect((await post(t, body, signed(body))).status).toBe(200);
		expect(await snapshot(t)).toEqual(before);
		expect(error).toHaveBeenCalled();
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

describe("POST /clerk/webhook Apple links", () => {
	function userEvent(
		type: "user.created" | "user.updated",
		updatedAt: number,
		externalAccounts: unknown[],
		id = "alice",
	) {
		return JSON.stringify({
			type,
			object: "event",
			data: {
				id,
				object: "user",
				updated_at: updatedAt,
				external_accounts: externalAccounts,
			},
		});
	}
	const apple = (sub: string, status = "verified") => ({
		object: "external_account",
		provider: "oauth_apple",
		provider_user_id: sub,
		verification: { status },
	});
	const links = (t: ReturnType<typeof convexTest>) =>
		t.run(async (ctx) =>
			(await ctx.db.query("appleSignInLinks").collect()).map(
				({ userId, appleUserIds }) => ({ userId, appleUserIds }),
			),
		);

	it("mirrors verified Apple links from user.created and user.updated", async () => {
		const t = convexTest(schema, modules);
		const created = userEvent("user.created", 10, [
			apple("apple-alice"),
			apple("apple-pending", "unverified"),
		]);
		expect((await post(t, created, signed(created))).status).toBe(200);
		expect(await links(t)).toEqual([
			{ userId: "alice", appleUserIds: ["apple-alice"] },
		]);

		const relinked = userEvent("user.updated", 20, [apple("apple-new")]);
		await post(t, relinked, signed(relinked, SECRET, "msg_2"));
		// A retried older delivery does not roll it back.
		await post(t, created, signed(created, SECRET, "msg_3"));
		expect(await links(t)).toEqual([
			{ userId: "alice", appleUserIds: ["apple-new"] },
		]);

		const unlinked = userEvent("user.updated", 30, []);
		await post(t, unlinked, signed(unlinked, SECRET, "msg_4"));
		expect(await links(t)).toEqual([]);
	});

	it("never stores a link from an unsigned or forged event", async () => {
		const t = convexTest(schema, modules);
		const body = userEvent("user.updated", 10, [apple("apple-attacker")]);
		expect((await post(t, body, {})).status).toBe(400);
		expect((await post(t, body, signed(body, OTHER_SECRET))).status).toBe(401);
		expect(await links(t)).toEqual([]);
	});

	it("drops the link when the login is deleted", async () => {
		const t = convexTest(schema, modules);
		const created = userEvent("user.created", 10, [apple("apple-alice")]);
		await post(t, created, signed(created));
		const deleted = event("user.deleted");
		expect(
			(await post(t, deleted, signed(deleted, SECRET, "msg_2"))).status,
		).toBe(200);
		expect(await links(t)).toEqual([]);
	});
});
