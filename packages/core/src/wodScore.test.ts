import { describe, expect, it } from "vitest";
import {
	bestScore,
	buildWodScore,
	formatMovement,
	formatScore,
	hostedLevelLabel,
	parseClockInput,
	scoreRank,
	sortLeaderboard,
	validateWodScore,
} from "./wodScore";

describe("formatScore", () => {
	it("For Time: finish shows mm:ss, capped shows CAP+reps", () => {
		expect(formatScore("forTime", { timeSeconds: 201 })).toBe("3:21");
		expect(formatScore("forTime", { timeCapped: true, reps: 12 })).toBe(
			"CAP+12",
		);
	});
	it("AMRAP shows rounds + reps", () => {
		expect(formatScore("amrap", { rounds: 6, reps: 14 })).toBe("6 + 14");
	});
	it("EMOM shows total reps", () => {
		expect(formatScore("emom", { reps: 180 })).toBe("180 reps");
	});
	it("Load shows weight + unit", () => {
		expect(formatScore("load", { load: 95, loadUnit: "kg" })).toBe("95 kg");
	});
});

describe("scoreRank", () => {
	it("For Time: faster ranks higher", () => {
		expect(scoreRank("forTime", { timeSeconds: 180 })).toBeGreaterThan(
			scoreRank("forTime", { timeSeconds: 240 }),
		);
	});
	it("For Time: any finish beats any cap", () => {
		const slowFinish = scoreRank("forTime", { timeSeconds: 3600 });
		const goodCap = scoreRank("forTime", { timeCapped: true, reps: 500 });
		expect(slowFinish).toBeGreaterThan(goodCap);
	});
	it("For Time: among capped, more reps ranks higher", () => {
		expect(
			scoreRank("forTime", { timeCapped: true, reps: 30 }),
		).toBeGreaterThan(scoreRank("forTime", { timeCapped: true, reps: 20 }));
	});
	it("AMRAP: more rounds wins even with fewer extra reps", () => {
		expect(scoreRank("amrap", { rounds: 7, reps: 0 })).toBeGreaterThan(
			scoreRank("amrap", { rounds: 6, reps: 99 }),
		);
	});
	it("Load: normalizes lbs to kg for comparison", () => {
		// 225 lbs ≈ 102 kg, beats a 100 kg lift
		expect(scoreRank("load", { load: 225, loadUnit: "lbs" })).toBeGreaterThan(
			scoreRank("load", { load: 100, loadUnit: "kg" }),
		);
	});
});

describe("bestScore", () => {
	it("returns null for empty input", () => {
		expect(bestScore("forTime", [])).toBeNull();
	});
	it("returns the fastest For Time result", () => {
		const a = { _id: "a", timeSeconds: 200 };
		const b = { _id: "b", timeSeconds: 150 };
		expect(bestScore("forTime", [a, b])).toBe(b);
	});
});

describe("validateWodScore", () => {
	const errors = (...args: Parameters<typeof validateWodScore>) => {
		const result = validateWodScore(...args);
		return result.ok ? [] : result.errors;
	};

	it("accepts a capped For-Time score without a time (server rule)", () => {
		expect(errors("forTime", { timeCapped: true, reps: 40 })).toEqual([]);
	});
	it("requires reps when capped and a time when finished", () => {
		expect(errors("forTime", { timeCapped: true })).toEqual([
			{ field: "reps", code: "required" },
		]);
		expect(errors("forTime", { timeCapped: false })).toEqual([
			{ field: "timeSeconds", code: "required" },
		]);
	});
	it("accepts EMOM rounds without reps, and AMRAP reps without rounds", () => {
		expect(errors("emom", { rounds: 12 })).toEqual([]);
		expect(errors("amrap", { reps: 30 })).toEqual([]);
		expect(errors("amrap", {})).toEqual([
			{ field: "rounds", code: "required" },
		]);
	});
	it("requires a load and its unit", () => {
		expect(errors("load", { load: 100 })).toEqual([
			{ field: "loadUnit", code: "required" },
		]);
	});
	it("bounds every present number", () => {
		expect(errors("forTime", { timeSeconds: 86_400 })).toEqual([]);
		expect(errors("forTime", { timeSeconds: 86_401 })).toEqual([
			{ field: "timeSeconds", code: "tooLarge" },
		]);
		expect(errors("amrap", { rounds: -1, reps: 100_001 })).toEqual([
			{ field: "rounds", code: "tooSmall" },
			{ field: "reps", code: "tooLarge" },
		]);
		expect(errors("load", { load: 2000.5, loadUnit: "lbs" })).toEqual([
			{ field: "load", code: "tooLarge" },
		]);
		expect(errors("forTime", { timeSeconds: Number.NaN })).toEqual([
			{ field: "timeSeconds", code: "notNumber" },
		]);
	});
});

