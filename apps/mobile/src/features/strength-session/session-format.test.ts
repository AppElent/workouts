import {
	formatLoadOnly,
	formatSetFull,
	formatSetShort,
	LOADED_FORMAT,
} from "./session-format";

const HOLD = { bodyweight: true, timed: true };
const BODYWEIGHT = { bodyweight: true, timed: false };

describe("set formats", () => {
	it("reads a hold in seconds", () => {
		expect(formatSetShort({ kg: 0, unit: "kg", reps: 45 }, HOLD, "en")).toBe(
			"45 s",
		);
		expect(formatSetShort({ kg: 10, unit: "kg", reps: 45 }, HOLD, "en")).toBe(
			"+10 × 45 s",
		);
		expect(formatSetFull({ kg: 0, unit: "kg", reps: 60 }, HOLD, "nl")).toBe(
			"60 s",
		);
	});
	it("names pounds on a hold once logged in lbs", () => {
		const row = { kg: 19.958, unit: "lbs", typedLbs: 44, reps: 45 } as const;
		expect(formatSetShort(row, HOLD, "en")).toBe("+44 lbs × 45 s");
		expect(formatLoadOnly(row, HOLD, "en")).toBe("+44 lbs");
	});
	it("keeps reps for other exercises", () => {
		expect(
			formatSetShort({ kg: 0, unit: "kg", reps: 12 }, BODYWEIGHT, "en"),
		).toBe("+0 × 12");
		expect(
			formatSetFull({ kg: 95, unit: "kg", reps: 5 }, LOADED_FORMAT, "en"),
		).toBe("95 kg × 5");
	});
});
