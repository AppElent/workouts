/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 14, 12);

afterEach(() => {
	vi.useRealTimers();
});

describe("monitoring usage snapshot", () => {
	it("counts records and distinct active accounts per window", async () => {
		vi.useFakeTimers();
		const t = convexTest(schema, modules);
		const insertSession = async (userId: string, ageDays: number) => {
			vi.setSystemTime(NOW - ageDays * DAY_MS);
			await t.run((ctx) =>
				ctx.db.insert("workoutSessions", {
					userId,
					date: NOW,
					startTime: NOW,
					status: "completed",
				}),
			);
		};
		// convex-test keeps creation times monotonic, so insert oldest first.
		await insertSession("dave", 45);
		await insertSession("carol", 20);
		await insertSession("alice", 3);
		await insertSession("bob", 3);
		vi.setSystemTime(NOW - 2 * DAY_MS);
		await t.run((ctx) =>
			ctx.db.insert("bodyMetrics", { userId: "erin", date: NOW, unit: "kg" }),
		);
		await insertSession("alice", 0.5);

		const snapshot = await t.query(internal.monitoring.usageSnapshot, {
			now: NOW,
		});

		expect(snapshot.records.workoutSessions).toEqual({
			day: 1,
			week: 3,
			month: 4,
		});
		expect(snapshot.records.bodyMetrics).toEqual({ day: 0, week: 1, month: 1 });
		expect(snapshot.records.sets).toEqual({ day: 0, week: 0, month: 0 });
		expect(snapshot.activeUsers).toEqual({ day: 1, week: 3, month: 4 });
		expect(JSON.stringify(snapshot)).not.toContain("alice");
	});
});