describe("buildWodScore", () => {
	it("keeps only the fields the WOD type ranks on", () => {
		const fields = {
			timeSeconds: 300,
			timeCapped: true,
			rounds: 4,
			reps: 12,
			load: 80,
		};
		expect(buildWodScore("forTime", fields)).toEqual({
			timeCapped: true,
			reps: 12,
		});
		expect(buildWodScore("forTime", { ...fields, timeCapped: false })).toEqual({
			timeSeconds: 300,
		});
		expect(buildWodScore("amrap", fields)).toEqual({ rounds: 4, reps: 12 });
		expect(buildWodScore("emom", fields)).toEqual({ reps: 12 });
		expect(buildWodScore("load", fields)).toEqual({ load: 80, loadUnit: "kg" });
	});
	it("leaves missing values out instead of defaulting them", () => {
		expect(buildWodScore("amrap", { rounds: 3 })).toEqual({ rounds: 3 });
		expect(validateWodScore("forTime", buildWodScore("forTime", {})).ok).toBe(
			false,
		);
	});
});

describe("parseClockInput", () => {
	it("reads minutes:seconds or plain seconds", () => {
		expect(parseClockInput("12:30")).toBe(750);
		expect(parseClockInput(" 750 ")).toBe(750);
		expect(parseClockInput("")).toBeUndefined();
		expect(parseClockInput("12:3x")).toBeUndefined();
		expect(parseClockInput("-5")).toBeUndefined();
	});
});

describe("formatScore beyond an hour", () => {
	it("shows a finish past an hour with hours", () => {
		expect(formatScore("forTime", { timeSeconds: 3767 })).toBe("1:02:47");
	});
});

describe("sortLeaderboard", () => {
	it("breaks equal scores by earliest submission", () => {
		const late = { id: "late", submittedAt: 20, score: { timeSeconds: 300 } };
		const early = { id: "early", submittedAt: 10, score: { timeSeconds: 300 } };
		const fast = { id: "fast", submittedAt: 30, score: { timeSeconds: 200 } };
		const capped = {
			id: "capped",
			submittedAt: 1,
			score: { timeCapped: true, reps: 99 },
		};
		expect(
			sortLeaderboard("forTime", [capped, late, early, fast]).map((e) => e.id),
		).toEqual(["fast", "early", "late", "capped"]);
	});
	it("ranks an EMOM score by reps only", () => {
		const roundsOnly = { submittedAt: 1, score: { rounds: 12 } };
		const reps = { submittedAt: 2, score: { reps: 5 } };
		expect(sortLeaderboard("emom", [roundsOnly, reps])[0]).toBe(reps);
	});
	it("compares loads in kg", () => {
		const lbs = {
			submittedAt: 2,
			score: { load: 225, loadUnit: "lbs" as const },
		};
		const kg = {
			submittedAt: 1,
			score: { load: 100, loadUnit: "kg" as const },
		};
		expect(sortLeaderboard("load", [kg, lbs])[0]).toBe(lbs);
	});
});

describe("hostedLevelLabel", () => {
	it("uses the host's name, falling back to the canonical one", () => {
		const levels = [
			{ level: "rx" as const, label: "Elite" },
			{ level: "l1" as const, label: "" },
		];
		expect(hostedLevelLabel(levels, "rx")).toBe("Elite");
		expect(hostedLevelLabel(levels, "l1")).toBe("L1");
		expect(hostedLevelLabel(levels, "l3")).toBe("L3");
	});
});

describe("formatMovement", () => {
	it("writes reps, name, distance and per-movement load", () => {
		expect(
			formatMovement({ name: "Thrusters", reps: 21, weight: 43, unit: "kg" }),
		).toBe("21 Thrusters @ 43 kg");
		expect(formatMovement({ name: "Run", distance: 400 })).toBe("Run 400 m");
		expect(formatMovement({ name: "Pull-ups" })).toBe("Pull-ups");
	});
});
