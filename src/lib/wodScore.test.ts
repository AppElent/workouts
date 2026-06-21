import { describe, expect, it } from "vitest";
import { bestScore, formatScore, formatSeconds, scoreRank } from "./wodScore";

describe("formatSeconds", () => {
	it("formats mm:ss with zero-padded seconds", () => {
		expect(formatSeconds(0)).toBe("0:00");
		expect(formatSeconds(9)).toBe("0:09");
		expect(formatSeconds(201)).toBe("3:21");
	});
});

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
