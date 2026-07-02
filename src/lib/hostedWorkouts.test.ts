import { describe, expect, it } from "vitest";
import {
	formatHostedScore,
	formatMovement,
	getHostedLevelLabel,
	scoreRank,
	sortHostedLeaderboard,
	validateHostedScore,
} from "./hostedWorkouts";

describe("formatMovement", () => {
	it("renders reps, name, and a per-movement weight", () => {
		expect(
			formatMovement({ name: "Thrusters", reps: 21, weight: 43, unit: "kg" }),
		).toBe("21 Thrusters @ 43 kg");
	});

	it("renders a bare movement name with no reps or weight", () => {
		expect(formatMovement({ name: "Pull-ups" })).toBe("Pull-ups");
	});

	it("defaults the weight unit to kg", () => {
		expect(formatMovement({ name: "Deadlift", weight: 100 })).toBe(
			"Deadlift @ 100 kg",
		);
	});

	it("renders a distance with its unit", () => {
		expect(
			formatMovement({ name: "Run", distance: 400, distanceUnit: "m" }),
		).toBe("Run 400 m");
	});
});

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

	it("rejects a capped for-time score without reps", () => {
		expect(
			validateHostedScore("forTime", {
				timeSeconds: 600,
				timeCapped: true,
			}),
		).toEqual({
			ok: false,
			message: "Reps are required for capped scores.",
		});
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

	it("formats AMRAP, EMOM, and load scores", () => {
		expect(formatHostedScore("amrap", { rounds: 5, reps: 9 })).toBe("5 + 9");
		expect(formatHostedScore("emom", { reps: 180 })).toBe("180 reps");
		expect(formatHostedScore("emom", { rounds: 12 })).toBe("12 rounds");
		expect(formatHostedScore("load", { load: 225, loadUnit: "lbs" })).toBe(
			"225 lbs",
		);
	});
});

describe("scoreRank", () => {
	it("ranks AMRAP scores by rounds before reps", () => {
		expect(scoreRank("amrap", { rounds: 3, reps: 10 })).toBeGreaterThan(
			scoreRank("amrap", { rounds: 2, reps: 99 }),
		);
	});

	it("ranks load scores by normalized load", () => {
		expect(scoreRank("load", { load: 100, loadUnit: "kg" })).toBeGreaterThan(
			scoreRank("load", { load: 200, loadUnit: "lbs" }),
		);
	});

	it("ranks EMOM reps above rounds-only scores", () => {
		expect(scoreRank("emom", { reps: 120 })).toBeGreaterThan(
			scoreRank("emom", { rounds: 10 }),
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
