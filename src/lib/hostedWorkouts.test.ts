import { describe, expect, it } from "vitest";
import {
	formatHostedScore,
	getHostedLevelLabel,
	sortHostedLeaderboard,
	validateHostedScore,
} from "./hostedWorkouts";

describe("getHostedLevelLabel", () => {
	it("formats canonical hosted workout levels", () => {
		expect(getHostedLevelLabel("rx")).toBe("Rx");
		expect(getHostedLevelLabel("l1")).toBe("L1");
		expect(getHostedLevelLabel("l2")).toBe("L2");
		expect(getHostedLevelLabel("l3")).toBe("L3");
	});
});

describe("validateHostedScore", () => {
	it("accepts a for-time finish", () => {
		expect(
			validateHostedScore("forTime", {
				timeSeconds: 421,
				timeCapped: false,
			}),
		).toEqual({ ok: true });
	});

	it("rejects a for-time score without time", () => {
		expect(validateHostedScore("forTime", {})).toEqual({
			ok: false,
			message: "Time is required for this WOD.",
		});
	});

	it("accepts an AMRAP rounds plus reps score", () => {
		expect(validateHostedScore("amrap", { rounds: 7, reps: 12 })).toEqual({
			ok: true,
		});
	});

	it("rejects a load score without load unit", () => {
		expect(validateHostedScore("load", { load: 120 })).toEqual({
			ok: false,
			message: "Load unit is required for this WOD.",
		});
	});
});

describe("formatHostedScore", () => {
	it("formats for-time capped and finished scores", () => {
		expect(formatHostedScore("forTime", { timeSeconds: 421 })).toBe("7:01");
		expect(
			formatHostedScore("forTime", {
				timeSeconds: 600,
				timeCapped: true,
				reps: 18,
			}),
		).toBe("CAP + 18");
	});

	it("formats AMRAP and load scores", () => {
		expect(formatHostedScore("amrap", { rounds: 5, reps: 9 })).toBe("5 + 9");
		expect(formatHostedScore("load", { load: 225, loadUnit: "lbs" })).toBe(
			"225 lbs",
		);
	});
});

describe("sortHostedLeaderboard", () => {
	it("sorts one combined leaderboard while keeping level badges available", () => {
		const rows = sortHostedLeaderboard("forTime", [
			{
				id: "capped",
				name: "Capped Athlete",
				level: "l2",
				submittedAt: 3,
				score: { timeSeconds: 600, timeCapped: true, reps: 90 },
			},
			{
				id: "fast",
				name: "Fast Athlete",
				level: "rx",
				submittedAt: 2,
				score: { timeSeconds: 320 },
			},
			{
				id: "faster",
				name: "Faster Athlete",
				level: "l1",
				submittedAt: 1,
				score: { timeSeconds: 300 },
			},
		]);

		expect(rows.map((row) => row.id)).toEqual(["faster", "fast", "capped"]);
		expect(rows[0]?.level).toBe("l1");
	});
});
