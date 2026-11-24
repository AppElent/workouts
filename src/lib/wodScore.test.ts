import { describe, expect, it } from "vitest";
import { wodScoreFromForm } from "./wodScore";

describe("wodScoreFromForm", () => {
	it("builds the score a valid form submits", () => {
		expect(wodScoreFromForm("amrap", { rounds: 4, reps: 7 })).toEqual({
			ok: true,
			score: { rounds: 4, reps: 7 },
		});
	});

	it.each([
		["forTime", {}, "timeRequired"],
		["forTime", { timeCapped: true }, "cappedRepsRequired"],
		["amrap", {}, "roundsOrRepsRequired"],
		["emom", {}, "repsOrRoundsRequired"],
		["load", {}, "loadRequired"],
		["forTime", { timeSeconds: 90_000 }, "timeOutOfRange"],
		["amrap", { rounds: 10_001 }, "roundsOutOfRange"],
		["emom", { reps: 100_001 }, "repsOutOfRange"],
		["load", { load: 2001 }, "loadOutOfRange"],
	] as const)("returns a catalog key for %s %o", (type, fields, error) => {
		expect(wodScoreFromForm(type, fields)).toEqual({ ok: false, error });
	});
});
